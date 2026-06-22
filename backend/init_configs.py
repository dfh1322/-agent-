"""系统配置初始化脚本。

目标：
    1. 补齐 CLAUDE.md 第 7 节要求的 ``system_configs`` 默认配置。
    2. 已存在的``config_key``不会被覆盖（CLAUDE.md 严禁硬编码金融参数，
       业务方修改值后再次运行本脚本不应抹掉）。
    3. 可独立运行（``python init_configs.py``），也可被 ``main.py`` lifespan 复用。

默认分组：
    - ``basic``：站点信息
    - ``finance``：金融参数（首套/二套利率、公积金上限、首付比例等）
    - ``tax``：契税/增值税/个税税率（用于税费计算工具）
    - ``compliance_words``：合规敏感词（启动时也由 main.py 补一次）
    - ``ai_model``：默认模型、temperature、相似度阈值
    - ``redis``：缓存 TTL / 短信频次阈值
    - ``business``：合规开关、推荐上限、默认城市
    - ``notification``：短信供应商、验证码 TTL
    - ``agent``：最大会话消息数、是否日志工具调用
"""
from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, Iterable, List, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from sqlalchemy.orm import Session

from config.database import SessionLocal
from models.property import SystemConfig


# 每条配置：(config_key, config_value, config_group, description)
DEFAULT_CONFIGS: List[Tuple[str, str, str, str]] = [
    # basic（站点基础）
    ("site_name", "HouseCodex-Agent 房产智能咨询系统", "basic", "站点名称"),
    ("site_description", "基于多智能体协作的房产咨询平台", "basic", "站点描述"),

    # finance（金融参数）
    ("loan_rate_first", "0.038", "finance", "首套房商业贷款年利率（默认 3.8%）"),
    ("loan_rate_second", "0.044", "finance", "二套房商业贷款年利率（默认 4.4%）"),
    ("provident_fund_rate", "0.031", "finance", "公积金贷款利率（默认 3.1%）"),
    ("max_provident_fund", "80", "finance", "单职工公积金贷款上限（万元）"),
    ("down_payment_ratio_min", "0.3", "finance", "首付最低比例"),
    ("max_loan_term", "30", "finance", "最长贷款年限"),

    # tax（税费计算的税基与税率）
    ("deed_tax_first_small", "0.01", "tax", "首套 90㎡ 以下契税 1%"),
    ("deed_tax_first_large", "0.015", "tax", "首套 90㎡ 以上契税 1.5%"),
    ("deed_tax_second_small", "0.01", "tax", "二套 90㎡ 以下契税 1%"),
    ("deed_tax_second_large", "0.02", "tax", "二套 90㎡ 以上契税 2%"),
    ("vat_rate_short", "0.053", "tax", "未满 2 年增值税 5.3%"),
    ("income_tax_rate", "0.01", "tax", "个税 1%（差额 20% 由 calculation 工具判断）"),

    # compliance_words（合规敏感词，只读旧值由 main.py 的 lifespan 兜底补齐）
    # 这里只补一条占位说明，实际词库由 mental_words 模块维护
    ("_placeholder", json.dumps({"__note__": "合规敏感词由 main.py 初始化"}, ensure_ascii=False),
     "compliance_words", "占位说明"),

    # ai_model（模型路由）
    ("default_llm_provider", "siliconflow", "ai_model", "默认 LLM 服务商"),
    ("primary_model", "deepseek-v3", "ai_model", "主模型"),
    ("fallback_model", "qwen2.5-72b", "ai_model", "备用降级模型"),
    ("llm_temperature", "0.7", "ai_model", "默认 temperature"),
    ("llm_max_tokens", "4096", "ai_model", "单次回复最大 token"),
    ("similarity_threshold", "0.7", "ai_model", "向量检索相似度阈值（CLAUDE.md 第 6 节）"),

    # redis
    ("session_ttl", "7200", "redis", "会话缓存 TTL（秒）"),
    ("cache_ttl_property", "300", "redis", "楼盘缓存 TTL（秒）"),
    ("sms_rate_limit_per_hour", "5", "redis", "单手机号每小时短信发送上限"),

    # business
    ("enable_compliance_check", "true", "business", "是否启用合规敏感词过滤"),
    ("enable_fact_checker", "true", "business", "是否启用 FactChecker 防幻觉节点"),
    ("default_city", "杭州", "business", "默认城市"),
    ("max_property_recommendations", "5", "business", "推荐楼盘最大数量"),

    # notification
    ("sms_provider", "容联云", "notification", "短信服务商"),
    ("verification_code_ttl", "300", "notification", "验证码 TTL（秒）"),

    # agent
    ("max_conversation_messages", "20", "agent", "短期记忆最大消息条数"),
    ("enable_tool_logging", "true", "agent", "是否记录工具调用到 messages.tool_calls"),
]


def upsert_defaults(db: Session, rows: Iterable[Tuple[str, str, str, str]] = DEFAULT_CONFIGS) -> Dict[str, int]:
    """以幂等方式插入默认配置：

    - 若 ``config_key`` 不存在 → 新增一行；
    - 若已存在 → 跳过（保留业务侧可能的运行时调整）。

    Returns:
        包含 ``inserted`` 与 ``skipped`` 计数字段的字典。
    """
    existing_keys: set[str] = set(
        db.execute(select(SystemConfig.config_key)).scalars().all()
    )

    inserted = 0
    skipped = 0
    for cfg_key, cfg_value, cfg_group, description in rows:
        # 占位符不参与跳过逻辑（仅当没有占位时才跳过）
        if cfg_key in existing_keys:
            skipped += 1
            continue
        db.add(SystemConfig(
            config_key=cfg_key,
            config_value=cfg_value,
            description=description,
            config_group=cfg_group,
        ))
        inserted += 1

    db.commit()
    return {"inserted": inserted, "skipped": skipped}


def load_config_value(db: Session, key: str, default: Any = None) -> Any:
    """辅助函数：读取单个 ``config_key`` 的值，自动 JSON 反序列化。"""
    cfg = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
    if not cfg or not cfg.config_value:
        return default
    try:
        return json.loads(cfg.config_value)
    except (json.JSONDecodeError, TypeError):
        return cfg.config_value


def init_seed_configs(verbose: bool = True) -> Dict[str, int]:
    """入口函数：补齐默认配置，可被 lifespan 或单独脚本调用。"""
    db = SessionLocal()
    try:
        result = upsert_defaults(db)
        if verbose:
            print(
                f"[OK] 系统配置初始化：新增 {result['inserted']} 条，跳过已存在 {result['skipped']} 条"
            )
        return result
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("初始化 system_configs 默认配置")
    print("=" * 60)
    init_seed_configs(verbose=True)
