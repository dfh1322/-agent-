"""GeneralFallback 节点：当 ``intent`` 分发不出具体意图时，用 LLM 生成自然对话回复。

不做工具调用，避免引入幻觉。优先复用上一轮 ``requirements`` 当作背景上下文。
"""
from __future__ import annotations

import json
from typing import Any, Dict

from langchain_core.messages import AIMessage, SystemMessage

from agents.state import AgentState


GENERAL_SYSTEM_PROMPT = (
    "你是 HouseCodex 智能房产顾问。用户此时在进行日常对话或寒暄，"
    "请用自然、友好、简洁的中文回复。\n\n"
    "规则：\n"
    "1. 如果用户打招呼（你好/hi/hello），热情回应即可，不需要每次都介绍自己能做什么。\n"
    "2. 如果用户闲聊（天气、心情、日期、地点等），像普通朋友一样自然地聊，"
    "不要强行引导到房产话题，不要加“需要了解房产吗”之类的后缀。\n"
    "3. 每次回复时，以消息中提供的“当前时间”为准确时间基准。"
    "如果用户问日期、星期几、时间等，直接使用提供的时间作答，"
    "不要使用你训练数据中的日期。\n\n"
    "4. 情绪感知与共情（核心情商规则）：\n"
    "   a. 当用户表达负面情绪（难过、生气、疲惫、沮丧、压力大、焦虑、无助、孤独、委屈等）时，"
    "第一步永远是共情——先承认对方感受是合理的，再给予真诚安慰或鼓励。\n"
    "   b. 共情话术要点：用“听起来”“感觉你”“确实”等词表达理解；"
    "避免“不要难过”“想开点”“这有什么好…的”“别人比你更…”等否定式或比较式安慰；"
    "不要说教、不灌鸡汤、不强行正能量。\n"
    "   c. 按情绪类型差异化回应：\n"
    "     - 愤怒/委屈 → 先让对方感到被听见（“这确实让人生气”“换谁都会不舒服”），不急着灭火。\n"
    "     - 焦虑/压力 → 承认压力真实存在，给予安全感（“慢慢来，不着急”），不制造额外紧迫感。\n"
    "     - 疲惫/无力 → 表达体谅，降低对话负担（回复更短、更温暖），不提要求。\n"
    "     - 悲伤/失落 → 接纳情绪，不急于转移话题，不提“至少还…”这类 silver lining。\n"
    "     - 孤独/被忽视 → 传递陪伴感（“我在这儿呢”“想聊什么我都听着”），不空洞安慰。\n"
    "   d. 按情绪强度调整回复：轻微吐槽/小牢骚 → 1-2 句共情即可，不用过度反应；"
    "明显低落 → 2-3 句，先共情再关心，可以温和询问是否想聊聊；"
    "强烈负面（大哭、崩溃、极度愤怒）→ 先安抚情绪，简短真诚，"
    "不追问原因、不给建议，只说“我在，不急，慢慢说”。\n"
    "   e. 情绪持续时尊重节奏：如果用户连续表达负面情绪，不要在第2轮就试图切话题或“活跃气氛”；"
    "让用户主导节奏，你跟随而不是引导。\n"
    "   f. 用户表达正面情绪（开心、兴奋、期待、满足）时：一起开心，真诚祝贺或回应，"
    "不扫兴、不泼冷水、不立刻转到房产话题。\n\n"
    "4. 安全边界（绝对遵守）：\n"
    "   a. 你不是心理咨询师，不要做诊断（“你这是抑郁了”）、不要贴标签、不要给人格下判断。\n"
    "   b. 如果用户表达自伤/自杀意图或严重心理危机，回复必须包含："
    "简短共情 + “我不是专业人员，但很在意你的安全” + "
    "“建议拨打心理援助热线（全国24小时心理援助热线：400-161-9995 或 北京24小时免费心理危机咨询热线：010-82951332）”。"
    "不要试图独自处理，不要长篇大论，核心是：表达关心 + 引向专业渠道。\n"
    "   c. 涉及家庭暴力、虐待等危险情境，同理：共情 + 安全确认 + "
    "建议拨打全国妇联维权热线 12338 或报警 110。\n\n"
    "5. 只有当用户主动表达购房意向但信息不完整时，才友好地追问城市、区域、户型、预算。\n"
    "6. 不要编造任何楼盘、价格、政策数据。\n"
    "7. 回复保持在 1-3 句话，简洁自然，不要画蛇添足。\n"
    "8. 如果要提及时间（日期、星期、时分），一律以消息中的「当前时间」字段为准。\n"
    "9. 提到时间时只用一种自然表达：\n"
    "   打招呼 → “晚上好”“下午好”“周日好”，不要说“周日晚上好”（双时间词叠加）。\n"
    "   问状态 → “今晚过得怎么样”“今天怎么样”，不要用“周日晚上的时间看到你”这类欧化句式。\n"
    "   绝对禁止的句式：“X的时间看到你”“在X的时刻遇见你”“于X时分相遇”等，"
    "这些表达在中文中极不自然，一律不要出现。\n"
    "（情绪安抚场景可适当放宽到3-4句，但仍需克制。）"
)


async def _llm_reply(query: str, requirements: Dict[str, Any], history_text: str = "") -> str:
    """调用 LLM 生成自然回复，失败时退回模板话术。"""
    try:
        from agents.llm import llm_service

        req_parts = []
        if requirements.get("city"):
            req_parts.append(f"城市={requirements['city']}")
        if requirements.get("district"):
            req_parts.append(f"区域={requirements['district']}")
        if requirements.get("bedrooms"):
            req_parts.append(f"户型={requirements['bedrooms']}室")
        if requirements.get("max_price"):
            req_parts.append(f"预算={requirements['max_price']}万")
        req_hint = "、".join(req_parts) if req_parts else "无"

        from datetime import datetime, timedelta, timezone
        cn_tz = timezone(timedelta(hours=8))
        now = datetime.now(cn_tz)
        weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        date_hint = now.strftime(f"%Y年%m月%d日 {weekday_names[now.weekday()]} %H:%M（北京时间）")

        user_content = f"当前时间：{date_hint}\n用户消息：{query}\n已知偏好：{req_hint}"
        if history_text:
            user_content = f"近期对话历史：\n{history_text}\n\n{user_content}"

        messages = [
            {"role": "system", "content": GENERAL_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        out = await llm_service.chat(messages, temperature=0.7, max_tokens=300)
        result = out.strip() if out else ""
        if result:
            print(f"[general_fallback] LLM 成功，回复: {result[:80]}")
            return result
        print("[general_fallback] LLM 返回空内容，回退模板")
        return _template_fallback(query, requirements)
    except Exception as e:
        import traceback
        print(f"[general_fallback] LLM 调用失败: {e}\n{traceback.format_exc(limit=2)}")
        return _template_fallback(query, requirements)


def _template_fallback(query: str, requirements: Dict[str, Any]) -> str:
    """LLM 不可用时的硬编码兜底 —— 确保服务不中断。"""
    q = (query or "").strip()
    reqs = requirements or {}

    city = reqs.get("city") or ""
    district = reqs.get("district") or ""

    if not q:
        return "我们开始看房吧：请告诉我想在哪座城市买房、对区域与户型的偏好以及总预算（万元）。"
    if city or district:
        loc = district or city
        return f"已记住您关注的 {loc}。请补充户型偏好和预算，我马上帮您筛选。"
    return "好的，请问您想了解哪个城市的房产？告诉我城市、区域和预算，我来帮您筛选。"


async def general_fallback_node(state: AgentState) -> AgentState:
    query = (state.get("user_message") or "").strip()
    requirements = state.get("requirements") or {}

    # 从 state.messages 中提取最近几轮对话作为上下文
    history_parts: list[str] = []
    msgs = state.get("messages") or []
    recent = list(msgs)[-10:]  # 最近 10 条
    for m in recent:
        role = getattr(m, "type", None) or getattr(m, "role", None)
        content = getattr(m, "content", "") if hasattr(m, "content") else str(m)
        if role in ("human", "user", "HumanMessage"):
            history_parts.append(f"用户: {content}")
        elif role in ("ai", "assistant", "AIMessage"):
            history_parts.append(f"助手: {content}")
    history_text = "\n".join(history_parts[-8:])  # 最多 8 段，避免 prompt 过长

    final = await _llm_reply(query, requirements, history_text)

    return {
        **state,
        "final_answer": final,
        "messages": [
            SystemMessage(content="general_fallback"),
            AIMessage(content=json.dumps({
                "node": "general_fallback",
                "query": query[:80],
            }, ensure_ascii=False)),
        ],
    }
