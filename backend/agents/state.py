"""LangGraph 状态机 — ``AgentState`` TypedDict 定义。

依据 CLAUDE.md 5.1：必须在每次节点调用前携带：
    * 完整的对话消息列表（``messages``）。
    * 当前意图（``intent``）。
    * 已抽取的用户需求（``requirements``）。
    * 工具调用链（``tool_steps``），用于 FactChecker 比对与回溯。
    * 最终答复（``final_answer``）。
    * 信息来源引用（``sources``），便于前端展示可溯源。
"""
from __future__ import annotations

from typing import Annotated, Any, Dict, List, Literal, Optional, TypedDict

from langgraph.graph.message import add_messages


IntentType = Literal["property", "policy", "finance", "faq", "general", "weather", "tools_choice"]


class ToolStep(TypedDict, total=False):
    """工具调用单步审计记录。"""
    tool: str
    args: Dict[str, Any]
    output: Any
    ts: str  # ISO 时间戳，由调用方填充
    passed_visibility_check: bool


class AgentState(TypedDict, total=False):
    """LangGraph Agent 多智能体状态机的全局状态。"""

    # LangGraph 内置对话历史（自动合并 messages）
    messages: Annotated[List[Any], add_messages]

    # 用户身份 / 偏好上下文
    user_context: Dict[str, Any]  # id / username / role / preferences

    # 意图分发
    intent: IntentType

    # 需求分析节点的产出
    requirements: Dict[str, Any]  # district / city / budget / bedrooms / metro ...
    needs_clarification: bool

    # 工具调用链（每个节点追加）
    tool_steps: List[ToolStep]

    # 信息来源（policy / faq / knowledge_docs / properties）
    sources: List[Dict[str, Any]]

    # 工具选择的工具集（Supervisor 决定本次要路由到的子 Agent）
    needs_finance_calc: bool
    needs_property_search: bool
    needs_policy_lookup: bool

    # 最终响应
    final_answer: str

    # 防幻觉校验结果
    guard_result: Dict[str, Any]

    # 会话/消息持久化相关
    session_id: str
    db_user_id: int
    user_message: str  # 当前轮用户的原始输入
    assistant_message: str  # 当前轮节点最终输出，下游负责持久化
