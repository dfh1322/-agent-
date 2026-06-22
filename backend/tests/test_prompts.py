"""HALLUCINATION_GUARD 模板装配测试。

CLAUDE.md §6 第 3 条承诺"检索相似度 < 阈值 → 标准拒绝话术"。
如果 prompts.py 没有真正替换 ``{similarity_threshold}``，该规则根本不会
被 LLM 看到。本测试确保该字符串一定被数值替换。
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import pytest


# 让 import 能找到 backend/
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from agents.prompts import (  # noqa: E402
    HALLUCINATION_GUARD,
    HALLUCINATION_GUARD_TEMPLATE,
    build_hallucination_guard,
    SIMILARITY_THRESHOLD,
    REQUIREMENT_ANALYST_PROMPT,
    SUPERVISOR_PROMPT,
    PROPERTY_MATCHER_PROMPT,
    FINANCE_CALCULATOR_PROMPT,
    POLICY_EXPERT_PROMPT,
    FACT_CHECKER_PROMPT,
)


def test_threshold_placeholder_replaced():
    """编译后的 guard 字符串不能再含 ``{similarity_threshold}`` 字面量。"""
    placeholder = "{similarity_threshold}"
    assert placeholder not in HALLUCINATION_GUARD
    for compiled in (
        REQUIREMENT_ANALYST_PROMPT,
        SUPERVISOR_PROMPT,
        PROPERTY_MATCHER_PROMPT,
        FINANCE_CALCULATOR_PROMPT,
        POLICY_EXPERT_PROMPT,
        FACT_CHECKER_PROMPT,
    ):
        assert placeholder not in compiled, f"agent prompt still has placeholder: {compiled[:60]}"


def test_threshold_value_appears_in_guard():
    """编译后的 guard 字符串应包含具体的相似度数值。"""
    assert str(SIMILARITY_THRESHOLD) in HALLUCINATION_GUARD


def test_build_hallucination_guard_accepts_custom_threshold():
    """不同阈值能正确替换。"""
    custom = build_hallucination_guard(0.8)
    assert "{similarity_threshold}" not in custom
    assert "0.8" in custom


def test_threshold_clamped_to_0_1(monkeypatch):
    monkeypatch.setenv("SIMILARITY_THRESHOLD", "1.7")
    # 重新导入模块以读取新 env
    import importlib
    import agents.prompts as prompts_mod
    importlib.reload(prompts_mod)
    assert 0.0 <= prompts_mod.SIMILARITY_THRESHOLD <= 1.0


def test_threshold_default_used_when_missing(monkeypatch):
    monkeypatch.delenv("SIMILARITY_THRESHOLD", raising=False)
    import importlib
    import agents.prompts as prompts_mod
    importlib.reload(prompts_mod)
    assert prompts_mod.SIMILARITY_THRESHOLD == 0.5
