"""房产咨询主 Agent — 委派给 LangGraph 状态机。

本模块保留旧 HouseAgent 类的兼容性入口，但内部已重写为"驱动 agents.graph"。
真正的多智能体协同在新模块中实现（requirement_analyst / supervisor /
property_matcher / finance_calculator / policy_expert / fact_checker）。
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional

from sqlalchemy.orm import Session

from agents.hallucination_guard import HallucinationGuard
from agents.graph import run_agent, stream_agent
from config.database import SessionLocal


class HouseAgent:
    """房产咨询 Agent — 通过 LangGraph 驱动多智能体协作。

    保留 ``chat()`` / ``chat_stream()`` 接口，让 routes 无需大规模修改。
    """

    GUARDRAIL_SYSTEM_PROMPT = (
        "你是专业、友好的房产顾问，名叫「房产小智」。"
        "严格遵守 CLAUDE.md 第 6 节防幻觉条款；"
        "所有数据必须来自 MySQL 与 ChromaDB 检索。"
    )

    def __init__(self, model_name: Optional[str] = None):
        # 保留参数以兼容旧代码；当前实现不直接调用 LLM。
        self.model_name = model_name or "deepseek-v3"
        self.guardrail = HallucinationGuard()

    async def chat(
        self,
        user_query: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        session_id: Optional[str] = None,
        user_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """驱动 LangGraph 状态机，返回结构化结果。"""
        sid = session_id or str(uuid.uuid4())

        db = SessionLocal()
        try:
            state = await run_agent(
                db=db,
                user_message=user_query,
                user_context=user_context or {},
                conversation_history=conversation_history,
                session_id=sid,
            )
        finally:
            db.close()

        final = state.get("final_answer") or ""
        return {
            "content": final,
            "tool_calls": [
                { "tool": s.get("tool"), "input": s.get("args"), "observation": s.get("output") }
                for s in (state.get("tool_steps") or [])
            ],
            "tool_steps": state.get("tool_steps") or [],
            "guard_result": state.get("guard_result") or {},
            "sources": state.get("sources") or [],
            "intent": state.get("intent"),
            "requirements": state.get("requirements") or {},
            "session_id": sid,
            "mode": "property" if state.get("intent") in {"property", "finance", "policy", "faq"} else "general",
        }

    async def chat_stream(
        self,
        user_query: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        session_id: Optional[str] = None,
        user_context: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """逐节点流式 yield 事件；与 ``chat()`` 输入输出一致但可实时观察。"""
        sid = session_id or str(uuid.uuid4())

        yield {"type": "start", "session_id": sid}

        db = SessionLocal()
        try:
            tool_calls_log: List[Dict[str, Any]] = []
            buffer: List[str] = []
            final_state: Dict[str, Any] = {}
            async for state in stream_agent(
                db=db,
                user_message=user_query,
                user_context=user_context or {},
                conversation_history=conversation_history or [],
                session_id=sid,
            ):
                # 跟踪工具调用
                for s in state.get("tool_steps") or []:
                    if not any(t.get("tool") == s.get("tool") and t.get("args") == s.get("args") for t in tool_calls_log):
                        tool_calls_log.append({
                            "tool": s.get("tool"),
                            "input": s.get("args"),
                            "observation": s.get("output"),
                        })
                        yield {
                            "type": "tool_call",
                            "tool": s.get("tool"),
                            "input": s.get("args"),
                        }
                final_state = state
            # 收尾：吐 token 模拟（最终答复）
            content = final_state.get("final_answer") or ""
            if content:
                for chunk in _chunk_text(content, size=12):
                    yield {"type": "token", "token": chunk}
                yield {
                    "type": "end",
                    "content": content,
                    "tool_calls": tool_calls_log,
                    "guard_result": final_state.get("guard_result") or {},
                    "sources": final_state.get("sources") or [],
                    "intent": final_state.get("intent"),
                    "mode": "property" if final_state.get("intent") in {"property", "finance", "policy", "faq"} else "general",
                    "session_id": sid,
                }
        except Exception as e:  # noqa: BLE001
            yield {"type": "error", "error": str(e), "session_id": sid}
        finally:
            db.close()


def _chunk_text(text: str, size: int = 16) -> List[str]:
    """简易分块，按 size 字符切分，用于 SSE token 模拟。"""
    return [text[i:i + size] for i in range(0, len(text), size)]
