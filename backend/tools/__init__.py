"""工具模块入口。

所有工具函数集中在 ``tools.base`` 中实现并注册；本文件只做 import 转发，
避免旧代码中存在"双份工具表"的隐患。

对外暴露：
    * ``TOOLS`` : ``@tool`` 列表，供 LangChain / LangGraph Agent 调用
    * ``set_db_context(db)`` : 让工具共享同一 SQLAlchemy Session
    * 各具体工具函数，便于测试或脚本直接调用
"""
from __future__ import annotations

from tools.base import (  # noqa: F401
    TOOLS,
    set_db_context,
    search_properties,
    get_property_detail,
    compare_properties,
    search_nearby_facilities,
    get_property_risks,
    calculate_mortgage,
    calculate_taxes,
    search_policy,
    search_faq,
    search_knowledge_docs,
    clarify_user_needs,
    get_weather_context,
)


__all__ = [
    "TOOLS",
    "set_db_context",
    "search_properties",
    "get_property_detail",
    "compare_properties",
    "search_nearby_facilities",
    "get_property_risks",
    "calculate_mortgage",
    "calculate_taxes",
    "search_policy",
    "search_faq",
    "search_knowledge_docs",
    "clarify_user_needs",
    "get_weather_context",
]
