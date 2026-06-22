"""Shared helpers for domain nodes: web search fallback + risk disclaimer."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

REALTIME_KEYWORDS = (
    "最新", "新闻", "趋势", "行情", "动态", "变化",
    "调控", "新政", "房价走势", "房价", "均价", "楼市",
    "市场", "今年", "去年", "本周", "上周", "本月",
)

_SIM_RE = re.compile(r"<!--max_similarity=([0-9.]+)-->")


def _has_realtime_intent(query: str) -> bool:
    """Check if the user query contains realtime-oriented keywords."""
    q = (query or "").strip()
    return any(kw in q for kw in REALTIME_KEYWORDS)


def _max_local_similarity(local_results: List[Dict[str, Any]]) -> float:
    """Extract the highest similarity score from local tool results.

    Handles both dict output with ``similarity`` / ``max_similarity`` keys
    and ``<!--max_similarity=X-->`` comment tags in string output.
    """
    best = 0.0
    for r in (local_results or []):
        if isinstance(r, dict):
            s = r.get("similarity") or r.get("max_similarity")
            if isinstance(s, (int, float)):
                best = max(best, float(s))
            out = r.get("output", "")
            if isinstance(out, str) and "<!--max_similarity=" in out:
                m = _SIM_RE.search(out)
                if m:
                    try:
                        best = max(best, float(m.group(1)))
                    except ValueError:
                        pass
    return best


def _format_web_disclaimer(web_result: Dict[str, Any], reason: str) -> str:
    """Format web search results with a risk disclaimer.

    Args:
        web_result: Output from ``web_search.invoke()``.
        reason: Trigger reason — ``"realtime_keyword"`` or ``"low_similarity"``.

    Returns:
        Formatted string with results and disclaimer, or empty string if no items.
    """
    items = web_result.get("items") or []
    if not items:
        return ""

    label = "\U0001f310 网络公开信息"
    if reason == "realtime_keyword":
        prefix = f"{label}\n您的问题涉及当前市场动态，以下为网络公开信息：\n"
    else:
        prefix = f"{label}\n以下为网络公开信息，供参考：\n"

    lines = [prefix]
    for w in items:
        title = w.get("title", "")
        url = w.get("url", "")
        snippet = w.get("snippet", "")
        if title and url:
            lines.append(f"- [{title}]({url})\n  {snippet}")
        elif title:
            lines.append(f"- {title}\n  {snippet}")

    lines.append(
        "\n---\n"
        "⚠️ **免责声明：** 以上为网络公开信息，可能存在偏差或滞后，"
        "不构成本平台观点，请自行核实后参考。"
    )
    return "\n".join(lines)


def _maybe_web_search(
    query: str,
    local_results: List[Dict[str, Any]],
    threshold: float = 0.3,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Decide whether to invoke web search and return results with reason.

    Triggers when:
    1. Query contains realtime keywords (新闻, 最新, 趋势, etc.).
    2. Max local similarity is below *threshold* or no local results exist.

    Args:
        query: The user's original message.
        local_results: List of result dicts from local tool calls. Each should
            have a ``similarity`` or ``max_similarity`` field, or an ``output``
            string with a ``<!--max_similarity=X-->`` tag.
        threshold: Minimum acceptable similarity (0.0–1.0). Default 0.3.

    Returns:
        ``(web_result, reason)`` — ``web_result`` is the tool output dict or
        ``None``; ``reason`` is ``"realtime_keyword"``, ``"low_similarity"``,
        or ``None``.
    """
    reason: Optional[str] = None

    if _has_realtime_intent(query):
        reason = "realtime_keyword"
    else:
        sim = _max_local_similarity(local_results)
        if sim < threshold:
            reason = "low_similarity"

    if reason is None:
        return None, None

    from tools.base import web_search

    try:
        web_result = web_search.invoke({"query": query, "top_k": 5})
    except Exception:
        return None, None

    return web_result, reason
