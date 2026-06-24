"""Supervisor 节点：根据 ``requirements`` 选择意图路由。"""
from __future__ import annotations

import json
import re
from typing import Any, Dict

from langchain_core.messages import AIMessage, SystemMessage

from agents.state import AgentState, IntentType
from agents.prompts import SUPERVISOR_PROMPT


_PROVIDER_FUND_KW = ("公积金",)
_FINANCE_KW = ("月供", "贷款", "首付", "利率", "利息", "理财", "测算", "购买力", "还款")
_POLICY_KW = ("限购", "落户", "政策", "资格", "二套", "首套", "税费", "契税", "增值税",
               "限制", "额度", "认定", "办理", "购房条件", "购房资格", "买房条件", "买房资格",
               "首付比例", "公积金", "贷款额度")
_PROPERTY_KW = ("推荐", "找房", "买房", "看房", "楼盘", "小区", "学区", "地铁", "户型", "对比",
                "预算", "总价", "室", "房间", "面积", "近地铁",
                "房价", "均价", "房价走势", "楼市", "行情", "新房价格", "二手房价格")
_FAQ_KW = ("怎么", "如何", "怎么办", "？", "?")

# 闲聊/非房产关键词：优先路由到 general_fallback，避免落入 faq → policy_expert → fact_checker
# 被"相似度阈值"拦截，输出机械的"暂无相关本地政策信息"。
_CHITCHAT_KW = (
    "天气", "下雨", "温度", "几度", "热不热", "冷不冷", "晴", "阴", "刮风",
    "你好", "您好", "hi", "hello", "嗨", "早上好", "下午好", "晚上好", "晚安",
    "再见", "拜拜", "bye", "谢谢", "感谢", "不客气",
    "你是谁", "你叫什么", "你的名字", "你是机器人", "你是AI", "你是人工",
    "能做什么", "你会什么", "你的功能", "介绍一下自己", "你是什么",
    "笑话", "故事", "新闻", "星座", "八卦", "明星", "娱乐",
    "吃了吗", "干嘛呢", "在吗", "在不", "有人吗",
    "年龄", "几岁", "生日", "喜欢什么", "兴趣爱好", "你多大了",
    "哇咔咔", "哈哈哈", "嘿嘿", "嘻嘻", "呵呵", "嗯嗯", "哦哦",
    "唱", "画", "写诗", "翻译", "算数", "数学题",
)
_CHITCHAT_PATTERNS = [
    r"^(今天|明天|后天|昨天|最近|现在).{0,4}(天气|气温|温度|下雨|刮风|晴|阴)",
    r"^.{0,3}(天气|气温|温度).{0,6}(如何|怎么样|怎样|好吗|好吗|如何呀)",
    r"^(你|你们).{0,2}(能|可以|会|是).{0,3}(做什么|干什么|干嘛|什么)",
]


def _decide_intent(query: str, requirements: Dict[str, Any]) -> IntentType:
    text = (query or "").strip()
    reqs = requirements or {}
    text_lc = text

    # 0. 上下文追问检测：当前轮不含明确意图关键词，但上一轮已有搜索条件
    #    （city/district/bedrooms/max_price），视为对上一轮结果的追问。
    has_existing_conditions = bool(
        reqs.get("city") or reqs.get("district") or
        reqs.get("bedrooms") or reqs.get("max_price")
    )
    vague_followups = {"换", "换一", "换一下", "换一个", "换别的", "换区域", "换个区域", "看看",
                       "还有吗", "再来点", "再看看", "重启", "继续", "重选", "重推", "接着看",
                       "然后呢", "再点", "再来", "尴尬",
                       "最新", "最新的", "有没有最新", "有没有新的", "有没有推荐", "有推荐吗",
                       "还有吗", "再来几个", "别的呢", "还有别的吗"}
    if text in vague_followups or (len(text) <= 6 and any(kw in text for kw in ("换", "试试", "其他", "接着", "再来", "还有", "更多", "最新", "新"))):
        if has_existing_conditions:
            return "property"
        return "property"

    # 0.2 更宽泛的上下文追问：文本短且不含任何具体名词/动词，但已有需求槽位
    context_followup_patterns = [
        r"^那.{0,4}有没有.{0,4}(推荐|介绍|新房|合适的|好的)",
        r"^(有没有|还有|再给|给).{0,4}(推荐|介绍|新|好|更多|别的)",
        r"^(最近|近期|现在).{0,4}(有|有没有|有啥)",
        r"^(不太|不).{0,2}(喜欢|满意|合适).{0,4}(还有|有没有|换|推荐)",
        r"^(帮|给).{0,2}(我再|我).{0,4}(推荐|找|看看|介绍)",
        r"^(继续|接着|再).{0,2}(推荐|看|介绍|找|搜)",
    ]
    if has_existing_conditions:
        for pattern in context_followup_patterns:
            if re.search(pattern, text):
                return "property"

    # 0.3 闲聊/天气/自我介绍等非房产关键词 → 直接走 general_fallback，
    #   避免被 _FAQ_KW 内的"如何"/"？"命中后路由到 policy_expert 再被阈值拦截。
    if any(kw in text for kw in _CHITCHAT_KW):
        return "general"
    for pattern in _CHITCHAT_PATTERNS:
        if re.search(pattern, text):
            return "general"

    # 2. 显式要求算具体数字（不算 apartment 类提问） → finance
    #    "算" "测算" "月供" 等需独立命中"算月供 / 计算月供"
    #    **必须在 property 关键词之前匹配**，否则"帮我计算200万房子的月供"
    #    会被"房"字误判为 property。
    wants_calc = bool(re.search(r"(算|测|月供)|月(供|还)|贷.+利(率|息)|(?:首付|月供).{0,4}多少", text))
    has_numbers = bool(re.search(r"\d+", text))

    # 2.1 金融关键词 + 有数字 → 优先 finance
    if any(kw in text for kw in _FINANCE_KW) and has_numbers:
        return "finance"
    if wants_calc:
        return "finance"

    # 3. 政策 / 限售 / 额度 / 资格 类问题 → policy
    if any(kw in text for kw in _POLICY_KW):
        return "policy"

    # 4. 找房 / 推荐楼盘 / 含户型/区/价格等 → property
    #    注意：纯找房关键词不应抢先于 finance/policy
    if any(kw in text for kw in _PROPERTY_KW):
        return "property"
    if requires_property_pattern(text):
        return "property"
    if any(kw in text for kw in ("室", "房", "户型")):
        return "property"

    # 6. 公积金额度 → policy
    if any(kw in text for kw in _PROVIDER_FUND_KW) and any(kw in text for kw in ("额度", "利率", "条件")):
        return "policy"

    # 7. 含"户型/卧室/室"等户型词 + 金额 → 优先 property 而非 general
    if (reqs.get("bedrooms") or reqs.get("district") or reqs.get("city")) \
            and has_numbers and not wants_calc:
        return "property"

    # 8. 常见问答 → faq
    if any(kw in text for kw in _FAQ_KW):
        return "faq"
    return "general"


def requires_property_pattern(text: str) -> bool:
    return bool(re.search(r"(找|买|看|选).{0,4}(房|盘|楼盘)", text))


def supervisor_node(state: AgentState) -> AgentState:
    """调度器：根据需求与 query 决定下游子 Agent 的开关。"""
    query = state.get("user_message") or ""
    requirements = state.get("requirements") or {}
    # 当已经提示过需要澄清时，走 general_fallback 让 LLM 自然追问
    if state.get("needs_clarification"):
        intent = "general"
    else:
        intent = _decide_intent(query, requirements)

    needs_property = intent == "property"
    needs_finance = intent == "finance"
    needs_policy = intent in {"policy", "faq"}

    return {
        **state,
        "intent": intent,
        "needs_property_search": needs_property,
        "needs_finance_calc": needs_finance,
        "needs_policy_lookup": needs_policy,
        "messages": [
            SystemMessage(content=SUPERVISOR_PROMPT),
            AIMessage(content=json.dumps({
                "node": "supervisor",
                "intent": intent,
                "needs_property_search": needs_property,
                "needs_finance_calc": needs_finance,
                "needs_policy_lookup": needs_policy,
            }, ensure_ascii=False)),
        ],
    }


def route_intent(state: AgentState) -> str:
    """LangGraph 条件边使用的路由函数。

    Returns:
        下游节点名或 ``END``：
            * "property"   → property_matcher
            * "policy/faq" → policy_expert
            * "finance"    → finance_calculator
            * "general"    → general_fallback
            * needs_clarification → END
    """
    if state.get("needs_clarification"):
        # supervisor 已将 intent 设为 general，
        # 交由 general_fallback 的 LLM 生成自然追问
        return "general_fallback"
    intent = state.get("intent")
    if intent == "property":
        return "property_matcher"
    if intent in {"policy", "faq"}:
        return "policy_expert"
    if intent == "finance":
        return "finance_calculator"
    if intent == "general":
        return "general_fallback"
    return "end"
