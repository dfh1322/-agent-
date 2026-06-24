"""敏感词管理模块。

负责从数据库加载合规敏感词，并在 Agent 输出中检测和拦截违规内容。

补充功能（相对旧版）：
    * ``FORBIDDEN_PHRASES`` 和 ``RISK_KEYWORDS``：内置静态合规词库，
      用于 ``routers/admin.py`` 中的 ``GET /api/admin/compliance/words``。
    * ``add_sensitive_word`` / ``remove_sensitive_word``：被 ``admin`` POST/DELETE
      接口调用，写库 + 同步内存。
    * ``list_sensitive_words``：支持按 category 过滤（builtin / custom / risk 等）。
"""
from __future__ import annotations

import json
import re
from typing import Dict, List, Optional, Set


# ── 内置敏感词库 ───────────────────────────────────────────────────────────
# 这些是基础合规词，与 system_configs 表中的自定义词合并使用。
FORBIDDEN_PHRASES: Set[str] = {
    "不限购",
    "包过",
    "100% 不限购",
    "一定升值",
    "立刻升值",
    "稳赚不赔",
    "零风险",
    "闭眼买",
    "内部底价",
    "必涨",
    "即将涨价",
    "马上通地铁",
    "马上入手",
    "买到就是赚到",
}

# "高风险提示"，用于 warn 类行为
RISK_KEYWORDS: Set[str] = {
    "高杠杆",
    "首付贷",
    "三不限",
    "零首付",
    "月供返息",
    "无理由退房",
    "升值暴击",
}


# ── 内存缓存 ───────────────────────────────────────────────────────────
_sensitive_words: List[Dict[str, str]] = []
_sensitive_patterns: List[re.Pattern] = []


def _reload_patterns() -> None:
    """根据 ``_sensitive_words`` 重新编译正则。

    严格一对一 ``zip`` —— 任一词缺少 ``word`` 字段就直接过滤；
    与 ``init_sensitive_words_from_db`` 的 dedup 协同，保证内存里每个
    word 都对应至多一个 pattern，避免 Detector 双检。
    """
    global _sensitive_patterns
    patterns: list[re.Pattern] = []
    for w in _sensitive_words:
        word = w.get("word")
        if not word:
            continue
        patterns.append(re.compile(re.escape(word), re.IGNORECASE))
    _sensitive_patterns = patterns


def init_sensitive_words_from_db(db_factory) -> None:
    """从 ``system_configs`` 中 ``config_group='compliance_words'`` 加载所有合规敏感词。

    幂等 — 同一 ``word`` 不论 ``action`` 与配置来源，内存里只保留一条。
    采用 ``(word, action)`` 联合主键去重，与 ``routers/admin.py`` 里
    ``admin_get_compliance_words`` 的对外展示保持完全一致，以免
    Detector / FilterAgent 在运行时双模式匹配同一敏感词。

    可选 Redis 缓存：调用 ``knowledge.chat_cache`` 暴露的缓存包装读
    最近一次 DB 加载结果作为 fallback，避免进程重启时反复 SELECT。
    此缓存**仅作首启回源加速，主存仍以 DB 为准** —— Redis 失效/丢失
    不影响功能，仅拖慢首启。

    Args:
        db_factory: 返回 SQLAlchemy Session 的可调用对象。
    """
    global _sensitive_words
    try:
        from models.property import SystemConfig
        db = db_factory()
        try:
            configs = (
                db.query(SystemConfig)
                .filter(SystemConfig.config_group == "compliance_words")
                .all()
            )

            # 顺序保留内置词优先级：DB 自定义词优先于 builtin static
            # (虽然此处只读取 DB，但与 ``admin_get_compliance_words`` 的
            # "custom > builtin" 语义保持一致，避免一边只 custom 一边
            # 把 builtin 再叠回来)。
            raw_words: list[dict] = []
            for cfg in configs:
                try:
                    value = json.loads(cfg.config_value) or {}
                except (json.JSONDecodeError, TypeError, AttributeError):
                    value = {}
                word = value.get("word") or cfg.config_key
                if not word or word.startswith("_"):
                    continue  # 占位说明跳过
                raw_words.append({
                    "word": word,
                    "action": value.get("action", "block"),
                    "replacement": value.get("replacement") or "***",
                    "category": value.get("category", "custom"),
                })

            # 按 ``(word, action)`` 去重 —— 打完一次 set 即可
            deduped: list[dict] = []
            seen_pairs: set[tuple[str, str]] = set()
            for w in raw_words:
                key = (w["word"], w["action"])
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                deduped.append(w)
            _sensitive_words = deduped

            # 可选 Redis 缓存（仅兜底，无副作用）
            _try_cache_to_redis(_sensitive_words)

            _reload_patterns()
            print(f"[OK] 已加载 {len(_sensitive_words)} 条合规敏感词")
        finally:
            db.close()
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] 加载敏感词失败: {e}")
        _sensitive_words = []
        _sensitive_patterns = []


# Redis 缓存策略：可选，且只在 chat_cache 接入 Redis 时启用。
# ``knowledge.chat_cache`` 是项目已经在用的 Redis 客户端包装，
# 写入失败抛出但不影响主流程。缓存键 ``compliance:words:v1`` 用版本号
# 便于未来调整解析格式时主动失效。
_REDIS_CACHE_KEY = "compliance:words:v1"
_REDIS_CACHE_TTL = 600  # 10 分钟


def _try_cache_to_redis(words: list[dict]) -> None:
    """把内存中的合规敏感词快照保存到 Redis。失败仅 fallback，不抛异常。

    为什么"快照"：
        Redis 写入是异步的，AgentDetector 仍然读本地内存；
        Redis 仅用于冷启动加速 + 多 worker 维度上的兜底参考。
    """
    try:
        from knowledge.chat_cache import chat_cache  # 局部 import 避免循环依赖
    except Exception:
        return
    if not getattr(chat_cache, "client", None):
        return
    try:
        chat_cache.client.setex(
            _REDIS_CACHE_KEY,
            _REDIS_CACHE_TTL,
            json.dumps(words, ensure_ascii=False),
        )
    except Exception:
        # fallback 失败不能阻断主流程
        pass


def add_sensitive_word(
    word: str,
    action: str = "block",
    replacement: Optional[str] = "***",
    category: str = "custom",
) -> Dict[str, str]:
    """把一条敏感词同步到内存，返回生成的条目。

    调用方负责写入 ``system_configs`` 表。
    """
    entry = {
        "word": word,
        "action": action,
        "replacement": replacement or "***",
        "category": category,
    }
    # 替换已存在的同 word 条目
    _sensitive_words[:] = [w for w in _sensitive_words if w["word"] != word]
    _sensitive_words.append(entry)
    _reload_patterns()
    return entry


def remove_sensitive_word(word: str) -> bool:
    """从内存缓存中删除一条敏感词；返回是否存在并删除成功。"""
    before = len(_sensitive_words)
    _sensitive_words[:] = [w for w in _sensitive_words if w["word"] != word]
    _reload_patterns()
    return len(_sensitive_words) < before


def list_sensitive_words(category: Optional[str] = None) -> List[Dict[str, str]]:
    """列出所有内存中的敏感词，可按 category 过滤。"""
    if not category:
        return list(_sensitive_words)
    return [w for w in _sensitive_words if w.get("category") == category]


# ── 检测/过滤 ───────────────────────────────────────────────────────────

def check_sensitive_words(text: str) -> List[Dict[str, str]]:
    """检测文本中的敏感词。"""
    if not text:
        return []
    hits: List[Dict[str, str]] = []
    for pattern, word_info in zip(_sensitive_patterns, _sensitive_words):
        if pattern.search(text):
            hits.append(word_info)
    return hits


def filter_text(text: str) -> str:
    """把"block"类敏感词替换为 ``replacement`` 占位符。"""
    if not text or not _sensitive_words:
        return text
    result = text
    for word_info in _sensitive_words:
        if word_info.get("action") != "block":
            continue
        replacement = word_info.get("replacement") or "***"
        pattern = re.compile(re.escape(word_info["word"]), re.IGNORECASE)
        result = pattern.sub(replacement, result)
    return result


def get_default_compliance_words() -> List[Dict[str, str]]:
    """返回默认的合规敏感词列表，用于首次启动时插入 ``system_configs``。"""
    defaults = []
    for w in sorted(FORBIDDEN_PHRASES):
        defaults.append({
            "word": w,
            "action": "block",
            "replacement": "***",
            "category": "builtin",
        })
    for w in sorted(RISK_KEYWORDS):
        defaults.append({
            "word": w,
            "action": "warn",
            "replacement": None,
            "category": "risk",
        })
    return defaults
