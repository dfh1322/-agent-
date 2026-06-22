"""PolicyExpert 节点：基于 ChromaDB 元数据 + MySQL policies/faqs 检索。

当 ChromaDB 与 MySQL 全部返回空时，会按用户问题强制调用 ``web_search``
网络检索工具当作"兜底参考"——结果上会同时附上"网络内容"来源与免责声明，
避免 Agent 编造结论（CLAUDE.md §6）。
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from langchain_core.messages import AIMessage, SystemMessage

from agents.state import AgentState
from agents.prompts import POLICY_EXPERT_PROMPT
from tools.base import set_db_context, search_policy, search_faq, search_knowledge_docs

from agents.nodes.common import _maybe_web_search, _format_web_disclaimer


def _append_tool_step(state: AgentState, step: Dict[str, Any]) -> List[Dict[str, Any]]:
    steps = list(state.get("tool_steps") or [])
    steps.append({**step, "ts": datetime.now(timezone.utc).isoformat()})
    return steps


def policy_expert_node(state: AgentState, db) -> AgentState:
    query = state.get("user_message") or ""
    set_db_context(db)

    steps: List[Dict[str, Any]] = list(state.get("tool_steps") or [])
    sources: List[Dict[str, Any]] = list(state.get("sources") or [])
    final_parts: List[str] = []
    any_data = False

    try:
        policy_res = search_policy.invoke({"keyword": query, "top_k": 3})
        steps.append({
            "tool": "search_policy",
            "args": {"keyword": query, "top_k": 3},
            "output": policy_res,
            "passed_visibility_check": True,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        if policy_res.get("items"):
            any_data = True
            for p in policy_res["items"]:
                sources.append({
                    "ref_type": "policy",
                    "id": p["id"],
                    "title": p["title"],
                    "source": p.get("source"),
                    "effective_date": p.get("effective_date"),
                })
                final_parts.append(
                    f"【{p['title']}】({p.get('source') or '官方'}，生效：{p.get('effective_date') or '—'})\n"
                    f"{p['content'][:600]}{'…' if len(p['content']) > 600 else ''}"
                )
    except Exception as e:  # noqa: BLE001
        steps.append({"tool": "search_policy", "args": {}, "output": {"error": str(e)}, "ts": datetime.now(timezone.utc).isoformat()})

    try:
        faq_res = search_faq.invoke({"query": query, "top_k": 2})
        steps.append({
            "tool": "search_faq",
            "args": {"query": query, "top_k": 2},
            "output": faq_res,
            "passed_visibility_check": True,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        if faq_res.get("items"):
            any_data = True
            for f in faq_res["items"]:
                sources.append({
                    "ref_type": "faq",
                    "id": f["id"],
                    "title": f["question"],
                    "category": f.get("category"),
                })
                final_parts.append(
                    f"FAQ｜问：{f['question']}\n答：{f['answer'][:500]}{'…' if len(f['answer']) > 500 else ''}"
                )
    except Exception as e:  # noqa: BLE001
        steps.append({"tool": "search_faq", "args": {}, "output": {"error": str(e)}, "ts": datetime.now(timezone.utc).isoformat()})

    try:
        kdoc_res = search_knowledge_docs.invoke({"query": query, "top_k": 2})
        steps.append({
            "tool": "search_knowledge_docs",
            "args": {"query": query, "top_k": 2},
            "output": kdoc_res,
            "passed_visibility_check": True,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        if kdoc_res.get("items"):
            any_data = True
            for d in kdoc_res["items"]:
                sources.append({
                    "ref_type": "knowledge_doc",
                    "id": d["id"],
                    "title": d["title"],
                    "doc_type": d.get("doc_type"),
                })
                final_parts.append(
                    f"【{d['title']}】(类型：{d.get('doc_type') or '通用'})\n{d['content'][:500]}{'…' if len(d['content']) > 500 else ''}"
                )
    except Exception as e:  # noqa: BLE001
        steps.append({"tool": "search_knowledge_docs", "args": {}, "output": {"error": str(e)}, "ts": datetime.now(timezone.utc).isoformat()})

    # ── Unified web search fallback ──
    local_results = [
        s.get("output", {}) for s in steps
        if s.get("tool") in ("search_policy", "search_faq", "search_knowledge_docs")
    ]

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
            any_data = True
            disclaimer = _format_web_disclaimer(web_result, ws_reason)
            final_parts.append(disclaimer)
            for w in web_result["items"]:
                sources.append({
                    "ref_type": "web_search",
                    "title": w.get("title"),
                    "url": w.get("url"),
                    "snippet": w.get("snippet"),
                    "source_type": w.get("source_type", "web_search"),
                    "risk_labeled": True,
                })

    if not any_data:
        final = "抱歉，暂未找到相关的购房政策信息，建议咨询当地住建部门或换个关键词试试。"
    else:
        final = "\n\n".join(final_parts)

    return {
        **state,
        "tool_steps": steps,
        "sources": sources,
        "final_answer": final,
        "messages": [
            SystemMessage(content=POLICY_EXPERT_PROMPT),
            AIMessage(content=json.dumps({
                "node": "policy_expert",
                "any_data": any_data,
                "tool_calls": [s["tool"] for s in steps if "tool" in s],
            }, ensure_ascii=False)),
        ],
    }
