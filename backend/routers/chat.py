"""聊天路由组 —— 智能对话、楼盘搜索、政策查询、AI 推荐/对比/政策解读/贷款建议。

改进项（相对旧版）：
    * ``_persist_conversation`` 会把工具调用链落到 ``messages.tool_calls``,
      把工具返回落到 ``messages.tool_responses``，并对 content 脱敏。
    * SSE 接口 ``chat_agent_stream`` 改用 ``Depends(get_db)`` 注入，
      不再误用 ``Depends(get_db)()`` 这种反模式。
    * Agent 入口改为调用 ``agents.graph.run_agent`` / ``stream_agent``，
      这样上层的 LangGraph 状态机就成为权威实现。
"""
from __future__ import annotations

import asyncio
import json
import re
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config.database import get_db
from middleware.deps import get_current_user, get_current_user_optional
from middleware.sanitizer import sanitize_text_message
from models.user import User


router = APIRouter()


# ── 枚举 / 关键字 ──
CHAT_MODES: Tuple[Literal["general", "property"], ...] = ("general", "property")

PROPERTY_SEARCH_KEYWORDS = (
    "推荐", "找房", "买房", "购房", "看房", "房源", "楼盘",
    "有哪些房", "哪个盘", "什么房", "帮我找", "介绍一下房", "选房",
    "房价", "均价", "楼市", "行情",
)
POLICY_KEYWORDS = (
    "公积金", "贷款", "首付", "限购", "契税", "个税", "增值税",
    "落户", "政策", "税费", "利率", "按揭",
)
HANGZHOU_DISTRICTS = (
    "西湖", "上城", "下城", "江干", "拱墅", "滨江", "萧山", "余杭",
    "临平", "富阳", "临安", "钱塘",
)
CITY_KEYWORDS = ("杭州", "杭州市")
PROPERTY_TOPIC_KEYWORDS = POLICY_KEYWORDS + (
    "楼盘", "户型", "学区", "月供", "房贷", "物业费", "开发商",
    "交房", "精装",
)


# ── Pydantic 模型 ────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = Field(..., description="user / assistant")
    content: str = Field(...)


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: Optional[str] = None
    model: Optional[str] = None
    mode: Optional[str] = None


class ChatResponse(BaseModel):
    content: str
    properties: Optional[List[dict]] = None
    session_id: str
    conversation_id: Optional[int] = None
    used_model: Optional[str] = None
    detected_mode: Optional[str] = None

    class Config:
        protected_namespaces = ()


class SetModelRequest(BaseModel):
    model: str


class AgentChatRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: Optional[str] = None
    model: Optional[str] = None
    mode: Optional[str] = None


# ── 意图/条件提取（与 LangGraph 节点共享） ──────────────────────────────

def _collect_user_text(user_query: str, history: Optional[List[dict]] = None) -> str:
    parts = []
    if history:
        for msg in history:
            if msg.get("role") == "user" and msg.get("content"):
                parts.append(msg["content"])
    parts.append(user_query)
    return " ".join(parts)


def detect_chat_mode(user_query: str, history: Optional[List[dict]] = None) -> str:
    combined = _collect_user_text(user_query, history)
    if has_property_search_intent(combined):
        return "property"
    if any(k in combined for k in PROPERTY_TOPIC_KEYWORDS):
        return "property"
    if re.search(r"(房|盘|租|售|住).{0,6}(推荐|怎么选|哪个好|多少钱)", combined):
        return "property"
    return "general"


def has_property_search_intent(text: str) -> bool:
    if any(k in text for k in PROPERTY_SEARCH_KEYWORDS):
        return True
    return bool(re.search(r"(找|买|看|选).{0,4}(房|盘|楼盘)", text))


def has_location_info(text: str, requirements: dict) -> bool:
    if requirements.get("district") or requirements.get("city"):
        return True
    return any(k in text for k in CITY_KEYWORDS + HANGZHOU_DISTRICTS)


def extract_requirements(text: str) -> dict:
    requirements = {
        "bedrooms": None, "min_price": None, "max_price": None,
        "district": None, "city": None,
        "metro": False, "school": False,
    }
    bm = re.search(r"(\d+)\s*室|(\d+)\s*房", text)
    if bm:
        requirements["bedrooms"] = int(bm.group(1) or bm.group(2))
    pm = re.search(r"(\d+)\s*万", text)
    if pm:
        price = int(pm.group(1))
        if "左右" in text or "大概" in text:
            requirements["min_price"] = max(price - 20, 0)
            requirements["max_price"] = price + 20
        else:
            requirements["max_price"] = price
    for d in HANGZHOU_DISTRICTS:
        if d in text:
            requirements["district"] = d + "区"
            requirements["city"] = "杭州"
            break
    if not requirements["city"]:
        for c in CITY_KEYWORDS:
            if c in text:
                requirements["city"] = "杭州"
                break
    if "地铁" in text or "近地铁" in text:
        requirements["metro"] = True
    if has_property_search_intent(text) and any(k in text for k in ("学区", "学校", "上学")):
        requirements["school"] = True
    return requirements


def should_search_properties(text: str, reqs: dict, mode: str, history: Optional[List[dict]] = None) -> bool:
    if mode != "property":
        return False
    combined = _collect_user_text(text, history)
    if not has_property_search_intent(combined):
        return False
    if not has_location_info(combined, reqs):
        return False
    return True


def build_extra_instruction(text: str, mode: str, history: Optional[List[dict]] = None) -> Optional[str]:
    if mode != "property":
        return None
    combined = _collect_user_text(text, history)
    if not has_property_search_intent(combined):
        return None
    reqs = extract_requirements(combined)
    if not has_location_info(combined, reqs):
        return (
            "用户表达了购房/找房意向，但尚未说明目标城市或区域。"
            "请先友好地询问其意向城市、区域和预算，不要推荐具体楼盘。"
        )
    return None


# ── 对话持久化（含 tool_calls/tool_responses） ─────────────────────────

def _persist_conversation(
    db: Session,
    user_id: int,
    session_id: str,
    user_message: str,
    assistant_content: str,
    tool_calls: Optional[List[Dict[str, Any]]] = None,
    tool_responses: Optional[Any] = None,
    intent: Optional[str] = None,
    sources: Optional[List[Dict[str, Any]]] = None,
) -> int:
    """把一轮对话（含可能的工具调用链）写入数据库。

    表结构约束（CLAUDE.md §7）：``conversations`` 与 ``messages`` 表的
    ``user_id`` / ``conversation_id`` 必须可以回溯到登录用户。因此
    匿名或会话失效场景下应**避免**调用本函数，而不是传 ``None`` 强行落库。

    Args:
        db: 数据库会话。
        user_id: 当前用户 ID。
        session_id: 会话标识（前端传入 / 自动生成）。
        user_message: 用户原始输入。
        assistant_content: Agent 最终输出文本。
        tool_calls / tool_responses: 工具调用与返回，序列化为 ``messages.tool_calls/responses`` JSON 列。
        intent: 路由后端使用的意图分类。
        sources: 命中引用（property / policy / faq / knowledge_doc）列表。
    """
    from models.property import Conversation, Message

    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id, Conversation.status == "active")
        .order_by(Conversation.updated_at.desc())
        .first()
    )
    # 生成明文标题：首次会话由 ``user_message`` 截断；后续若旧会话
    # 标题缺失/被清空也回填。**关键**：绝对不能在已有 title 的基础上
    # 继续 encrypt，否则会把已加密的密文再加密一次，循环膨胀直至超过
    # ``conversations.title VARCHAR(200)``，触发 1406 (`Data too long`)。
    from middleware.crypto import decrypt_str, encrypt_str, is_encrypted

    plain_title = user_message[:30] + ("..." if len(user_message) > 30 else "")

    if not conv:
        conv = Conversation(user_id=user_id, title=encrypt_str(plain_title), status="active")
        db.add(conv)
        db.flush()
    else:
        # 仅当 title 缺失或解密后拿到的是"被反复加密"的旧脏数据时，
        # 才回填；否则保持原值，避免重复 encrypt。
        existing = conv.title
        needs_refill = not existing
        if not needs_refill and is_encrypted(existing):
            try:
                decrypted = decrypt_str(existing)
                # 已加密 -> 解 -> 若解出来仍带 ``sec://``，说明历史上被多层加密过
                if decrypted.startswith("sec://"):
                    needs_refill = True
            except Exception:
                needs_refill = True
        if needs_refill:
            conv.title = encrypt_str(plain_title)

    conv.status = "active"
    conv.updated_at = datetime.utcnow()

    user_message_safe = sanitize_text_message(user_message)
    assistant_content_safe = sanitize_text_message(assistant_content)

    # 落库前对敏感文本 AES-GCM 加密（CLAUDE.md §5.4 数据安全）。线上访问读
    # 取路径 (``routers/admin.py`` 中的 conversations 接口) 会在返回值之
    # 前调用 ``decrypt_str`` 解密，历史未加密数据以明文兼容读取。
    user_message_enc = encrypt_str(user_message_safe)
    assistant_content_enc = encrypt_str(assistant_content_safe)
    # 注：``conv.title`` 已在上面的 if/else 中按"不重复加密"策略写完，
    # 此处**不要**再覆盖；继续覆盖会导致密文叠密文（之前 500 错误的根因）。

    db.add(Message(
        conversation_id=conv.id,
        role="user",
        content=user_message_enc,
    ))
    metadata = {"intent": intent}
    if sources:
        metadata["sources"] = sources
    db.add(Message(
        conversation_id=conv.id,
        role="assistant",
        content=assistant_content_enc,
        tool_calls=json.dumps(tool_calls, ensure_ascii=False, default=str) if tool_calls else None,
        tool_responses=json.dumps(tool_responses, ensure_ascii=False, default=str) if tool_responses else None,
        metadata_col=metadata,
    ))
    db.commit()
    return conv.id


# ── 通用 Agent 调用入口 ────────────────────────────────────────────────

async def _invoke_agent(
    db: Session,
    agent,
    user_message: str,
    conversation_history: Optional[List[Dict[str, str]]],
    user_context: Dict[str, Any],
    session_id: str,
) -> Dict[str, Any]:
    """调用 LangGraph 流水线的统一入口，封装历史/用户上下文转换。"""
    from agents.graph import run_agent
    state = await run_agent(
        db=db,
        user_message=user_message,
        user_context=user_context,
        conversation_history=conversation_history or [],
        session_id=session_id,
        db_user_id=user_context.get("id", 0),
    )
    return {
        "final_answer": state.get("final_answer") or "",
        "tool_steps": state.get("tool_steps") or [],
        "guard_result": state.get("guard_result") or {},
        "sources": state.get("sources") or [],
        "intent": state.get("intent"),
        "mode": "property" if state.get("intent") in {"property", "finance", "policy", "faq"} else "general",
        "session_id": session_id,
    }


def _user_context_from_user(user: Optional[User]) -> Dict[str, Any]:
    """把 User ORM 转成 LangGraph 节点使用的 user_context 字典。

    ``user`` 为 ``None`` 时返回匿名上下文 —— 不会强行写入 ``id=0``，
    让下游节点自然走"未登录用户"分支。
    """
    if user is None:
        return {
            "id": 0,
            "username": "anonymous",
            "role": "user",
            "is_admin": False,
            "anonymous": True,
        }
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role or "user",
        "is_admin": bool(user.is_admin),
    }


# ── Fallback 文案（中文） ────────────────────────────────────────
FALLBACK_BY_INTENT = {
    "property": "暂未找到符合条件的房源。请尝试放宽条件（区域、价格、户型等），或告诉我更具体的需求。",
    "policy": "暂无相关本地政策信息，无法解答。请联系人工客服或换个区域/政策词重新提问。",
    "finance": "暂未给出测算结果。请补充贷款金额、贷款年限等关键信息后重试。",
    "faq": "暂无匹配的常见问答。请换个问法或补充上下文。",
    "general": "暂无相关本地信息，无法解答。请换个问题或补充背景。",
}
GENERIC_FALLBACK = "抱歉，本轮没有触发数据检索。请换个问题或补充更多上下文后重试。"


def _ensure_fallback_text(
    final: str,
    intent: Optional[str],
    tool_steps: List[Dict[str, Any]],
) -> str:
    """兜底 —— final 为空时按 intent 给出一段中文提示，避免空白回复。

    模型（如不可达 LLM）输出为空时，仅 ``"抱歉"`` 这类无信息对话，
    替换为意图级别的明确 fallback，也能让前端 Chat UI 不再吐 "抱歉我遇到了
    一些问题"的笼统报错。
    """
    text = (final or "").strip()
    if text and text not in {"抱歉，我遇到了一些问题，请稍后再试。", "抱歉，我遇到了一些问题，请稍后再试"}:
        return text
    if not tool_steps:
        return FALLBACK_BY_INTENT.get(intent or "", GENERIC_FALLBACK)
    # 工具调用过，但 final 还是空；按最常用的"未检索到"回复。
    for step in tool_steps:
        output = step.get("output")
        # 工具调用返回纯列表 [] 时
        if output in ([], {}, "", None):
            return FALLBACK_BY_INTENT.get(intent or "", GENERIC_FALLBACK)
    return FALLBACK_BY_INTENT.get(intent or "", GENERIC_FALLBACK)


# ── 路由实现 ─────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """非 Agent 兼容模式 — 直接调用 LangGraph 简化路径返回。

    要求登录；token 缺失/过期/吊销会由 ``get_current_user`` 抛 401，
    前端拦截后引导用户重新登录。
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="请提供对话消息")
    user_message = next(
        (m.content for m in reversed(request.messages) if m.role == "user"),
        None,
    )
    if not user_message:
        raise HTTPException(status_code=400, detail="请提供用户消息")
    session_id = request.session_id or str(uuid.uuid4())

    from knowledge.chat_cache import chat_cache
    history = chat_cache.get_history(session_id)

    from agents.graph import run_agent  # 局部 import 避免循环
    user_ctx = _user_context_from_user(current_user)
    try:
        state = await run_agent(
            db=db,
            user_message=user_message,
            user_context=user_ctx,
            conversation_history=history,
            session_id=session_id,
            db_user_id=current_user.id if current_user else 0,
        )
        final = state.get("final_answer") or ""
        final = _ensure_fallback_text(
            final,
            intent=state.get("intent"),
            tool_steps=state.get("tool_steps") or [],
        )
        intent = state.get("intent")
        tool_calls = [
            {"tool": s.get("tool"), "input": s.get("args"),
             "observation": s.get("output")}
            for s in (state.get("tool_steps") or [])
        ]
        tool_responses = [s.get("output") for s in (state.get("tool_steps") or [])]
        sources = state.get("sources") or []
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        # Agent 内部异常（VectorStore 不可用、LLM 故障、依赖失败等）。
        # 不要让子组件异常升级为 5xx；返回通用 fallback，避免前端拿到
        # "Internal Server Error" 卡住对话。
        import traceback
        print(f"[ERR] /chat/chat run_agent 失败：{exc}\n{traceback.format_exc(limit=4)}")
        final = "暂未给出本次答复（后端智能体运行遇到错误，已记录日志），请稍后再试或换个问题。"
        intent = "general"
        tool_calls = []
        tool_responses = []
        sources = []

    db_user_id = current_user.id
    conv_id = _persist_conversation(
        db=db,
        user_id=db_user_id,
        session_id=session_id,
        user_message=user_message,
        assistant_content=final,
        tool_calls=tool_calls,
        tool_responses=tool_responses,
        intent=intent,
        sources=sources,
    )

    chat_cache.add_message(session_id, "user", user_message)
    chat_cache.add_message(session_id, "assistant", final)

    return ChatResponse(
        content=final,
        properties=None,
        session_id=session_id,
        conversation_id=conv_id,
        used_model=request.model,
        detected_mode=intent or "general",
    )


@router.post("/clear")
async def clear_chat(session_id: str):
    from knowledge.chat_cache import chat_cache
    chat_cache.clear_history(session_id)
    return {"success": True, "message": f"会话 {session_id} 的历史记录已清除"}


@router.get("/conversations")
async def list_user_conversations(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的对话历史列表（解密返回明文）。"""
    from models.property import Conversation, Message
    from middleware.crypto import decrypt_str
    from sqlalchemy import func

    query = db.query(Conversation).filter(
        Conversation.user_id == current_user.id,
        Conversation.status == "active",
    )
    total = query.count()
    convs = (
        query.order_by(Conversation.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for conv in convs:
        msg_count = (
            db.query(func.count(Message.id))
            .filter(Message.conversation_id == conv.id)
            .scalar() or 0
        )
        title = decrypt_str(conv.title or "") or f"对话 #{conv.id}"
        items.append({
            "id": conv.id,
            "session_id": str(conv.id),
            "title": title,
            "message_count": msg_count,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        })

    return {"success": True, "data": items, "pagination": {"page": page, "page_size": page_size, "total": total}}


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取指定对话的消息列表（解密返回明文）。仅允许本人访问。"""
    from models.property import Conversation, Message
    from middleware.crypto import decrypt_str

    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")
    if conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此对话")

    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    return {
        "success": True,
        "data": [
            {
                "id": m.id,
                "role": m.role,
                "content": decrypt_str(m.content or ""),
                "tool_calls": m.tool_calls,
                "metadata": m.metadata_col,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in msgs
        ],
    }


@router.get("/models")
async def get_models():
    from agents.llm import LLMService
    return {
        "success": True,
        "models": LLMService.get_available_models(),
        "current_model": {
            "name": "langgraph-agent",
            "description": "LangGraph 多智能体（Claude 默认）",
        },
    }


@router.post("/models/set")
async def set_model(request: SetModelRequest):
    try:
        from agents.llm import llm_service
        llm_service.set_model(request.model)
        return {"success": True, "message": f"已切换到模型: {request.model}", "model": request.model}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/properties")
async def get_properties(
    district: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    bedrooms: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """在售楼盘列表（行级隔离）。

    CLAUDE.md 5.3：landlord 角色只能看到自己名下的楼盘；admin 全可见；
    普通 user 维持原行为（看全部在售）。
    """
    from models.property import Property, HouseType, District
    from sqlalchemy import or_

    query = db.query(Property).filter(Property.status == "在售")
    if current_user.role == "landlord":
        query = query.filter(Property.owner_id == current_user.id)
    if district:
        query = query.join(District).filter(District.name.contains(district))
    if min_price:
        query = query.filter(Property.total_price_min >= min_price)
    if max_price:
        query = query.filter(Property.total_price_max <= max_price)
    if bedrooms:
        query = query.join(HouseType).filter(HouseType.bedrooms == bedrooms)
    rows = query.limit(20).all()
    out = []
    for p in rows:
        out.append({
            "id": p.id,
            "name": p.name,
            "owner_id": p.owner_id,
            "district": p.district.name if p.district else None,
            "price_per_sqm": float(p.price_per_sqm) if p.price_per_sqm else None,
            "total_price_min": float(p.total_price_min) if p.total_price_min else None,
            "total_price_max": float(p.total_price_max) if p.total_price_max else None,
            "area_min": float(p.area_min) if p.area_min else None,
            "area_max": float(p.area_max) if p.area_max else None,
            "green_rate": float(p.green_rate) if p.green_rate else None,
            "decoration_status": p.decoration_status,
            "metro_distance": p.metro_distance,
            "school_district": p.school_district,
            "description": p.description,
        })
    return out


@router.get("/properties/{property_id}")
async def get_property_detail(property_id: int, db: Session = Depends(get_db)):
    from models.property import Property, HouseType
    p = db.query(Property).filter(Property.id == property_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="楼盘不存在")
    hts = db.query(HouseType).filter(HouseType.property_id == property_id).all()
    return {
        "id": p.id,
        "name": p.name,
        "district": p.district.name if p.district else None,
        "address": p.address,
        "developer": p.developer,
        "price_per_sqm": float(p.price_per_sqm) if p.price_per_sqm else None,
        "total_price_min": float(p.total_price_min) if p.total_price_min else None,
        "total_price_max": float(p.total_price_max) if p.total_price_max else None,
        "area_min": float(p.area_min) if p.area_min else None,
        "area_max": float(p.area_max) if p.area_max else None,
        "green_rate": float(p.green_rate) if p.green_rate else None,
        "property_fee": float(p.property_fee) if p.property_fee else None,
        "decoration_status": p.decoration_status,
        "metro_distance": p.metro_distance,
        "metro_line": p.metro_line,
        "school_district": p.school_district,
        "description": p.description,
        "house_types": [
            {
                "id": h.id, "name": h.name, "bedrooms": h.bedrooms,
                "living_rooms": h.living_rooms, "bathrooms": h.bathrooms,
                "area": float(h.area) if h.area else None,
                "total_price": float(h.total_price) if h.total_price else None,
                "orientation": h.orientation,
            } for h in hts
        ],
    }


@router.get("/policies")
async def get_policies(db: Session = Depends(get_db)):
    from models.property import Policy
    rows = db.query(Policy).filter(Policy.is_active == True).all()
    return [
        {
            "id": p.id, "title": p.title, "policy_type": p.policy_type,
            "content": p.content, "source": p.source,
            "effective_date": p.effective_date.isoformat() if p.effective_date else None,
        } for p in rows
    ]


@router.get("/faqs")
async def get_faqs(db: Session = Depends(get_db)):
    from models.property import FAQ
    rows = db.query(FAQ).filter(FAQ.is_active == True).order_by(FAQ.sort_order).all()
    return [
        {"id": f.id, "question": f.question, "answer": f.answer,
         "category": f.category, "tags": f.tags}
        for f in rows
    ]


@router.post("/properties/recommend")
async def recommend_properties(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pref = (request.get("preference") or "").strip()
    if not pref:
        return {"success": False, "error": "请描述您的购房需求", "properties": []}
    requirements = extract_requirements(pref)
    if not has_property_search_intent(pref) and not requirements.get("district"):
        return {"success": False, "error": "请说明您的找房意向，并至少提供目标城市或区域", "properties": []}
    if not has_location_info(pref, requirements):
        return {"success": True, "recommendation": (
            "看起来您还未提到目标城市或区域。能补充一下吗？"
        ), "properties": []}

    from tools.base import search_properties, set_db_context
    set_db_context(db)
    invoke_kwargs: Dict[str, Any] = {
        "district": requirements.get("district"),
        "min_price": requirements.get("min_price"),
        "max_price": requirements.get("max_price"),
        "bedrooms": requirements.get("bedrooms"),
        "limit": 10,
    }
    # CLAUDE.md 5.3：landlord 租户隔离
    if current_user.role == "landlord":
        invoke_kwargs["owner_id"] = current_user.id
    result = search_properties.invoke(invoke_kwargs)
    items = result.get("items") or []
    return {
        "success": True,
        "recommendation": (
            f"为您筛选到 {len(items)} 个匹配楼盘（基于 MySQL 真实检索）。"
            if items else "根据您的条件暂未找到匹配的在售楼盘，请放宽区域或预算。"),
        "properties": [
            {"id": it["id"], "name": it["name"], "district": it.get("district"),
             "price_range": it.get("total_price_range"),
             "area_range": it.get("area_range")}
            for it in items
        ],
    }


@router.post("/properties/compare")
async def compare_properties(request: dict, db: Session = Depends(get_db)):
    ids = request.get("property_ids") or []
    if not ids:
        return {"success": False, "error": "请选择要对比的楼盘"}
    from tools.base import compare_properties as tool_compare
    from tools.base import set_db_context
    set_db_context(db)
    result = tool_compare.invoke({"property_ids": ids})
    return {"success": True, **result}


@router.post("/policy/explain")
async def explain_policy(request: dict, db: Session = Depends(get_db)):
    question = request.get("question", "")
    from tools.base import set_db_context, search_policy
    set_db_context(db)
    res = search_policy.invoke({"keyword": question, "top_k": 3})
    items = res.get("items") or []
    explanation = "\n\n".join(
        f"【{p['title']}】({p.get('source') or '官方'}):\n{p['content'][:600]}"
        for p in items
    ) if items else (
        "暂无相关本地政策信息，无法解答。请尝试更具体的关键词，如「公积金」「限购」「契税」。"
    )
    return {"success": True, "explanation": explanation, "policies": items}


@router.post("/calculator/advice")
async def calculator_advice(request: dict, db: Session = Depends(get_db)):
    """调 ``calculate_mortgage`` 真实计算月供。"""
    price = float(request.get("price") or 0)
    down_payment_ratio = float(request.get("down_payment_ratio") or 0.3)
    loan_term = int(request.get("loan_term") or 30)
    is_second = bool(request.get("is_second_home", False))
    has_pf = bool(request.get("has_provident_fund", False))

    from tools.base import set_db_context, calculate_mortgage, calculate_taxes
    set_db_context(db)
    mortgage = calculate_mortgage.invoke({
        "price": price, "down_payment_ratio": down_payment_ratio,
        "loan_term": loan_term, "is_second_home": is_second,
        "has_provident_fund": has_pf,
    })
    taxes = None
    if request.get("area"):
        taxes = calculate_taxes.invoke({
            "price": price, "area": float(request.get("area")),
            "is_first_home": not is_second,
            "years_owned": int(request.get("years_owned") or 0),
        })
    return {"success": True, "calculation": mortgage, "taxes": taxes}


# ── Agent 入口（保留兼容） ──────────────────────────────────────────────

@router.post("/chat/agent", response_model=ChatResponse)
async def chat_agent(
    request: AgentChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agent 智能对话接口 — 走 LangGraph 状态机，工具调用完成后由 LLM 润色为自然回复。

    与 ``/chat`` 一致：要求登录。
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="请提供对话消息")
    user_message = next((m.content for m in reversed(request.messages) if m.role == "user"), None)
    if not user_message:
        raise HTTPException(status_code=400, detail="请提供用户消息")
    session_id = request.session_id or str(uuid.uuid4())

    from knowledge.chat_cache import chat_cache
    history = chat_cache.get_history(session_id)

    from agents.graph import run_agent
    user_ctx = _user_context_from_user(current_user)
    try:
        state = await run_agent(
            db=db, user_message=user_message, user_context=user_ctx,
            conversation_history=history, session_id=session_id,
            db_user_id=current_user.id if current_user else 0,
        )
        intent = state.get("intent")
        tool_steps = state.get("tool_steps") or []
        tool_calls = [
            {"tool": s.get("tool"), "input": s.get("args"),
             "observation": s.get("output")}
            for s in tool_steps
        ]
        final = await _polish_with_llm(
            state.get("final_answer") or "", tool_steps, intent, user_message,
        )
        final = _ensure_fallback_text(final, intent=intent, tool_steps=tool_steps)
        tool_responses = [s.get("output") for s in tool_steps]
        sources = state.get("sources") or []
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        import traceback
        print(f"[ERR] /chat/agent run_agent 失败：{exc}\n{traceback.format_exc(limit=4)}")
        final = "暂未给出本次答复（后端智能体运行遇到错误，已记录日志），请稍后再试或换个问题。"
        intent = "general"
        tool_steps = []
        tool_calls = []
        tool_responses = []
        sources = []

    db_user_id = current_user.id
    conv_id = _persist_conversation(
        db=db, user_id=db_user_id, session_id=session_id,
        user_message=user_message, assistant_content=final,
        tool_calls=tool_calls, tool_responses=tool_responses,
        intent=intent, sources=sources,
    )

    chat_cache.add_message(session_id, "user", user_message)
    chat_cache.add_message(session_id, "assistant", final)

    return ChatResponse(
        content=final,
        properties=None,
        session_id=session_id,
        conversation_id=conv_id,
        used_model=request.model or llm_service.model_name,
        detected_mode=intent or "general",
    )


async def _polish_with_llm(
    draft: str,
    tool_steps: list,
    intent: str | None,
    user_query: str,
) -> str:
    """把工具结果翻译为自然语言；LLM 不可用时退回 draft。"""
    # 没有工具调用时（例如澄清追问），直接用 draft
    if not tool_steps:
        return draft

    try:
        from agents.llm import llm_service
        context_lines = [
            f"- {s.get('tool')} -> {json.dumps(s.get('output'), ensure_ascii=False)[:600]}"
            for s in tool_steps
        ]
        messages = [
            {
                "role": "system",
                "content": (
                    "你是 HouseCodex 房产顾问。请基于下方真实工具返回值，用自然专业的中文回答。"
                    "严格遵守：1) 不得编造任何楼盘/价格/政策；2) 数据必须能在工具返回中找到；"
                    "3) 提供清单时附上来源标签；4) 不要暴露工具调用细节；"
                    "5) 闲聊时简洁自然，不要强行推销或加「需要了解房产吗」之类的后缀。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"用户问题：{user_query}\n"
                    f"意图：{intent or 'general'}\n"
                    f"工具返回值：\n" + "\n".join(context_lines) +
                    "\n\n请基于以上真实数据撰写回复。"
                ),
            },
        ]
        out = await llm_service.chat(messages, temperature=0.4, max_tokens=1024)
        return out.strip() or draft
    except Exception:
        return draft


async def _agent_stream_generator(
    request: AgentChatRequest,
    current_user: User,
):
    """SSE 事件流生成器。

    调用 ``agents.graph.stream_agent`` 逐节点产出事件；本次 fix 修复了
    ``Depends(get_db)()`` 错误 — 现在 db 由本函数闭包内的 ``SessionLocal()`` 提供。
    """
    if not request.messages:
        yield f"data: {json.dumps({'type': 'error', 'error': 'No user message'}, ensure_ascii=False)}\n\n"
        return

    user_message = next((m.content for m in reversed(request.messages) if m.role == "user"), None)
    if not user_message:
        yield f"data: {json.dumps({'type': 'error', 'error': 'No user message'}, ensure_ascii=False)}\n\n"
        return

    session_id = request.session_id or str(uuid.uuid4())
    yield f"data: {json.dumps({'type': 'start', 'session_id': session_id}, ensure_ascii=False)}\n\n"

    from knowledge.chat_cache import chat_cache
    history = chat_cache.get_history(session_id)

    from agents.graph import stream_agent
    from config.database import SessionLocal

    db = SessionLocal()
    conv_id: Optional[int] = None
    try:
        user_ctx = _user_context_from_user(current_user)
        tool_call_log: List[Dict[str, Any]] = []
        final_state: Dict[str, Any] = {}
        async for state in stream_agent(
            db=db, user_message=user_message, user_context=user_ctx,
            conversation_history=history or [], session_id=session_id,
            db_user_id=current_user.id,
        ):
            for s in state.get("tool_steps") or []:
                key = (s.get("tool"), json.dumps(s.get("args"), sort_keys=True, default=str))
                if not any((t.get("tool"), json.dumps(t.get("input"), sort_keys=True, default=str)) == key for t in tool_call_log):
                    tool_call_log.append({"tool": s.get("tool"), "input": s.get("args")})
                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': s.get('tool'), 'input': s.get('args')}, ensure_ascii=False, default=str)}\n\n"
                    await asyncio.sleep(0)
            final_state = state

        raw_content = (final_state.get("final_answer") or "") if final_state else "暂无相关本地政策信息，无法解答"
        # 流式：先告知客户端准备"LLM 正在润色"，再发出最终 token 流
        yield f"data: {json.dumps({'type': 'polishing', 'session_id': session_id}, ensure_ascii=False)}\n\n"
        polished = await _polish_with_llm(
            raw_content, final_state.get("tool_steps") or [], final_state.get("intent"), user_message,
        )
        # 模拟逐字流式发送
        for i, ch in enumerate(polished):
            if ch == "\n":
                yield f"data: {json.dumps({'type': 'token', 'token': ch}, ensure_ascii=False)}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'token', 'token': ch}, ensure_ascii=False)}\n\n"
            # 每 6 字符让出控制权
            if i % 6 == 5:
                await asyncio.sleep(0)

        chat_cache.add_message(session_id, "user", user_message)
        chat_cache.add_message(session_id, "assistant", polished)

        if final_state is not None:
            conv_id = _persist_conversation(
                db=db, user_id=current_user.id, session_id=session_id,
                user_message=user_message, assistant_content=polished,
                tool_calls=[
                    {"tool": t.get("tool"), "input": t.get("input"), "observation": ""}
                    for t in tool_call_log
                ],
                tool_responses=[s.get("output") for s in (final_state.get("tool_steps") or [])],
                intent=final_state.get("intent"),
                sources=final_state.get("sources") or [],
            )

        yield f"data: {json.dumps({'type': 'end', 'content': polished, 'tool_calls': tool_call_log, 'session_id': session_id, 'conversation_id': conv_id, 'intent': (final_state or {}).get('intent')}, ensure_ascii=False, default=str)}\n\n"
    except Exception as e:  # noqa: BLE001
        yield f"data: {json.dumps({'type': 'error', 'error': str(e), 'session_id': session_id}, ensure_ascii=False)}\n\n"
    finally:
        db.close()


@router.post("/chat/agent/stream")
async def chat_agent_stream(
    request: AgentChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Agent 流式对话（SSE）。

    修复点：
        * db 不再 ``Depends(get_db)()``（反模式），而是把生成器自身构造；本端点
          把 ``_agent_stream_generator(request, current_user)`` 返回，由生成器内部
          自行打开 SessionLocal。
    """
    return StreamingResponse(
        _agent_stream_generator(request, current_user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
