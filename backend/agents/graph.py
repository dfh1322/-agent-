"""LangGraph 状态机构建。

入口 ``build_graph()`` 返回 ``CompiledStateGraph``；对外暴露 ``run_agent`` 同步入口
（路由层调用），以及 ``stream_agent`` 流式接口。

设计要点：
    * 5+1 节点：requirement_analyst → supervisor → [property_matcher / finance_calculator / policy_expert] → fact_checker → END。
    * ``start_node`` 函数包裹每个节点，使节点可以接收 ``(state, db)`` 而不仅是 ``state``，
      本质是在 LangGraph 节点的 Runnable 闭包内捕获 ``db``，不污染 AgentState。
    * ``agent.py`` 保持兼容：原 ``HouseAgent.chat()`` 接口仍可调用，方法内部委托到此处。
"""
from __future__ import annotations

from typing import Any, AsyncGenerator, Dict, List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.state import AgentState
from agents.nodes.requirement_analyst import requirement_analyst_node
from agents.nodes.supervisor import supervisor_node, route_intent
from agents.nodes.property_matcher import property_matcher_node
from agents.nodes.finance_calculator import finance_calculator_node
from agents.nodes.policy_expert import policy_expert_node
from agents.nodes.fact_checker import fact_checker_node
from agents.nodes.general_fallback import general_fallback_node


# 提前 import 关联模型，确保 SQLAlchemy 关系能在 Community/Message 等
# 关系的字符串引用（``relationship("Community")``）解析时找到目标类。
from models.user import User  # noqa: F401, E402
from models.property import (  # noqa: F401, E402
    Message,
    Conversation,
)


# ── 节点闭包（注入 db） ──────────────────────────────────────────────────

def make_start_node(db):
    def _start(state: AgentState) -> AgentState:
        # Record the original user message for downstream nodes
        msgs = state.get("messages") or []
        user_text = state.get("user_message") or ""
        if not user_text and msgs:
            from langchain_core.messages import HumanMessage
            for m in reversed(msgs):
                if isinstance(m, HumanMessage) or (hasattr(m, "type") and getattr(m, "type", "") == "human"):
                    user_text = m.content if hasattr(m, "content") else str(m)
                    break
        return {
            **state,
            # 新一轮强制清空上轮 final_answer —— 避免用户后续输入未触发下
            # 游子 Agent 时，UI 直接显示上一轮答复造成"复读机"的错觉。
            "final_answer": "",
            "tool_steps": state.get("tool_steps") or [],
            "sources": state.get("sources") or [],
            "user_message": user_text,
        }
    return _start


def make_requirement_node():
    def _node(state: AgentState) -> AgentState:
        return requirement_analyst_node(state)
    return _node


def make_supervisor_node():
    def _node(state: AgentState) -> AgentState:
        return supervisor_node(state)
    return _node


def make_property_node(db):
    def _node(state: AgentState) -> AgentState:
        return property_matcher_node(state, db)
    return _node


def make_finance_node(db):
    def _node(state: AgentState) -> AgentState:
        return finance_calculator_node(state, db)
    return _node


def make_policy_node(db):
    def _node(state: AgentState) -> AgentState:
        return policy_expert_node(state, db)
    return _node


def make_fact_node():
    def _node(state: AgentState) -> AgentState:
        return fact_checker_node(state)
    return _node


# ── 路由函数复用 supervisor.route_intent，并在 fact_checker 后结束 ─────


def build_graph(db):
    """构建 LangGraph 状态机。

    Args:
        db: SQLAlchemy Session。
    """
    g = StateGraph(AgentState)

    g.add_node("start", make_start_node(db))
    g.add_node("requirement_analyst", make_requirement_node())
    g.add_node("supervisor", make_supervisor_node())
    g.add_node("property_matcher", make_property_node(db))
    g.add_node("finance_calculator", make_finance_node(db))
    g.add_node("policy_expert", make_policy_node(db))
    g.add_node("fact_checker", make_fact_node())
    g.add_node("end_clarify", _need_clarify_end_node)
    g.add_node("general_fallback", general_fallback_node)

    g.add_edge(START, "start")
    g.add_edge("start", "requirement_analyst")
    g.add_edge("requirement_analyst", "supervisor")

    g.add_conditional_edges(
        "supervisor",
        route_intent,
        {
            "property_matcher": "property_matcher",
            "finance_calculator": "finance_calculator",
            "policy_expert": "policy_expert",
            "general_fallback": "general_fallback",
            "end": "end_clarify",
        },
    )

    g.add_edge("property_matcher", "fact_checker")
    g.add_edge("finance_calculator", "fact_checker")
    g.add_edge("policy_expert", "fact_checker")
    g.add_edge("general_fallback", END)
    g.add_edge("fact_checker", END)
    g.add_edge("end_clarify", END)

    return g.compile()


def _need_clarify_end_node(state: AgentState) -> AgentState:
    """把 draft_response 提升为 final_answer，并清空下游状态。"""
    final = state.get("final_answer") or ""
    return {
        **state,
        "final_answer": final or "请提供更具体的购房需求，方便我为您继续推荐。",
        "guard_result": {"passed": True, "issues": [], "skip_reason": "needs_clarification"},
    }


# ── 对外封装 ────────────────────────────────────────────────────────────

def _initial_state(
    user_message: str,
    user_context: Optional[Dict[str, Any]] = None,
    session_id: str = "",
    db_user_id: int = 0,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    from langchain_core.messages import HumanMessage
    msgs = [HumanMessage(content=user_message)]
    if conversation_history:
        from langchain_core.messages import AIMessage
        for h in conversation_history[-6:]:
            if h.get("role") == "user":
                msgs.append(HumanMessage(content=h["content"]))
            elif h.get("role") == "assistant":
                msgs.append(AIMessage(content=h["content"]))
    return {
        "messages": msgs,
        "user_context": user_context or {},
        "intent": "general",
        "requirements": {},
        "needs_clarification": False,
        "tool_steps": [],
        "sources": [],
        "needs_finance_calc": False,
        "needs_property_search": False,
        "needs_policy_lookup": False,
        "final_answer": "",
        "guard_result": {},
        "session_id": session_id,
        "db_user_id": db_user_id,
        "user_message": user_message,
        "assistant_message": "",
    }


async def run_agent(
    db,
    user_message: str,
    user_context: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    session_id: str = "",
    db_user_id: int = 0,
) -> Dict[str, Any]:
    """同步执行整个 LangGraph 流水线，返回最终状态。"""
    graph = build_graph(db)
    state = _initial_state(
        user_message=user_message,
        user_context=user_context,
        session_id=session_id,
        db_user_id=db_user_id,
        conversation_history=conversation_history or [],
    )
    out = await graph.ainvoke(state)
    return out


async def stream_agent(
    db,
    user_message: str,
    user_context: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    session_id: str = "",
    db_user_id: int = 0,
):
    """流式（SSE）执行 LangGraph：逐节点 yield 已完成的 sub-state。"""
    graph = build_graph(db)
    state = _initial_state(
        user_message=user_message,
        user_context=user_context,
        session_id=session_id,
        db_user_id=db_user_id,
        conversation_history=conversation_history or [],
    )
    async for event in graph.astream(state, stream_mode="values"):
        yield event
