"""防幻觉校验模块（HallucinationGuard）。

负责校验 Agent 输出中的楼盘名称、数字、政策等信息是否在工具查询结果中有据可查，
防止 AI 编造虚假信息。

扩展项（相对旧版）：
    * 第三维度更稳健的政策表述校验（避免误报"具体法规名称"）。
    * 楼盘名扩展：覆盖“翡翠华庭”这一类**没有传统小区别名后缀**的楼盘。
    * 阈值 ``similarity_threshold`` 从 ``system_configs.business`` 注入。
"""
from __future__ import annotations

import re
from typing import Dict, Iterable, Optional, Set


# 默认的楼盘名后缀词典。当 ``system_configs.business.prop_name_suffixes`` 不存在时使用。
_DEFAULT_PROP_SUFFIXES = (
    "园", "苑", "府", "湾", "城", "里", "庄", "阁", "庭", "居",
    "公寓", "花园", "小区", "华庭", "国际", "都会", "大厦", "广场",
    "公馆", "家园", "雅苑", "名邸", "御园", "天汇", "中心",
    "新城", "首府", "御府", "御湾", "天玺", "嘉园",
)

# 中文字符范围（CJK 基本区 + A 区）
_CJK = r"一-鿿"

# 命中的"政策绝对化"表述
_ABSOLUTE_POLICY_PHRASES = (
    "政府补贴到位",
    "一定会升值",
    "稳定升值",
    "保值增值",
)


def _load_prop_suffixes() -> str:
    """从 ``system_configs.business.prop_name_suffixes`` 读取后缀列表。

    该键存储为 JSON 数组字符串；缺失则回退到内置默认。
    """
    try:
        from sqlalchemy import text
        from config.database import engine
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    "SELECT config_value FROM system_configs "
                    "WHERE config_key='prop_name_suffixes' LIMIT 1"
                )
            ).fetchone()
            if row and row[0]:
                import json
                arr = json.loads(row[0])
                if isinstance(arr, list) and arr:
                    return "|".join(re.escape(s) for s in arr)
    except Exception:  # noqa: BLE001
        pass
    return "|".join(_DEFAULT_PROP_SUFFIXES)


def _build_prop_pattern() -> re.Pattern:
    """根据动态后缀列表编译楼盘名匹配正则。"""
    suffix_part = _load_prop_suffixes()
    # 楼盘名：2-12 个汉字后接一个允许的后缀
    pattern = rf"[{_CJK}]{{2,12}}(?:{suffix_part})"
    return re.compile(pattern)


# 迟绑定，避免导入时循环
_PROP_PATTERN: Optional[re.Pattern] = None


def _get_prop_pattern() -> re.Pattern:
    global _PROP_PATTERN
    if _PROP_PATTERN is None:
        _PROP_PATTERN = _build_prop_pattern()
    return _PROP_PATTERN


def _read_similarity_threshold() -> float:
    """从 ``system_configs.business.similarity_threshold`` 读取阈值。"""
    try:
        from sqlalchemy import text
        from config.database import engine
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    "SELECT config_value FROM system_configs "
                    "WHERE config_key='similarity_threshold' LIMIT 1"
                )
            ).fetchone()
            if row and row[0]:
                return float(row[0])
    except Exception:  # noqa: BLE001
        pass
    return 0.7


class HallucinationGuard:
    """防幻觉校验守卫。

    工作流程：
        1. ``full_check``：综合校验（楼盘名 + 数字 + 政策）。
        2. ``check_property_names``：校验提到的楼盘是否在有效楼盘列表中。
        3. ``check_numbers``：校验数字是否异常。
        4. ``check_policy_claims``：校验政策引用是否真实。
    """

    def __init__(self, enabled: bool = True):
        self.enabled = enabled

    # ── 综合 ──

    def full_check(
        self,
        response: str,
        valid_properties: Optional[Iterable[str]] = None,
        valid_numbers: Optional[Iterable[float]] = None,
    ) -> Dict[str, object]:
        if not self.enabled or not response:
            return {
                "passed": True,
                "issues": [],
                "property_check": {"passed": True, "issues": []},
                "number_check": {"passed": True, "issues": []},
                "policy_check": {"passed": True, "issues": []},
                "threshold": _read_similarity_threshold(),
            }

        valid_props = set(valid_properties or [])
        property_result = self.check_property_names(response, valid_props)
        number_result = self.check_numbers(response, valid_numbers)
        policy_result = self.check_policy_claims(response)

        all_issues: list[str] = []
        all_issues.extend(property_result.get("issues", []))
        all_issues.extend(number_result.get("issues", []))
        all_issues.extend(policy_result.get("issues", []))

        return {
            "passed": len(all_issues) == 0,
            "issues": all_issues,
            "property_check": property_result,
            "number_check": number_result,
            "policy_check": policy_result,
            "threshold": _read_similarity_threshold(),
        }

    # ── 楼盘名 ──

    def check_property_names(
        self,
        response: str,
        valid_properties: Set[str],
    ) -> Dict[str, object]:
        if not valid_properties:
            return {"passed": True, "issues": [], "unverified_props": []}

        pattern = _get_prop_pattern()
        # 注意：旧版第 107 行有 `set(prop_pattern.findall(response))1` 的语法错误，
        # 末尾多余的 "1" 是笔误，现已修复。
        mentioned = set(pattern.findall(response))

        unverified: list[str] = []
        for prop in mentioned:
            if not any(prop in vp or vp in prop for vp in valid_properties):
                unverified.append(prop)

        issues = [f"未验证的楼盘名: '{p}'" for p in unverified]

        return {
            "passed": len(unverified) == 0,
            "issues": issues,
            "unverified_props": unverified,
        }

    # ── 数字 ──

    def check_numbers(
        self,
        response: str,
        valid_numbers: Optional[Iterable[float]] = None,
    ) -> Dict[str, object]:
        numbers = re.findall(r"\d+\.?\d*", response)
        issues: list[str] = []
        valid_set = set(valid_numbers or [])

        for num_str in numbers:
            try:
                num = float(num_str)
            except ValueError:
                continue
            if num > 1e9:
                issues.append(f"异常大数: {num_str}")
                continue
            # 当 valid_numbers 提供时，若与有效数字差距过大则视为幻觉
            if valid_set:
                # 仅当 response 中出现价格、月供等大头数字时验证
                if any(abs(num - v) / max(abs(v), 1) < 0.01 for v in valid_set):
                    continue
                # 不在 1% 容差内 → 仅在数字≥5000 时报警（避免与日期、电话号等混淆）
                if num >= 5000 and not any(
                    abs(num - v) / max(abs(v), 1) < 0.05 for v in valid_set
                ):
                    issues.append(f"未与工具返回值对齐的数字: {num_str}")

        return {
            "passed": len(issues) == 0,
            "issues": issues,
        }

    # ── 政策 ──

    def check_policy_claims(self, response: str) -> Dict[str, object]:
        issues: list[str] = []

        # 命中绝对化表述（无依据的承诺）
        for phrase in _ABSOLUTE_POLICY_PHRASES:
            if phrase in response:
                issues.append(f"出现绝对化承诺: '{phrase}'，无政策依据，禁止使用")

        # 法规引用但未给具体名称
        if re.search(r"根据国家.{0,8}规定", response):
            if not re.search(r"《[^》]{2,30}》", response):
                issues.append("引用了'国家规定'但缺少《具体法规》。")

        if re.search(r"(国家|建设部|住建部)发文", response):
            if not re.search(r"《[^》]{2,30}》", response):
                issues.append("引用了部委文件但缺少《文件名》。")

        return {
            "passed": len(issues) == 0,
            "issues": issues,
        }
