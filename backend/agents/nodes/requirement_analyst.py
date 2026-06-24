"""RequirementAnalyst 节点：从用户问题与历史中提取购房需求槽位。

**禁止推荐楼盘**。该节点的输出完全由用户输入和短期记忆决定，
不与 MySQL/ChromaDB 交互。
"""
from __future__ import annotations

import re
import json
from datetime import datetime
from typing import Any, Dict, List

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from agents.state import AgentState
from agents.prompts import REQUIREMENT_ANALYST_PROMPT


_CITY_KEYWORDS = ("杭州", "北京", "上海", "广州", "深圳", "苏州", "南京", "成都")

_HZ_DISTRICTS = (
    "西湖", "上城", "下城", "江干", "拱墅", "滨江", "萧山", "余杭",
    "临平", "富阳", "临安", "钱塘",
)

_PURPOSE_KEYWORDS = ("自住", "投资", "改善", "刚需", "学区")


def _parse_budget(text: str) -> Dict[str, float]:
    """提取价格区间，单值预算自动上浮20%避免硬截断。"""
    m = re.search(r"(\d+)\s*[万Ww]\s*[-到至~]\s*(\d+)\s*[万Ww]", text)
    if m:
        return {"min_price": float(m.group(1)), "max_price": float(m.group(2))}
    m = re.search(r"(\d+)\s*[万Ww]\s*(?:左右|上下|大概|以内|左右吧|上下吧)", text)
    if m:
        price = float(m.group(1))
        return {"min_price": max(price - 20, 0), "max_price": price + 20}
    # 单值预算（如"100w"）→ 视为上限，但上浮20%做容忍
    # 同时 min_price 设为上限的60%以覆盖相近价位
    m = re.search(r"(\d+)\s*[万Ww]", text)
    if m:
        price = float(m.group(1))
        return {"min_price": price * 0.5, "max_price": price * 1.3}
    return {"min_price": None, "max_price": None}


def _parse_bedrooms(text: str) -> int | None:
    m = re.search(r"(\d+)\s*[室房]", text)
    if m:
        return int(m.group(1))
    return None


def _parse_area(text: str) -> Dict[str, float]:
    m = re.search(r"(\d+)\s*(?:到|-)\s*(\d+)\s*平(?:方)*(?:米)*", text)
    if m:
        return {"min_area": float(m.group(1)), "max_area": float(m.group(2))}
    m = re.search(r"(\d+)\s*平(?:方)*(?:米)*", text)
    if m:
        return {"min_area": float(m.group(1)), "max_area": None}
    return {"min_area": None, "max_area": None}


def requirement_analyst_node(state: AgentState) -> AgentState:
    """需求分析师节点。

    解析 ``user_message``（当前轮），并**叠加**历史对话里最近的
    ``assistant`` / ``user`` 内容做槽位补全 ——
    避免用户首次提到"西湖区"，下轮只说"接着看"就丢失 district。
    """
    user_query = state.get("user_message") or ""
    if not user_query:
        # 从 messages 提取用户最后一条
        msgs = state.get("messages") or []
        for m in reversed(msgs):
            if isinstance(m, HumanMessage) or (hasattr(m, "type") and m.type == "human"):
                user_query = m.content if hasattr(m, "content") else str(m)
                break

    history_text = ""
    msgs = state.get("messages") or []
    # 让历史里"最近的"上下文也参与槽位解析（仅看 HumanMessage）。
    recent_user_msgs: List[str] = []
    for m in msgs:
        if isinstance(m, HumanMessage) or (hasattr(m, "type") and m.type == "human"):
            content = m.content if hasattr(m, "content") else str(m)
            if content and content != user_query:
                recent_user_msgs.append(content)
    if recent_user_msgs:
        history_text = "\n".join(recent_user_msgs[-3:])

    text = (user_query or "").strip()
    combined = (history_text + "\n" + text).strip() if history_text else text

    requirements: Dict[str, Any] = {
        "city": None,
        "district": None,
        "bedrooms": None,
        "min_price": None,
        "max_price": None,
        "min_area": None,
        "max_area": None,
        "metro": False,
        "school": False,
        "purpose": None,
        "decoration": None,
        "floor_preference": None,  # "高楼层" / "中楼层" / "低楼层" / "10层以上" 等
    }

    # 城市
    for city in _CITY_KEYWORDS:
        if city in combined:
            requirements["city"] = city
            break
    # 区域（仅识别杭州行政区域）
    if requirements["city"] == "杭州":
        for d in _HZ_DISTRICTS:
            if d in combined:
                requirements["district"] = f"{d}区"
                break

    # 户型/价格/面积
    bedrooms = _parse_bedrooms(combined)
    if bedrooms:
        requirements["bedrooms"] = bedrooms
    budget = _parse_budget(combined)
    requirements.update({k: v for k, v in budget.items() if v is not None})
    area = _parse_area(combined)
    requirements.update({k: v for k, v in area.items() if v is not None})

    # 地铁/学区/装修/用途
    if "地铁" in combined or "近地铁" in combined:
        requirements["metro"] = True
    if "学区" in combined or "学校" in combined or "上学" in combined:
        requirements["school"] = True
    if "精装" in combined:
        requirements["decoration"] = "精装"
    elif "毛坯" in combined:
        requirements["decoration"] = "毛坯"
    for p in _PURPOSE_KEYWORDS:
        if p in combined:
            requirements["purpose"] = p
            break

    # 楼层偏好解析
    if re.search(r"(高楼层|高层|顶楼|顶层|高区)", combined):
        requirements["floor_preference"] = "高楼层"
    elif re.search(r"(低楼层|低层|底楼|底层|低区|一楼|二楼)", combined):
        requirements["floor_preference"] = "低楼层"
    elif re.search(r"(中楼层|中层|中间楼层|中区)", combined):
        requirements["floor_preference"] = "中楼层"
    elif re.search(r"(\d+)\s*层以上", combined):
        requirements["floor_preference"] = combined  # 保留原文给后续处理

    # 决定是否需要澄清
    core_missing = not any([
        requirements["city"],
        requirements["district"],
        requirements["bedrooms"],
        requirements["max_price"],
    ])
    needs_clarification = core_missing and bool(text)

    # 不再写死模板话术 —— 由 general_fallback 的 LLM 根据 needs_clarification + requirements
    # 生成自然的追问，避免"您好"被回复"请补充目标城市、预算"的机械感。
    final_draft = ""

    return {
        **state,
        "requirements": requirements,
        "needs_clarification": needs_clarification,
        # 仅"无任何需求槽位"且**用户输入非空**时写入 final_answer
        # 作为澄清；其他场景一律保持空 final_answer，让下游子节点
        # (property_matcher / policy_expert / ... ) 在 start_node 强制清
        # 空后填入具体答复。避免历史上"补充资料"模板重复出现。
        "final_answer": final_draft,
        "messages": [
            SystemMessage(content=REQUIREMENT_ANALYST_PROMPT),
            AIMessage(content=json.dumps({
                "node": "requirement_analyst",
                "requirements": requirements,
                "needs_clarification": needs_clarification,
                "draft_response": final_draft,
            }, ensure_ascii=False)),
        ],
    }
