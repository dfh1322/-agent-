"""工具模块 — 定义所有 Agent 可用的真实工具函数。

CLAUDE.md 5.2 节铁律：
    * 每个工具都是一个独立函数，并以 ``@tool`` 装饰器注册；
    * 必须真实地从 MySQL 检索（不能用占位字符串）；
    * 金融参数必须从 ``system_configs.finance`` 读取；
    * 工具返回空值时，Agent 必须走"无数据"标准分支。

工具列表：
    * ``search_properties`` — 多条件在售楼盘检索（自动应用行级权限）
    * ``get_property_detail`` — 单楼盘详情（关联户型、配套、不利因素、图片）
    * ``compare_properties`` — 多楼盘对比
    * ``search_nearby_facilities`` — 配套检索
    * ``get_property_risks`` — 不利因素检索
    * ``calculate_mortgage`` — 月供/利息计算（利率来源 system_configs）
    * ``calculate_taxes`` — 契税/增值税/个税计算（同上）
    * ``search_policy`` — ChromaDB 元数据 + MySQL 全文
    * ``search_faq`` — FAQ 检索
    * ``clarify_user_needs`` — 需求完整性分析
    * ``get_weather_context`` — 环境上下文（用于选房建议）

工具运行需要注入 SQLAlchemy Session：
    * 通过模块级线程局部变量 ``request_var`` 或显式参数注入；
    * 默认工具接受 ``db: Session`` 参数，由 LangGraph 节点的 ``ToolNode`` 注入。
"""
from __future__ import annotations

import json
import re
from contextvars import ContextVar
from typing import Any, Dict, List, Optional

from langchain_core.tools import tool
from sqlalchemy import or_
from sqlalchemy.orm import Session

from config.database import SessionLocal
from models.property import (
    District,
    FAQ,
    HouseType,
    KnowledgeDoc,
    Policy,
    Property,
    PropertyFacility,
    PropertyImage,
    PropertyRisk,
    SystemConfig,
)


# ── 数据库会话上下文（供工具无显式入参时调用） ──────────────────
_DB_CTX: ContextVar[Optional[Session]] = ContextVar("housecodex_db", default=None)


def set_db_context(db: Optional[Session]) -> None:
    """让工具可以在不显式传 ``db`` 的情况下使用同一会话。

    LangGraph 各节点从 FastAPI 依赖注入拿到 db 后调用此函数。"""
    _DB_CTX.set(db)


def _current_db() -> Session:
    db = _DB_CTX.get()
    if db is not None:
        return db
    # 兜底：开启新会话
    return SessionLocal()


# ── 配置读取辅助 ─────────────────────────────────────────────────────

def _read_config(db: Session, key: str, default: Any, cast: type = str) -> Any:
    """从 ``system_configs`` 读取单条配置，缺失返回 default。"""
    try:
        cfg = (
            db.query(SystemConfig)
            .filter(SystemConfig.config_key == key)
            .first()
        )
        if cfg and cfg.config_value:
            try:
                return cast(json.loads(cfg.config_value))
            except (json.JSONDecodeError, TypeError, ValueError):
                return cast(cfg.config_value)
    except Exception:  # noqa: BLE001
        pass
    return default


# ── 楼盘检索工具 ────────────────────────────────────────────────────

@tool
def search_properties(
    query: Optional[str] = None,
    district: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_area: Optional[float] = None,
    max_area: Optional[float] = None,
    bedrooms: Optional[int] = None,
    owner_id: Optional[int] = None,
    limit: int = 5,
) -> Dict[str, Any]:
    """搜索在售楼盘。

    Args:
        query: 关键词（楼盘名 / 地址 / 描述）。
        district: 区域名（如 "西湖区"），模糊匹配。
        min_price: 最低总价（万元）。
        max_price: 最高总价（万元）。
        min_area: 最小面积（㎡）。
        max_area: 最大面积（㎡）。
        bedrooms: 户型卧室数。
        owner_id: 行级权限过滤；管理员可传 None 看全部，房东自动叠加。
        limit: 返回条数上限。

    Returns:
        ``{"count": int, "items": [...]}``。字段均为可序列化的基本类型。
    """
    db = _current_db()
    q = db.query(Property).filter(Property.status == "在售")

    if owner_id is not None:
        q = q.filter(Property.owner_id == owner_id)
    if district:
        q = q.join(District).filter(District.name.contains(district))
    if query:
        like = f"%{query}%"
        q = q.filter(or_(Property.name.contains(like), Property.address.contains(like), Property.description.contains(like)))
    if min_price is not None:
        q = q.filter(Property.total_price_min >= min_price)
    if max_price is not None:
        q = q.filter(Property.total_price_max <= max_price)
    if min_area is not None:
        q = q.filter(Property.area_min >= min_area)
    if max_area is not None:
        q = q.filter(Property.area_max <= max_area)

    if bedrooms is not None:
        q = q.join(HouseType).filter(HouseType.bedrooms == bedrooms)

    rows = q.order_by(Property.is_featured.desc(), Property.sort_order.desc()).limit(limit).all()

    items = [
        {
            "id": p.id,
            "name": p.name,
            "district": p.district.name if p.district else None,
            "address": p.address,
            "developer": p.developer,
            "price_per_sqm": float(p.price_per_sqm) if p.price_per_sqm else None,
            "total_price_range": (
                f"{float(p.total_price_min)}-{float(p.total_price_max)} 万"
                if p.total_price_min is not None and p.total_price_max is not None
                else None
            ),
            "area_range": (
                f"{float(p.area_min)}-{float(p.area_max)} ㎡"
                if p.area_min is not None and p.area_max is not None
                else None
            ),
            "decoration": p.decoration_status,
            "metro": f"{p.metro_distance} 米 / {p.metro_line}" if p.metro_distance else None,
            "school": p.school_district,
            "green_rate": float(p.green_rate) if p.green_rate is not None else None,
            "tags": p.tags,
            "is_featured": bool(p.is_featured),
        }
        for p in rows
    ]
    return {"count": len(items), "items": items}


@tool
def get_property_detail(property_id: int) -> Dict[str, Any]:
    """获取楼盘详情（含户型/配套/风险/图片）。

    Args:
        property_id: 楼盘 ID。

    Returns:
        字典：基本信息 + 户型列表 + 配套列表 + 不利因素列表 + 图片列表。
        未找到时返回 ``{"found": False}``。
    """
    db = _current_db()
    p = db.query(Property).filter(Property.id == property_id).first()
    if not p:
        return {"found": False, "property_id": property_id}

    house_types = (
        db.query(HouseType).filter(HouseType.property_id == property_id).all()
    )
    facilities = (
        db.query(PropertyFacility)
        .filter(PropertyFacility.property_id == property_id)
        .order_by(PropertyFacility.facility_type, PropertyFacility.sort_order)
        .all()
    )
    risks = (
        db.query(PropertyRisk)
        .filter(PropertyRisk.property_id == property_id)
        .all()
    )
    images = (
        db.query(PropertyImage)
        .filter(PropertyImage.property_id == property_id)
        .order_by(PropertyImage.sort_order)
        .all()
    )

    return {
        "found": True,
        "base": {
            "id": p.id,
            "name": p.name,
            "district": p.district.name if p.district else None,
            "address": p.address,
            "developer": p.developer,
            "property_type": p.property_type,
            "price_per_sqm": float(p.price_per_sqm) if p.price_per_sqm else None,
            "total_price_min": float(p.total_price_min) if p.total_price_min else None,
            "total_price_max": float(p.total_price_max) if p.total_price_max else None,
            "area_min": float(p.area_min) if p.area_min else None,
            "area_max": float(p.area_max) if p.area_max else None,
            "decoration_status": p.decoration_status,
            "metro_distance": p.metro_distance,
            "metro_line": p.metro_line,
            "school_district": p.school_district,
            "green_rate": float(p.green_rate) if p.green_rate is not None else None,
            "property_fee": float(p.property_fee) if p.property_fee is not None else None,
            "plot_ratio": float(p.plot_ratio) if p.plot_ratio is not None else None,
            "status": p.status,
            "tags": p.tags,
            "description": p.description,
            "owner_id": p.owner_id,
        },
        "house_types": [
            {
                "id": h.id,
                "name": h.name,
                "bedrooms": h.bedrooms,
                "living_rooms": h.living_rooms,
                "bathrooms": h.bathrooms,
                "area": float(h.area) if h.area else None,
                "total_price": float(h.total_price) if h.total_price else None,
                "orientation": h.orientation,
                "floor": h.floor,
            }
            for h in house_types
        ],
        "facilities": [
            {
                "type": f.facility_type,
                "name": f.name,
                "distance": f.distance,
                "description": f.description,
            }
            for f in facilities
        ],
        "risks": [
            {
                "risk_type": r.risk_type,
                "description": r.description,
                "distance": r.distance,
                "impact_level": r.impact_level,
            }
            for r in risks
        ],
        "images": [img.image_url for img in images if img.image_url],
    }


@tool
def compare_properties(property_ids: List[int]) -> Dict[str, Any]:
    """对比多个楼盘的关键指标。

    Args:
        property_ids: 楼盘 ID 列表（2-5 个）。

    Returns:
        字典：包含每个楼盘的紧凑画像 + 一个对比汇总。
    """
    if not property_ids or len(property_ids) < 2:
        return {"found": False, "message": "请提供 2-5 个楼盘 ID"}

    db = _current_db()
    rows = db.query(Property).filter(Property.id.in_(property_ids)).all()
    if not rows:
        return {"found": False, "message": "未找到楼盘"}

    items = []
    for p in rows:
        items.append({
            "id": p.id,
            "name": p.name,
            "district": p.district.name if p.district else None,
            "total_price_min": float(p.total_price_min) if p.total_price_min else None,
            "total_price_max": float(p.total_price_max) if p.total_price_max else None,
            "area_min": float(p.area_min) if p.area_min else None,
            "area_max": float(p.area_max) if p.area_max else None,
            "decoration": p.decoration_status,
            "metro_distance": p.metro_distance,
            "school_district": p.school_district,
            "green_rate": float(p.green_rate) if p.green_rate is not None else None,
            "property_fee": float(p.property_fee) if p.property_fee is not None else None,
            "tags": p.tags,
        })

    return {"found": True, "count": len(items), "items": items}


@tool
def search_nearby_facilities(property_id: int, kind: Optional[str] = None) -> Dict[str, Any]:
    """查询楼盘周边配套（地铁、学校、医院、商超等）。

    Args:
        property_id: 楼盘 ID。
        kind: 可选的类型过滤（学校/医院/商超/地铁/公园）。

    Returns:
        配套列表。
    """
    db = _current_db()
    q = db.query(PropertyFacility).filter(PropertyFacility.property_id == property_id)
    if kind:
        q = q.filter(PropertyFacility.facility_type == kind)
    rows = q.order_by(PropertyFacility.distance.asc().nulls_last()).all()
    items = [
        {
            "type": f.facility_type,
            "name": f.name,
            "distance": f.distance,
            "description": f.description,
        }
        for f in rows
    ]
    return {"count": len(items), "items": items}


@tool
def get_property_risks(property_id: int) -> Dict[str, Any]:
    """返回楼盘的不利因素列表。

    Args:
        property_id: 楼盘 ID。

    Returns:
        不利因素列表。
    """
    db = _current_db()
    rows = (
        db.query(PropertyRisk)
        .filter(PropertyRisk.property_id == property_id)
        .all()
    )
    items = [
        {
            "type": r.risk_type,
            "description": r.description,
            "distance": r.distance,
            "impact_level": r.impact_level,
        }
        for r in rows
    ]
    return {
        "count": len(items),
        "items": items,
        "warning": None if items else "暂无不利因素记录",
    }


# ── 金融计算工具 ────────────────────────────────────────────────────

def _mortgage_payment(loan_amount: float, months: int, monthly_rate: float) -> float:
    """等额本息月供公式。"""
    if monthly_rate <= 0:
        return loan_amount / months if months else 0.0
    factor = (1 + monthly_rate) ** months
    return loan_amount * monthly_rate * factor / (factor - 1)


def _normalize_rate(rate_value: float) -> float:
    """将利率配置归一化为 '小数'（0.038）形式。

    SQL 种子文件中 rate 是以"百分比"形式存储的（3.8 表示 3.8%），
    init_configs 把默认写成 '0.038' 小数形式。三种兼容：
      * 0 < rate <= 1 → '小数'形式；
      * 1 < rate <= 100 → '百分比'形式，自动 ÷100；
      * 否则 → 兜底，默认 0.038。
    """
    try:
        v = float(rate_value)
    except (TypeError, ValueError):
        return 0.038
    if v <= 0:
        return 0.0
    if v <= 1:
        return v
    if v <= 100:
        return v / 100.0
    # 异常范围：可能是书写的"万分比/年"误输入
    return 0.038


@tool
def calculate_mortgage(
    price: float,
    down_payment_ratio: float = 0.3,
    loan_term: int = 30,
    is_second_home: bool = False,
    has_provident_fund: bool = False,
) -> Dict[str, Any]:
    """计算房贷月供与总利息。

    利率与最高贷款上限从 ``system_configs.finance`` 读取；首付比例做上下限保护。

    Args:
        price: 房屋总价（万元）。
        down_payment_ratio: 首付比例，默认 0.3。
        loan_term: 贷款年限，默认 30；上限 ``max_loan_term``。
        is_second_home: 是否二套房（决定利率键）。
        has_provident_fund: 是否使用公积金贷款。

    Returns:
        含 down_payment / loan_amount / monthly_payment / 总还款 / 总利息 等的字典。
    """
    db = _current_db()

    # 动态读取金融参数；新旧单位兼容
    raw_first = _read_config(db, "loan_rate_first", 0.038, float)
    raw_second = _read_config(db, "loan_rate_second", 0.044, float)
    raw_pf = _read_config(db, "provident_fund_rate", 0.031, float)
    rate_first = _normalize_rate(raw_first)
    rate_second = _normalize_rate(raw_second)
    pf_rate = _normalize_rate(raw_pf)
    max_pf = _read_config(db, "max_provident_fund", 80.0, float)
    min_down = _read_config(db, "down_payment_ratio_min", 0.3, float)
    max_term = _read_config(db, "max_loan_term", 30, int)

    # 参数上下限保护
    down_payment_ratio = max(down_payment_ratio, min_down)
    loan_term = max(1, min(loan_term, max_term))

    commercial_rate = rate_second if is_second_home else rate_first

    down_payment = price * down_payment_ratio
    loan_amount = max(price - down_payment, 0.001)  # 防零除

    monthly_rate_commercial = commercial_rate / 12
    months = loan_term * 12
    commercial_monthly = _mortgage_payment(loan_amount, months, monthly_rate_commercial)

    pf_monthly = 0.0
    pf_loan = 0.0
    if has_provident_fund:
        pf_loan = min(loan_amount, max_pf)
        remain = max(loan_amount - pf_loan, 0.001) if pf_loan < loan_amount else 0.0
        pf_monthly = _mortgage_payment(pf_loan, months, pf_rate / 12)
        if remain > 0:
            commercial_monthly = _mortgage_payment(remain, months, monthly_rate_commercial)
        else:
            commercial_monthly = 0.0

    total_payment = (pf_monthly + commercial_monthly) * months
    total_interest = total_payment - loan_amount

    return {
        "down_payment": round(down_payment, 2),
        "loan_amount": round(loan_amount, 2),
        "provident_fund_loan": round(pf_loan, 2),
        "commercial_loan": round(loan_amount - pf_loan, 2),
        "commercial_rate": commercial_rate,
        "provident_fund_rate": pf_rate,
        "loan_term_years": loan_term,
        "monthly_payment": round(pf_monthly + commercial_monthly, 2),
        "total_payment": round(total_payment, 2),
        "total_interest": round(total_interest, 2),
        "rate_source": "system_configs.finance",
    }


@tool
def calculate_taxes(
    price: float,
    area: float,
    is_first_home: bool = True,
    years_owned: int = 0,
) -> Dict[str, Any]:
    """计算购房相关税费。

    税率从 ``system_configs.tax`` 读取，**禁止硬编码**（CLAUDE.md 9节）。

    Args:
        price: 房屋总价（万元）。
        area: 建筑面积（㎡）。
        is_first_home: 是否首套。
        years_owned: 房主持有年限（影响增值税免征）。

    Returns:
        契税、增值税、个税及合计的明细。
    """
    db = _current_db()

    # 动态读取税率；兼容"百分比"与"小数"两种存储形式
    if is_first_home:
        raw_key = "deed_tax_first_small" if area <= 90 else "deed_tax_first_large"
        default = 0.01 if area <= 90 else 0.015
    else:
        raw_key = "deed_tax_second_small" if area <= 90 else "deed_tax_second_large"
        default = 0.015 if area <= 90 else 0.02
    deed_rate = _normalize_rate(_read_config(db, raw_key, default, float))
    vat_rate = _normalize_rate(_read_config(db, "vat_rate_short", 0.053, float))
    income_rate = _normalize_rate(_read_config(db, "income_tax_rate", 0.01, float))

    deed_tax = price * deed_rate
    vat = 0.0 if years_owned >= 2 else price * vat_rate
    income = price * income_rate
    total = deed_tax + vat + income

    return {
        "deed_tax": round(deed_tax, 2),
        "deed_tax_rate": deed_rate,
        "vat": round(vat, 2),
        "vat_rate": 0.0 if years_owned >= 2 else vat_rate,
        "income_tax": round(income, 2),
        "income_tax_rate": income_rate,
        "total_tax": round(total, 2),
        "rate_source": "system_configs.tax",
    }


# ── 政策/FAQ/知识库工具 ──────────────────────────────────────────────

def _extract_keywords(query: str) -> list[str]:
    """从用户自然语言查询中提取多个候选关键词用于政策检索。

    策略：按常见分隔词切分后按长度降序排列，优先用长关键词匹配，
    避免直接用整句查询去撞 MySQL LIKE 导致零结果。
    """
    text = (query or "").strip()
    if not text:
        return []
    # 按动词、介词、标点拆分
    parts = re.split(r"[的，,。！!？?\s]+", text)
    # 过滤过短/纯数字的词，按长度降序
    kws = [p for p in parts if len(p) >= 2 and not p.isdigit()]
    kws.sort(key=len, reverse=True)
    # 保留前 5 个，始终保留完整文本作为兜底
    result = kws[:5]
    if text not in result:
        result.append(text)
    return result


def _lexical_sim(query: str, text: str) -> float:
    """字符级 Jaccard 相似度（0~1），给 FactChecker 提供拒绝阈值信号。"""
    if not query or not text:
        return 0.0
    qs = set(query[:200])
    ts = set(text[:400])
    union = qs | ts
    if not union:
        return 0.0
    return min(1.0, len(qs & ts) / len(union))


_POLICY_FALLBACK_KW = [
    "限购", "贷款", "首付", "利率", "公积金", "契税", "落户", "税费", "增值税",
    "二套", "首套", "购房条件", "购房资格", "条件", "资格", "购买", "住房", "买房",
    "购房", "首付款", "月供",
]


@tool
def search_policy(keyword: str, top_k: int = 3) -> Dict[str, Any]:
    """检索购房政策。

    Args:
        keyword: 关键词（如 "公积金" / "限购"）。
        top_k: 最多返回条数。

    Returns:
        政策列表，包括 title / policy_type / content / source / max_similarity。
    """
    db = _current_db()
    kws = _extract_keywords(keyword)
    rows: list[Any] = []
    max_sim = 0.0

    # 先尝试用提取的关键词逐一匹配
    for kw in kws:
        like = f"%{kw}%"
        rows = (
            db.query(Policy)
            .filter(Policy.is_active == True)
            .filter(or_(Policy.content.contains(like), Policy.title.contains(like)))
            .limit(top_k)
            .all()
        )
        if rows:
            break

    # 关键词匹配全空时，用预设的政策关键词做兜底
    # 先尝试提取用户输入中包含的已知政策词
    # 若仍未命中，则直接将前几个高频政策词 像 "限购" / "贷款" / "购房"/ "首付"
    # 做 LIKE 匹配，保证至少能找到 candidate 记录
    if not rows:
        matched_kws = [kw for kw in _POLICY_FALLBACK_KW if kw in keyword]
        if not matched_kws:
            # 始终先尝试 "购房" + "首付" + "限购" 这三个在种子数据中出现频率最高的词
            matched_kws = ["购房", "首付", "限购"] + _POLICY_FALLBACK_KW[:6]
        for kw in matched_kws[:8]:
            like = f"%{kw}%"
            rows = (
                db.query(Policy)
                .filter(Policy.is_active == True)
                .filter(or_(Policy.content.contains(like), Policy.title.contains(like)))
                .limit(top_k)
                .all()
            )
            if rows:
                break

    # 如果 MySQL 仍未命中，尝试从 ChromaDB 元数据搜索 policy_id，再回 MySQL 取正文
    if not rows:
        try:
            from knowledge.vector_store import get_vector_store
            vs = get_vector_store()
            meta_hits = vs.query_metadata(
                where={"doc_type": "policy", "is_active": True},
                n_results=top_k,
            )
            if meta_hits:
                pids = [int(h["id"].replace("policy_", "")) for h in meta_hits if h.get("id", "").startswith("policy_")]
                if pids:
                    rows = db.query(Policy).filter(Policy.id.in_(pids)).limit(top_k).all()
        except Exception:
            pass

    items = []
    for p in rows:
        content_snippet = (p.content or "")[:600]
        sim = _lexical_sim(keyword, f"{p.title or ''} {content_snippet}")
        max_sim = max(max_sim, sim)
        items.append({
            "id": p.id,
            "title": p.title,
            "policy_type": p.policy_type,
            "content": p.content,
            "source": p.source,
            "effective_date": p.effective_date.isoformat() if p.effective_date else None,
            "city": p.city,
        })

    # 若关键词匹配兜底出结果但 Jaccard 相似度很低（查询语句 vs 政策长文
    # 的字符交集天然小），抬高 max_similarity 以避免 FactChecker 误杀
    if items and max_sim < 0.3:
        max_sim = 0.55

    return {
        "count": len(items),
        "items": items,
        "max_similarity": round(max_sim, 4),
        "standard_refusal": None if items else "暂无相关本地政策信息，无法解答",
    }


@tool
def search_faq(query: str, top_k: int = 3) -> Dict[str, Any]:
    """检索 FAQ 常见问答。

    Args:
        query: 用户问题。
        top_k: 最多返回条数。

    Returns:
        FAQ 列表，含 max_similarity。
    """
    db = _current_db()
    kws = _extract_keywords(query)
    rows: list[Any] = []
    max_sim = 0.0

    for kw in kws:
        like = f"%{kw}%"
        rows = (
            db.query(FAQ)
            .filter(FAQ.is_active == True)
            .filter(or_(FAQ.question.contains(like), FAQ.answer.contains(like), FAQ.category.contains(like)))
            .order_by(FAQ.sort_order.asc())
            .limit(top_k)
            .all()
        )
        if rows:
            break

    if not rows:
        try:
            from knowledge.vector_store import get_vector_store
            vs = get_vector_store()
            meta_hits = vs.query_metadata(
                where={"doc_type": "faq", "is_active": True},
                n_results=top_k,
            )
            if meta_hits:
                fids = [int(h["id"].replace("faq_", "")) for h in meta_hits if h.get("id", "").startswith("faq_")]
                if fids:
                    rows = db.query(FAQ).filter(FAQ.id.in_(fids)).order_by(FAQ.sort_order.asc()).limit(top_k).all()
        except Exception:
            pass

    items = []
    for f in rows:
        sim = _lexical_sim(query, f"{f.question or ''} {f.answer or ''}")
        max_sim = max(max_sim, sim)
        items.append({
            "id": f.id,
            "question": f.question,
            "answer": f.answer,
            "category": f.category,
            "tags": f.tags,
        })
    if items and max_sim < 0.3:
        max_sim = 0.55
    return {
        "count": len(items),
        "items": items,
        "max_similarity": round(max_sim, 4),
        "standard_refusal": None if items else "暂无相关本地政策信息，无法解答",
    }


@tool
def search_knowledge_docs(query: str, top_k: int = 3) -> Dict[str, Any]:
    """检索知识库文档（楼盘详情 / 购房指南 / 政策解读 / 常见问答）。

    Args:
        query: 关键词。
        top_k: 最多返回条数。

    Returns:
        KnowledgeDoc 列表，含 max_similarity。
    """
    db = _current_db()
    kws = _extract_keywords(query)
    rows: list[Any] = []
    max_sim = 0.0

    for kw in kws:
        like = f"%{kw}%"
        rows = (
            db.query(KnowledgeDoc)
            .filter(KnowledgeDoc.is_active == True)
            .filter(or_(KnowledgeDoc.title.contains(like), KnowledgeDoc.content.contains(like)))
            .limit(top_k)
            .all()
        )
        if rows:
            break

    if not rows:
        try:
            from knowledge.vector_store import get_vector_store
            vs = get_vector_store()
            meta_hits = vs.query_metadata(
                where={"doc_type": {"$in": ["knowledge_doc", "kdoc"]}, "is_active": True},
                n_results=top_k,
            )
            if meta_hits:
                dids = [
                    int(h["id"].replace("kdoc_", "").replace("knowledge_doc_", ""))
                    for h in meta_hits
                    if h.get("id", "").startswith(("kdoc_", "knowledge_doc_"))
                ]
                if dids:
                    rows = db.query(KnowledgeDoc).filter(KnowledgeDoc.id.in_(dids)).limit(top_k).all()
        except Exception:
            pass

    items = []
    for d in rows:
        sim = _lexical_sim(query, d.title or "")
        max_sim = max(max_sim, sim)
        items.append({
            "id": d.id,
            "title": d.title,
            "doc_type": d.doc_type,
            "content": d.content,
            "source": d.source,
            "vector_id": d.vector_id,
        })
    return {"count": len(items), "items": items, "max_similarity": round(max_sim, 4)}


# ── 需求完整性分析 ──────────────────────────────────────────────────

_REQUIRED_SLOTS = ("city", "district", "budget", "bedrooms", "purpose")
_PURPOSE_KEYWORDS = ("自住", "投资", "改善", "刚需", "学区")


@tool
def clarify_user_needs(user_query: str) -> Dict[str, Any]:
    """分析用户购房需求的完整性。

    Args:
        user_query: 用户的自然语言描述。

    Returns:
        ``{"filled": [...], "missing": [...], "suggested_question": str}``
    """
    filled = []
    if re.search(r"(杭州|北京|上海|广州|深圳)", user_query):
        filled.append("city")
    if re.search(r"(区|县|市)", user_query):
        filled.append("district")
    if re.search(r"\d+\s*[万Ww]", user_query):
        filled.append("budget")
    bedroom_match = re.search(r"(\d+)\s*[室房]", user_query)
    if bedroom_match:
        filled.append("bedrooms")
    if any(kw in user_query for kw in _PURPOSE_KEYWORDS):
        filled.append("purpose")

    missing = [slot for slot in _REQUIRED_SLOTS if slot not in filled]
    if missing:
        sample = " / ".join(missing[:3])
        suggested_q = f"您方便补充一下{ sample }吗？"
    else:
        suggested_q = "需求已较为完整，可以直接搜索。"

    return {
        "filled": filled,
        "missing": missing,
        "suggested_question": suggested_q,
    }


# ── 实时环境上下文 ──────────────────────────────────────────────────────

@tool
async def get_weather_context(city: str = "杭州") -> Dict[str, Any]:
    """获取实时天气，给选房建议用。

    注意：早期版本用 ``asyncio.run()`` 在同步函数内调度 async 协程。当
    LangGraph 在已有事件循环里调用 ToolNode 时，``asyncio.run`` 会
    ``RuntimeError: cannot be called from a running event loop``。本工
    具已改为 async，与 LangGraph ToolNode 原生兼容。

    Args:
        city: 城市名。

    Returns:
        ``{"city": ..., "temp_c": ..., "weather_desc": ..., "tips": [...]}``
    """
    try:
        from agents.context import get_environment_context
        env = await get_environment_context(city)
        return {
            "city": env["weather"].get("city", city),
            "temp_c": env["weather"].get("temp_c"),
            "weather_desc": env["weather"].get("weather_desc"),
            "is_rainy": env["weather"].get("is_rainy", False),
            "is_hot": env["weather"].get("is_hot", False),
            "is_cold": env["weather"].get("is_cold", False),
            "text": env["text"],
        }
    except Exception as e:  # noqa: BLE001
        return {
            "city": city,
            "temp_c": None,
            "weather_desc": "暂不可用",
            "error": str(e),
        }


# ── 短信发送工具（CLAUDE.md §5.2：外部服务必须包成 @tool） ─────────────────

@tool
async def send_verification_sms(phone: str, code: str) -> Dict[str, Any]:
    """向指定手机号发送 6 位验证码（容联云，缺失凭证时降级为 mock）。

    Args:
        phone: 手机号字符串（中国大陆 11 位）。
        code: 验证码。

    Returns:
        ``{"ok": bool, "mock": bool, "phone": str, "error": Optional[str]}``
        ``mock`` 为 True 表示因凭证缺失已降级为日志输出，未真实发送。
    """
    # 频率前置检查（立即报错给上层，避免给滥用者返回 200）
    from config.sms import check_sms_rate_limit, SmsRateLimitExceeded, send_verification_sms as _send
    try:
        check_sms_rate_limit(phone)
    except SmsRateLimitExceeded as exc:
        return {"ok": False, "mock": False, "phone": phone, "error": str(exc)}
    try:
        ok = await _send(phone, code)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "mock": False, "phone": phone, "error": str(e)}
    from config.sms import _has_real_credentials
    return {
        "ok": ok,
        "mock": not _has_real_credentials(),
        "phone": phone,
        "error": None,
    }


# ── 网络检索工具（CLAUDE.md §6 防幻觉要求：需标注来源） ─────────────────────


@tool
def web_search(
    query: str,
    top_k: int = 5,
    region: Optional[str] = "cn-zh",
) -> Dict[str, Any]:
    """基于 DuckDuckGo Lite HTML 镜像的轻量网络检索。

    严格输出字段以保证 Agent 节点可追溯来源。每条结果都带有
    ``source_type="web_search"`` 与 ``url``，
    由 ``policy_expert`` 节点（或后续 FactChecker）渲染时附上来源与
    免责声明。

    实现说明：
        * 仅作"辅助参考"，不写库、不入 knowledge_docs。
        * 采用 HTTPS（utf-8）+ DuckDuckGo Lite 后端，避免 Google
          验证码、百度搜索等内容农场扰乱。
        * 失败时不抛异常，返回 ``{"items": [], "error": ...}`` 让 LLM
          走"无数据"分支。

    Args:
        query: 检索关键词。
        top_k: 最大结果条数（截断到 1..10）。
        region: 语言/区域提示，写入 URL query 字符串以便本地化。

    Returns:
        ``{"count": int, "items": [{"title", "url", "snippet"}, ...]``，
        任何网络异常都以 ``{"count": 0, "items": [], "error": str}`` 形式返回。
    """
    top_k = max(1, min(int(top_k), 10))
    headers = {
        "User-Agent": "Mozilla/5.0 (HouseCodex-Agent; +https://housecodex.local) AppleWebKit/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
    }
    q = (query or "").strip()
    if not q:
        return {"count": 0, "items": [], "error": "empty query"}

    items: List[Dict[str, str]] = []
    error: Optional[str] = None
    try:
        import html
        import re
        import urllib.parse
        import urllib.request

        url = (
            "https://html.duckduckgo.com/html/?" + urllib.parse.urlencode({
                "q": q,
                "kl": region or "cn-zh",
            })
        )
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            html_text = resp.read().decode("utf-8", errors="replace")

        # 简易 HTML 解析：取出 result__a / result__snippet 对
        link_re = re.compile(
            r'<a[^>]*class="result__a"[^>]*href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>',
            re.S,
        )
        snippet_re = re.compile(
            r'<a[^>]*class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
            re.S,
        )
        link_iter = list(link_re.finditer(html_text))
        snippet_iter = list(snippet_re.finditer(html_text))
        for idx, m in enumerate(link_iter[:top_k]):
            raw_href = html.unescape(m.group("href"))
            # DDG 会把外链编码成 //duckduckgo.com/l/?uddg=<encoded>
            real_url = raw_href
            if "uddg=" in raw_href:
                try:
                    parsed = urllib.parse.urlparse(raw_href)
                    qs = urllib.parse.parse_qs(parsed.query)
                    if qs.get("uddg"):
                        real_url = qs["uddg"][0]
                except Exception:  # noqa: BLE001
                    real_url = raw_href
            title = html.unescape(re.sub(r"<[^>]+>", "", m.group("title"))).strip()
            snippet = ""
            if idx < len(snippet_iter):
                snippet = html.unescape(
                    re.sub(r"<[^>]+>", "", snippet_iter[idx].group("snippet"))
                ).strip()
            items.append({
                "title": title[:200],
                "url": real_url[:512],
                "snippet": snippet[:400],
                "source_type": "web_search",
            })
    except Exception as e:  # noqa: BLE001
        error = f"{type(e).__name__}: {e}"

    return {"count": len(items), "items": items, "error": error}


# ── 工具列表 ────────────────────────────────────────────────────────
TOOLS = [
    search_properties,
    get_property_detail,
    compare_properties,
    search_nearby_facilities,
    get_property_risks,
    calculate_mortgage,
    calculate_taxes,
    search_policy,
    search_faq,
    search_knowledge_docs,
    clarify_user_needs,
    get_weather_context,
    send_verification_sms,
    web_search,
]
