"""FinanceCalculator 节点：调用 ``calculate_mortgage`` / ``calculate_taxes``。

**严禁做数学运算**。所有结果必须来自工具返回值。
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List

from langchain_core.messages import AIMessage, SystemMessage

from agents.state import AgentState
from agents.prompts import FINANCE_CALCULATOR_PROMPT
from tools.base import set_db_context, calculate_mortgage, calculate_taxes
from agents.nodes.common import _maybe_web_search, _format_web_disclaimer, _has_realtime_intent


def _append_tool_step(state: AgentState, step: Dict[str, Any]) -> List[Dict[str, Any]]:
    steps = list(state.get("tool_steps") or [])
    steps.append({**step, "ts": datetime.now(timezone.utc).isoformat()})
    return steps


def _extract_number(text: str, *patterns: str) -> float | None:
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            try:
                return float(m.group(1))
            except (IndexError, ValueError):
                continue
    return None


def finance_calculator_node(state: AgentState, db) -> AgentState:
    """金融测算师：基于用户描述构造工具调用并返回月供、税费。"""
    set_db_context(db)
    query = state.get("user_message") or ""
    requirements = state.get("requirements") or {}

    price = (
        _extract_number(query, r"(\d+(?:\.\d+)?)\s*万")
        or requirements.get("max_price")
        or 0
    )
    down_payment_ratio = requirements.get("down_payment_ratio") or 0.3
    loan_term = requirements.get("loan_term") or 30
    is_second = "二套" in query or "二套房" in query
    has_pf = "公积金" in query
    # 默认面积 90㎡（便于演示；用户提及再覆盖）
    area = _extract_number(query, r"(\d+(?:\.\d+)?)\s*平") or 90.0
    years_owned = int(_extract_number(query, r"持有\s*(\d+)\s*年") or 0)
    is_first = not is_second

    steps: List[Dict[str, Any]] = list(state.get("tool_steps") or [])
    sources = list(state.get("sources") or [])

    mortgage: Dict[str, Any] = {}
    taxes: Dict[str, Any] = {}
    try:
        mortgage = calculate_mortgage.invoke({
            "price": price,
            "down_payment_ratio": down_payment_ratio,
            "loan_term": loan_term,
            "is_second_home": is_second,
            "has_provident_fund": has_pf,
        })
        steps.append({
            "tool": "calculate_mortgage",
            "args": {
                "price": price,
                "down_payment_ratio": down_payment_ratio,
                "loan_term": loan_term,
                "is_second_home": is_second,
                "has_provident_fund": has_pf,
            },
            "output": mortgage,
            "passed_visibility_check": True,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:  # noqa: BLE001
        steps.append({
            "tool": "calculate_mortgage",
            "args": {},
            "output": {"error": str(e)},
            "passed_visibility_check": False,
            "ts": datetime.now(timezone.utc).isoformat(),
        })

    if "税" in query or "契税" in query or "费" in query:
        try:
            taxes = calculate_taxes.invoke({
                "price": price,
                "area": area,
                "is_first_home": is_first,
                "years_owned": years_owned,
            })
            steps.append({
                "tool": "calculate_taxes",
                "args": {
                    "price": price,
                    "area": area,
                    "is_first_home": is_first,
                    "years_owned": years_owned,
                },
                "output": taxes,
                "passed_visibility_check": True,
                "ts": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:  # noqa: BLE001
            steps.append({
                "tool": "calculate_taxes",
                "args": {},
                "output": {"error": str(e)},
                "passed_visibility_check": False,
                "ts": datetime.now(timezone.utc).isoformat(),
            })

    # ── Web search for realtime rate/policy context ──
    web_disclaimer = ""
    if _has_realtime_intent(query):
        local_results = [{"similarity": 1.0}]
        web_result, ws_reason = _maybe_web_search(query, local_results, threshold=0.3)
        if web_result:
            steps.append({
                "tool": "web_search",
                "args": {"query": query, "top_k": 5},
                "output": web_result,
                "passed_visibility_check": True,
                "ts": datetime.now(timezone.utc).isoformat(),
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

    # 构造 final_answer —— 完全基于工具返回值
    final_lines: list[str] = []
    if mortgage:
        final_lines.append(
            f"按 {price:.0f}万 总价、{down_payment_ratio*100:.0f}% 首付、{loan_term} 年期、"
            f"{'二套' if is_second else '首套'}、{'含公积金' if has_pf else '纯商贷'} 测算：\n"
            f"- 月供约 {mortgage.get('monthly_payment', 0):.2f} 万元\n"
            f"- 总还款 {mortgage.get('total_payment', 0):.2f} 万元\n"
            f"- 利息合计 {mortgage.get('total_interest', 0):.2f} 万元\n"
            f"- 利率来源：{mortgage.get('rate_source', 'system_configs.finance')}"
        )
    if taxes:
        final_lines.append(
            f"\n税费测算（{area:.0f}㎡，{'首套' if is_first else '二套'}，持有 {years_owned} 年）：\n"
            f"- 契税 {taxes.get('deed_tax', 0):.2f} 万元\n"
            f"- 增值税 {taxes.get('vat', 0):.2f} 万元\n"
            f"- 个税 {taxes.get('income_tax', 0):.2f} 万元\n"
            f"- 税费合计 {taxes.get('total_tax', 0):.2f} 万元\n"
            f"- 税率来源：{taxes.get('rate_source', 'system_configs.tax')}"
        )
    if not final_lines:
        final_lines.append("暂未生成计算结果，请提供更具体的价格/年限/是否二套等信息。")

    final = "\n".join(final_lines) + "\n\n（数字均由 calculate_mortgage / calculate_taxes 工具计算并写入 tool_steps）"
    if web_disclaimer:
        final += "\n\n" + web_disclaimer

    return {
        **state,
        "tool_steps": steps,
        "sources": sources + [
            {"ref_type": "tool", "tool": "calculate_mortgage"},
        ] + ([{"ref_type": "tool", "tool": "calculate_taxes"}] if taxes else []),
        "final_answer": final,
        "messages": [
            SystemMessage(content=FINANCE_CALCULATOR_PROMPT),
            AIMessage(content=json.dumps({
                "node": "finance_calculator",
                "mortgage_keys": list(mortgage.keys()),
                "taxes_keys": list(taxes.keys()),
            }, ensure_ascii=False)),
        ],
    }
