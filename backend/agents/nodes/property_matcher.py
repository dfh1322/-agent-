"""PropertyMatcher 节点：调用 ``search_properties`` 真实检索楼盘。"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from langchain_core.messages import AIMessage, SystemMessage

from agents.state import AgentState
from agents.prompts import PROPERTY_MATCHER_PROMPT
from tools.base import set_db_context, search_properties, search_units
from agents.nodes.common import _maybe_web_search, _format_web_disclaimer, _has_realtime_intent


def _append_tool_step(state: AgentState, step: Dict[str, Any]) -> List[Dict[str, Any]]:
    steps = list(state.get("tool_steps") or [])
    steps.append({**step, "ts": datetime.now(timezone.utc).isoformat()})
    return steps


def property_matcher_node(state: AgentState, db) -> AgentState:
    """调用 ``search_properties`` 检索在售楼盘。结果 ≤ 1 条时自动放宽条件重试。

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

    def _do_search(kwargs: dict) -> dict:
        try:
            return search_properties.invoke(kwargs)
        except Exception:  # noqa: BLE001
            return {"count": 0, "items": [], "error": "tool_error"}

    def _do_unit_search(kwargs: dict) -> dict:
        try:
            return search_units.invoke(kwargs)
        except Exception:
            return {"count": 0, "items": [], "error": "tool_error"}

    # 检查是否有精确的户型级需求（需走 search_units）
    has_precise = any([
        requirements.get("floor_preference"),
        requirements.get("orientation"),
    ])

    if has_precise:
        unit_args = {
            "district": requirements.get("district"),
            "min_price": requirements.get("min_price"),
            "max_price": requirements.get("max_price"),
            "min_area": requirements.get("min_area"),
            "max_area": requirements.get("max_area"),
            "bedrooms": requirements.get("bedrooms"),
            "orientation": requirements.get("orientation"),
            "status_tag": "在售",
            "limit": 10,
        }
        fp = requirements.get("floor_preference")
        if fp == "高楼层":
            unit_args["floor_min"] = 15
        elif fp == "中楼层":
            unit_args["floor_min"] = 8
            unit_args["floor_max"] = 14
        elif fp == "低楼层":
            unit_args["floor_max"] = 7

        unit_result = _do_unit_search(unit_args)
        unit_items = unit_result.get("items") or []
        if unit_items:
            items = []
            seen_cids = set()
            for u in unit_items:
                cid = u.get("community_id")
                if cid and cid not in seen_cids:
                    seen_cids.add(cid)
                    items.append({
                        "id": cid,
                        "name": u.get("community_name"),
                        "district": u.get("district"),
                        "address": None,
                        "developer": None,
                        "building_count": 1,
                        "price_per_sqm": None,
                        "total_price_range": f"{u.get('total_price')} 万",
                        "area_range": str(u.get("area")) + " ㎡" if u.get("area") else None,
                        "decoration": None,
                        "metro": None,
                        "school": None,
                        "green_rate": None,
                        "tags": None,
                        "floor_min": None,
                        "floor_max": None,
                        "floor": None,
                        "is_featured": False,
                        "available_units_count": sum(
                            1 for x in unit_items if x.get("community_id") == cid
                        ),
                        "unit_price_min": min(
                            x["total_price"] for x in unit_items
                            if x.get("community_id") == cid and x.get("total_price")
                        ) if unit_items else None,
                        "unit_price_max": max(
                            x["total_price"] for x in unit_items
                            if x.get("community_id") == cid and x.get("total_price")
                        ) if unit_items else None,
                        "unit_price_range": None,
                        "sample_units": [
                            {"room_number": x["room_number"], "floor": x["floor"],
                             "total_price": x["total_price"], "orientation": x["orientation"]}
                            for x in unit_items if x.get("community_id") == cid
                        ][:5],
                    })
            # 跳过第一轮搜索，直接用 unit 结果
            result = {"count": len(items), "items": items}
            relaxed = False
            # 跳过宽松回退
            sources = [{"ref_type": "property", "id": it["id"], "name": it["name"]} for it in items]
            steps = [{
                "tool": "search_units",
                "args": unit_args,
                "output": {"count": len(items), "relaxed": False},
                "passed_visibility_check": True,
                "ts": datetime.now(timezone.utc).isoformat(),
            }]
            # 直接跳到结果格式化
            ts = datetime.now(timezone.utc).isoformat()
            steps_before: list[dict] = list(state.get("tool_steps") or []) + steps
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

            is_market_query = _has_realtime_intent(query)
            if items:
                prefix = f"为您匹配到 {len(items)} 个小区（精确匹配楼层/朝向）："
                final = (
                    prefix + "\n"
                    + "\n".join(
                        f"- {it['name']}（{it.get('district') or '未知区'}，"
                        f"{it.get('total_price_range') or '价格待询'}，"
                        f"{it.get('area_range') or '面积待询'}，"
                        f"共{it.get('building_count', 1)}栋楼，"
                        f"{it.get('available_units_count', 0)}套在售）" for it in items
                    )
                    + (("\n\n" + web_disclaimer) if web_disclaimer else "")
                )
            else:
                final = "暂未找到匹配的房源，请放宽楼层或朝向条件后再试。"

            existing_sources = list(state.get("sources") or [])
            existing_steps = list(state.get("tool_steps") or [])
            return {
                **state,
                "tool_steps": existing_steps + steps,
                "sources": existing_sources + sources,
                "final_answer": final,
                "messages": [
                    SystemMessage(content=PROPERTY_MATCHER_PROMPT),
                    AIMessage(content=json.dumps({
                        "node": "property_matcher",
                        "match_count": len(items),
                        "relaxed_search": False,
                        "items": [{"id": it["id"], "name": it["name"]} for it in items],
                    }, ensure_ascii=False)),
                ],
            }

    # 无精确需求时，走原有搜索路径
    # ── 第一轮搜索 ──
    primary_args = {
        "query": None,
        "district": requirements.get("district"),
        "min_price": requirements.get("min_price"),
        "max_price": requirements.get("max_price"),
        "min_area": requirements.get("min_area"),
        "max_area": requirements.get("max_area"),
        "bedrooms": requirements.get("bedrooms"),
        "owner_id": owner_filter,
        "floor_preference": requirements.get("floor_preference"),
        "limit": 5,
    }
    result = _do_search(primary_args)

    items = result.get("items") or []
    relaxed = False

    # ── 宽松回退：结果 ≤ 1 条时放宽条件 ──
    if len(items) <= 1:
        relaxed_args: dict = {}
        budget = requirements.get("max_price")
        if budget and budget > 0:
            relaxed_args["max_price"] = budget * 1.5
            if requirements.get("min_price"):
                relaxed_args["min_price"] = requirements["min_price"] * 0.6
            else:
                relaxed_args["min_price"] = None
        bdr = requirements.get("bedrooms")
        if bdr and bdr > 0:
            relaxed_args["bedrooms"] = None
        # 去掉区域限制
        relaxed_args["district"] = None
        relaxed_args["query"] = None
        relaxed_args["min_area"] = None
        relaxed_args["max_area"] = None
        relaxed_args["floor_preference"] = None
        relaxed_args["owner_id"] = owner_filter
        relaxed_args["limit"] = 8

        fallback = _do_search(relaxed_args)
        fallback_items = fallback.get("items") or []
        if len(fallback_items) > len(items):
            items = fallback_items
            relaxed = True
        elif len(fallback_items) == 0 and len(items) == 0:
            # 完全无结果：取最便宜的N条让用户看到有什么
            any_args = {
                "query": None, "district": None, "min_price": None,
                "max_price": None, "min_area": None, "max_area": None,
                "bedrooms": None, "owner_id": owner_filter, "limit": 6,
            }
            any_fallback = _do_search(any_args)
            any_items = any_fallback.get("items") or []
            if any_items:
                items = any_items
                relaxed = True

    query = state.get("user_message") or ""
    sources: list[dict] = [{"ref_type": "property", "id": it["id"], "name": it["name"]} for it in items]

    steps = [{
        "tool": "search_properties",
        "args": primary_args,
        "output": {"count": len(result.get("items") or []), "relaxed": False},
        "passed_visibility_check": True,
        "ts": datetime.now(timezone.utc).isoformat(),
    }]

    if relaxed:
        steps.append({
            "tool": "search_properties_relaxed",
            "args": {
                "reason": "initial result <= 1, broadened budget/rooms/district",
                "applied": {
                    "max_price": budget * 1.5 if (requirements.get("max_price") or 0) > 0 else None,
                    "bedrooms": None,
                    "district": None,
                    "fallback_to_cheapest": len(items) > 0 and len(result.get("items") or []) == 0,
                },
            },
            "output": {"count": len(items)},
            "passed_visibility_check": True,
            "ts": datetime.now(timezone.utc).isoformat(),
        })

    ts = datetime.now(timezone.utc).isoformat()
    steps_before: list[dict] = list(state.get("tool_steps") or []) + steps
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

    existing_sources = list(state.get("sources") or [])
    existing_steps = list(state.get("tool_steps") or [])

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
        prefix = "为您找到以下几个相近小区：" if relaxed else f"为您匹配到 {len(items)} 个小区："
        final = (
            prefix + "\n"
            + "\n".join(
                f"- {it['name']}（{it.get('district') or '未知区'}，"
                f"{it.get('total_price_range') or '价格待询'}，"
                f"{it.get('area_range') or '面积待询'}，"
                f"共{it.get('building_count', 1)}栋楼）" for it in items
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
            f"已为您按{cond_str}搜索，暂未找到匹配的在售小区。\n"
            "建议放宽区域或预算后再试，也可以告诉我更多需求（如户型、面积等）。"
        )

    existing_sources = list(state.get("sources") or [])
    existing_steps = list(state.get("tool_steps") or [])

    return {
        **state,
        "tool_steps": existing_steps + steps,
        "sources": existing_sources + sources,
        "final_answer": final,
        "messages": [
            SystemMessage(content=PROPERTY_MATCHER_PROMPT),
            AIMessage(content=json.dumps({
                "node": "property_matcher",
                "match_count": len(items),
                "relaxed_search": relaxed,
                "items": [ {"id": it["id"], "name": it["name"]} for it in items ],
            }, ensure_ascii=False)),
        ],
    }
