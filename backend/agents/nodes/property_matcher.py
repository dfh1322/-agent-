"""PropertyMatcher 节点：调用 ``search_properties`` 真实检索楼盘。"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from langchain_core.messages import AIMessage, SystemMessage

from agents.state import AgentState
from agents.prompts import PROPERTY_MATCHER_PROMPT
from tools.base import set_db_context, search_properties
from agents.nodes.common import _maybe_web_search, _format_web_disclaimer, _has_realtime_intent


def _append_tool_step(state: AgentState, step: Dict[str, Any]) -> List[Dict[str, Any]]:
    steps = list(state.get("tool_steps") or [])
    steps.append({**step, "ts": datetime.now(timezone.utc).isoformat()})
    return steps


def property_matcher_node(state: AgentState, db) -> AgentState:
    """调用 ``search_properties`` 检索在售楼盘。

    Args:
        state: 当前 Agent 状态。
        db: SQLAlchemy Session（由 FastAPI 依赖注入提供）。
    """
    requirements = state.get("requirements") or {}
    user_ctx = state.get("user_context") or {}

    # 行级权限：landlord 自动叠加 owner_id
    owner_filter = None
    if user_ctx.get("role") == "landlord" and not user_ctx.get("is_admin"):
        owner_filter = user_ctx.get("id")

    set_db_context(db)
    try:
        result = search_properties.invoke({
            "query": None,
            "district": requirements.get("district"),
            "min_price": requirements.get("min_price"),
            "max_price": requirements.get("max_price"),
            "min_area": requirements.get("min_area"),
            "max_area": requirements.get("max_area"),
            "bedrooms": requirements.get("bedrooms"),
            "owner_id": owner_filter,
            "limit": 5,
        })
    except Exception as e:  # noqa: BLE001
        result = {"count": 0, "items": [], "error": str(e)}

    items = result.get("items") or []
    query = state.get("user_message") or ""
    sources: list[dict] = [{"ref_type": "property", "id": it["id"], "name": it["name"]} for it in items]

    tool_step: dict = {
        "tool": "search_properties",
        "args": {
            "district": requirements.get("district"),
            "min_price": requirements.get("min_price"),
            "max_price": requirements.get("max_price"),
            "bedrooms": requirements.get("bedrooms"),
            "owner_id": owner_filter,
            "limit": 5,
        },
        "output": result,
        "passed_visibility_check": True,
    }
    steps_before = list(state.get("tool_steps") or [])
    ts = datetime.now(timezone.utc).isoformat()

    # ── Unified web search fallback for property queries ──
    local_results = [{"similarity": 0.5 if items else 0.0}]
    web_result, ws_reason = _maybe_web_search(query, local_results, threshold=0.3)

    web_disclaimer = ""
    if web_result:
        steps_before.append({
            "tool": "web_search",
            "args": {"query": query, "top_k": 5},
            "output": web_result,
            "passed_visibility_check": True,
            "ts": ts,
        })
        if web_result.get("items"):
            web_disclaimer = _format_web_disclaimer(web_result, ws_reason)
            for w in web_result["items"]:
                sources.append({
                    "ref_type": "web_search",
                    "title": w.get("title"),
                    "url": w.get("url"),
                    "snippet": w.get("snippet"),
                    "source_type": w.get("source_type", "web_search"),
                    "risk_labeled": True,
                })

    steps_before.append({**tool_step, "ts": ts})

    # Determine if this is a realtime / market-price query
    is_market_query = _has_realtime_intent(query)

    if is_market_query and web_disclaimer:
        # ── Market price / realtime query: web data is PRIMARY source ──
        db_lines = []
        if items:
            db_lines.append(
                "🏠 **在售楼盘（供参考）：**\n"
                + "\n".join(
                    f"- {it['name']}（{it.get('district') or '未知区'}，"
                    f"{it.get('total_price_range') or '价格待询'}，"
                    f"{it.get('area_range') or '面积待询'}）"
                    for it in items
                )
            )
        final = web_disclaimer + "\n\n" + ("\n\n".join(db_lines) if db_lines else
            "暂未找到匹配的在售楼盘。"
        )
    elif items:
        # ── Standard property search: DB is PRIMARY source ──
        final = (
            f"为您匹配到 {len(items)} 个楼盘：\n"
            + "\n".join(
                f"- {it['name']}（{it.get('district') or '未知区'}，"
                f"{it.get('total_price_range') or '价格待询'}，"
                f"{it.get('area_range') or '面积待询'}）" for it in items
            )
            + (("\n\n" + web_disclaimer) if web_disclaimer else "")
        )
    elif web_disclaimer:
        final = (
            "暂未找到匹配的在售楼盘。以下为网络搜索参考：\n\n"
            + web_disclaimer
        )
    else:
        conds = []
        if requirements.get("district"):
            conds.append(f"区域={requirements['district']}")
        if requirements.get("max_price"):
            conds.append(f"预算≤{requirements['max_price']}万")
        if requirements.get("bedrooms"):
            conds.append(f"{requirements['bedrooms']}室")
        cond_str = "、".join(conds) if conds else "当前条件"
        final = (
            f"已为您按{cond_str}搜索，暂未找到匹配的在售楼盘。\n"
            "建议放宽区域或预算后再试，也可以告诉我更多需求（如户型、面积等）。"
        )

    existing_sources = list(state.get("sources") or [])
    existing_steps = list(state.get("tool_steps") or [])

    return {
        **state,
        "tool_steps": existing_steps + steps_before,
        "sources": existing_sources + sources,
        "final_answer": final,
        "messages": [
            SystemMessage(content=PROPERTY_MATCHER_PROMPT),
            AIMessage(content=json.dumps({
                "node": "property_matcher",
                "match_count": len(items),
                "items": [ {"id": it["id"], "name": it["name"]} for it in items ],
            }, ensure_ascii=False)),
        ],
    }
