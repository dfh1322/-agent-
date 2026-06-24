"""FactChecker 节点：校验最终回复与工具返回值的一致性。

通过 ``agents.hallucination_guard.HallucinationGuard`` 完成三项检查：
    * 楼盘名校验（必须出现在 search_properties 输出里）
    * 数字校验（必须能匹配工具返回的月供/价格）
    * 政策校验（无需凭据匹配）

在此基础上额外承担"相似度阈值拦截"：当某次政策/FAQ 检索的
max similarity 低于 ``agents.prompts.SIMILARITY_THRESHOLD`` 时，直接把
``final_answer`` 替换为标准拒绝话术，绕过 LLM 的内容生成，保持 CLAUDE.md
§6 承诺。这是 ChromaDB 只接受 metadata 时的兜底实现，真向量库上线后可
改用真实的 cosine similarity。

LLM 润色不在本节点进行 —— 由 ``routers/chat.py`` 的 ``/chat/agent`` 端点在
LangGraph 完成后异步调用，避免在同步节点里嵌套 asyncio。
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Set, Tuple

from langchain_core.messages import AIMessage

from agents.state import AgentState
from agents.hallucination_guard import HallucinationGuard
from agents.prompts import SIMILARITY_THRESHOLD


POLICY_STANDARD_REFUSAL = "暂无相关本地政策信息，无法解答"
_SIM_HINT_RE = re.compile(r"<!--max_similarity=([0-9.]+)-->")


def _parse_max_similarity(tool_steps: List[Dict[str, Any]]) -> Tuple[float, List[str]]:
    """从工具输出中读出 max_similarity。

    兼容三种输出格式：
      * str 输出 — 扫描 ``<!--max_similarity=X-->`` 标记
      * dict 输出 — 取 ``max_similarity`` 键（search_policy 等工具新格式）
      * dict 输出 — 嵌套的 output 字段（LangGraph ToolNode 包装）
    """
    found_tags: List[str] = []
    sim = 0.0
    for step in tool_steps or []:
        out = step.get("output")
        sval: Any = None
        if isinstance(out, str):
            if "<!--max_similarity=" in out:
                m = _SIM_HINT_RE.search(out)
                if m:
                    try:
                        sim = max(sim, float(m.group(1)))
                        found_tags.append(f"{step.get('tool')}:{m.group(1)}")
                    except ValueError:
                        pass
        elif isinstance(out, dict):
            sval = out.get("max_similarity")
            if isinstance(sval, (int, float)):
                sim = max(sim, float(sval))
                found_tags.append(f"{step.get('tool')}:dict:{sval}")
            # 兼容嵌套在 items 内的结构 (AgentRetriever 风格)
            if not sval:
                inner = out.get("output")
                if isinstance(inner, dict):
                    sval = inner.get("max_similarity")
                    if isinstance(sval, (int, float)):
                        sim = max(sim, float(sval))
                        found_tags.append(f"{step.get('tool')}:nested:{sval}")
    return sim, found_tags


def _collect_property_names(tool_steps: List[Dict[str, Any]]) -> Set[str]:
    names: Set[str] = set()
    for step in tool_steps or []:
        output = step.get("output") or {}
        if not isinstance(output, dict):
            continue
        items = output.get("items") or []
        for it in items:
            name = it.get("name") if isinstance(it, dict) else None
            if name:
                names.add(name)
    return names


def _collect_numbers(tool_steps: List[Dict[str, Any]]) -> List[float]:
    nums: List[float] = []
    for step in tool_steps or []:
        output = step.get("output") or {}
        if not isinstance(output, dict):
            continue
        for key in (
            "monthly_payment",
            "down_payment",
            "loan_amount",
            "total_payment",
            "total_interest",
            "deed_tax",
            "vat",
            "income_tax",
            "total_tax",
        ):
            v = output.get(key)
            if isinstance(v, (int, float)):
                nums.append(float(v))
    return nums


def fact_checker_node(state: AgentState) -> AgentState:
    final = state.get("final_answer") or ""
    tool_steps = state.get("tool_steps") or []

    valid_props = _collect_property_names(tool_steps)
    valid_numbers = _collect_numbers(tool_steps)

    guard = HallucinationGuard()
    result = guard.full_check(final, valid_properties=valid_props, valid_numbers=valid_numbers)

    issues: List[str] = []
    for s in tool_steps:
        out = s.get("output") or {}
        if isinstance(out, dict) and "error" in out and not s.get("passed_visibility_check"):
            issues.append(f"工具 {s.get('tool')} 调用失败：{out.get('error')}")

    if result.get("issues"):
        issues.extend(result["issues"])

    # —— 相似度阈值拦截：政策/FAQ/Knowledge 检索若全部低于阈值，直接替换为标准拒绝话术 ——
    max_sim, sim_tags = _parse_max_similarity(tool_steps)
    policy_tools_used = any(
        t in (s.get("tool") or "") for s in tool_steps
        for t in ("search_policy", "search_faq", "search_knowledge_docs", "agent_retriever", "search_policies")
    )
    if policy_tools_used and max_sim < SIMILARITY_THRESHOLD:
        issues.append(
            f"政策类检索 max_similarity={max_sim:.3f} < 阈值 {SIMILARITY_THRESHOLD}，触发标准拒绝话术"
        )
        final = POLICY_STANDARD_REFUSAL

    final_answer = final
    if issues:
        # 仅将防幻觉校验项记录到 guard_result 供调试/日志，不再拼接到 final_answer
        # 暴露给用户——之前 "⚠️ 防幻觉提示：..." 显示在前端非常不专业。
        print(f"[fact_checker] 校验问题（未暴露给用户）: {issues}")

    return {
        **state,
        "final_answer": final_answer,
        "guard_result": {
            **result,
            "issues": issues,
            "valid_properties_count": len(valid_props),
            "max_retrieval_similarity": max_sim,
            "similarity_threshold": SIMILARITY_THRESHOLD,
            "policy_tools_used": policy_tools_used,
            "refused_due_to_threshold": bool(policy_tools_used and max_sim < SIMILARITY_THRESHOLD),
            "similarity_sources": sim_tags,
        },
        "messages": [
            AIMessage(content=f"fact_checker: issues={len(issues)} passed={len(issues) == 0}"),
        ],
    }
