"""
后台管理路由组 —— 平台管理员专属的管理功能。

功能范围：
    - 全量楼盘管理（CRUD，管理员可见所有楼盘）
    - 知识库管理（政策/FAQ 文档的增删改查）
    - 对话日志查看（按时间/会话/关键词检索）
    - 合规配置（敏感词管理、降级策略）
    - 账户管理（创建/禁用/分配归属）
    - 统计面板（热门问题、高频楼盘、工具调用成功率）

权限控制：
    所有端点通过 get_current_admin 依赖注入校验，
    确保只有 role == "admin" 且有 is_admin=True 的用户才能访问。
"""

from typing import List, Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, text
import json

from config.database import get_db
from middleware.deps import get_current_admin, get_current_user
from models.property import (
    Property, HouseType, District, Policy, FAQ, KnowledgeDoc, PropertyRisk,
    Conversation, Message,
)
from models.user import User

router = APIRouter()


# ──────────────────────────────────────────────
# Pydantic 请求/响应模型
# ──────────────────────────────────────────────

class AdminPropertyCreate(BaseModel):
    """管理员新增楼盘请求体

    区域说明：
        * 优先使用 ``district_id``（兼容老接口）。
        * 也可以提交 ``province``/``city``/``district`` 进行自由输入；
          若 ``District`` 表中已存在同名 (city, district)，直接复用；
          否则按名称 upsert 出新 ``District``，并在 ``properties.province`` /
          ``properties.city`` / ``properties.district_name`` 缓存。
    """
    name: str = Field(..., max_length=100)
    district_id: Optional[int] = Field(None, description="所属区域 ID")
    province: Optional[str] = Field(None, max_length=30)
    city: Optional[str] = Field(None, max_length=30)
    district: Optional[str] = Field(None, max_length=50, description="区/县名")
    district_name: Optional[str] = None  # 兼容旧字段
    address: Optional[str] = None
    developer: Optional[str] = None
    total_price_min: Optional[float] = None
    total_price_max: Optional[float] = None
    area_min: Optional[float] = None
    area_max: Optional[float] = None
    decoration_status: Optional[str] = None
    metro_distance: Optional[int] = None
    metro_line: Optional[str] = None
    school_district: Optional[str] = None
    green_rate: Optional[float] = None
    property_fee: Optional[float] = None
    plot_ratio: Optional[float] = None
    description: Optional[str] = None
    status: str = "在售"
    tags: Optional[dict] = None


class AdminPropertyUpdate(BaseModel):
    """更新楼盘（所有字段可选）"""
    name: Optional[str] = None
    district_id: Optional[int] = None
    province: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    developer: Optional[str] = None
    total_price_min: Optional[float] = None
    total_price_max: Optional[float] = None
    area_min: Optional[float] = None
    area_max: Optional[float] = None
    decoration_status: Optional[str] = None
    metro_distance: Optional[int] = None
    metro_line: Optional[str] = None
    school_district: Optional[str] = None
    green_rate: Optional[float] = None
    property_fee: Optional[float] = None
    plot_ratio: Optional[float] = None
    description: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[dict] = None


class KnowledgeDocCreate(BaseModel):
    """知识库文档新增请求体"""
    title: str = Field(..., max_length=200)
    doc_type: str = Field(..., description="文档类型: policy/faq/guide")
    content: str = Field(...)
    source: Optional[str] = None
    doc_metadata: Optional[dict] = None


class KnowledgeDocUpdate(BaseModel):
    """知识库文档更新（所有字段可选）"""
    title: Optional[str] = None
    doc_type: Optional[str] = None
    content: Optional[str] = None
    source: Optional[str] = None
    doc_metadata: Optional[dict] = None
    is_active: Optional[bool] = None


class ComplianceWordCreate(BaseModel):
    """敏感词新增"""
    word: str = Field(..., max_length=100)
    action: str = Field(default="block", description="处理方式: block/replace/warn")
    replacement: Optional[str] = None
    category: str = Field(default="sensitive", description="分类")


class UserCreateRequest(BaseModel):
    """管理员创建用户请求体"""
    username: str = Field(..., max_length=50)
    email: str
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: str = Field(default="user", description="user/landlord/admin")
    company_name: Optional[str] = None


class UserToggleRequest(BaseModel):
    """启用/禁用用户"""
    is_active: bool


# ──────────────────────────────────────────────
# 辅助函数
# ──────────────────────────────────────────────

def _missing_migrated_columns(exc: Exception) -> bool:
    """是否因为缺少迁移后的新增列（parent_id/level/full_path/code/province 等）而出错。

    用于在 schema 未迁移时自动降级到最少列写入。
    """
    msg = str(exc).lower()
    needle = ("unknown column", "不存在", "doesn't exist")
    return any(k in msg for k in needle)


def _upsert_district(db: Session, city: str, district: str, province: str = "") -> int:
    """按 ``(city, district)`` upsert District 行。

    返回主键 ID。未传入 ``province`` 时尽量从 ``full_path`` 推断或
    留空，避免占用额外索引。
    """
    existing = (
        db.query(District)
        .filter(District.city == city, District.name == district)
        .first()
    )
    if existing:
        return existing.id

    full_path = "/".join(p for p in (province, city, district) if p)
    new_district = District(
        name=district,
        city=city,
        level=3,
        full_path=full_path or f"{city}/{district}",
        code=None,
        parent_id=None,
        sort_order=0,
        is_active=True,
    )
    db.add(new_district)
    try:
        db.flush()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        if not _missing_migrated_columns(exc):
            raise
        # schema 未迁移时降级再写一次
        new_district = District(name=district, city=city, is_active=True)
        db.add(new_district)
        db.flush()
    return new_district.id


def _serialize_property(prop: Property) -> dict:
    """序列化楼盘对象为字典。

    ``province`` / ``city`` / ``district_name`` 既从 ORM 冗余列读，
    也从关联的 ``District.full_path`` / ``city`` 兜底。
    """
    district = prop.district
    full_path = getattr(district, "full_path", None) if district else None
    province = getattr(prop, "province", None)
    if not province and full_path:
        province = full_path.split("/")[0] if "/" in full_path else None
    city = getattr(prop, "city", None) or (district.city if district else None)
    district_name = (
        getattr(prop, "district_name", None)
        or (district.name if district else None)
    )
    return {
        "id": prop.id,
        "name": prop.name,
        "district": district.name if district else None,
        "district_id": prop.district_id,
        "province": province,
        "city": city,
        "district_name": district_name,
        "full_path": full_path,
        "address": prop.address,
        "developer": prop.developer,
        "price_per_sqm": float(prop.price_per_sqm) if prop.price_per_sqm else None,
        "total_price_min": float(prop.total_price_min) if prop.total_price_min else None,
        "total_price_max": float(prop.total_price_max) if prop.total_price_max else None,
        "area_min": float(prop.area_min) if prop.area_min else None,
        "area_max": float(prop.area_max) if prop.area_max else None,
        "plot_ratio": float(prop.plot_ratio) if prop.plot_ratio else None,
        "green_rate": (
            float(prop.green_rate) if prop.green_rate is not None else None
        ),
        "property_fee": (
            float(prop.property_fee) if prop.property_fee is not None else None
        ),
        "property_company": prop.property_company,
        "decoration_status": prop.decoration_status,
        "school_district": prop.school_district,
        "metro_distance": prop.metro_distance,
        "metro_line": prop.metro_line,
        "status": prop.status,
        "tags": prop.tags,
        "description": prop.description,
        "is_featured": prop.is_featured,
        "owner_id": prop.owner_id,
    }


# ──────────────────────────────────────────────
# 1. 全量楼盘管理
# ──────────────────────────────────────────────

@router.get("/properties")
async def admin_list_properties(
    page: int = 1,
    page_size: int = 20,
    district: Optional[str] = None,
    status_filter: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    获取全量楼盘列表（支持分页、搜索、筛选）。

    仅管理员可访问。
    """
    query = db.query(Property)

    if district:
        query = query.join(District).filter(District.name.contains(district))
    if status_filter:
        query = query.filter(Property.status == status_filter)
    if keyword:
        query = query.filter(
            Property.name.contains(keyword) | Property.address.contains(keyword)
        )

    total = query.count()
    props = query.order_by(Property.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [_serialize_property(p) for p in props],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
    }


@router.get("/landlord/properties")
async def landlord_list_properties(
    page: int = 1,
    page_size: int = 20,
    district: Optional[str] = None,
    status_filter: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_user),
):
    """
    房产公司角色查看自己名下楼盘（支持分页、搜索、筛选）。

    通过 owner_id 实现行级数据隔离。
    """
    query = db.query(Property).filter(Property.owner_id == landlord.id)

    if district:
        query = query.join(District).filter(District.name.contains(district))
    if status_filter:
        query = query.filter(Property.status == status_filter)
    if keyword:
        query = query.filter(
            Property.name.contains(keyword) | Property.address.contains(keyword)
        )

    total = query.count()
    props = query.order_by(Property.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [_serialize_property(p) for p in props],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    }


@router.post("/properties", status_code=status.HTTP_201_CREATED)
async def admin_create_property(
    data: AdminPropertyCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员新增楼盘

    流程：
        1. 优先使用 ``data.district_id``（兼容老接口）。
        2. 若未提供 ID，按 ``(city, district)`` upsert District。
        3. 同时把冗余字段写入 ``properties.province/city/district_name``。
    """
    province = (data.province or "").strip()
    city = (data.city or "").strip()
    district_name = (data.district or data.district_name or "").strip()

    district_id = data.district_id
    if not district_id:
        if not (city and district_name):
            raise HTTPException(
                status_code=400,
                detail="必须提供 district_id，或同时提供 city 与 district（区/县）字段",
            )
        district_id = _upsert_district(
            db,
            city=city,
            district=district_name,
            province=province,
        )

    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=400, detail="区域不存在")

    prop = Property(
        name=data.name,
        district_id=district.id,
        address=data.address,
        developer=data.developer,
        total_price_min=data.total_price_min,
        total_price_max=data.total_price_max,
        area_min=data.area_min,
        area_max=data.area_max,
        decoration_status=data.decoration_status,
        metro_distance=data.metro_distance,
        metro_line=data.metro_line,
        school_district=data.school_district,
        green_rate=data.green_rate,
        property_fee=data.property_fee,
        plot_ratio=data.plot_ratio,
        description=data.description,
        status=data.status,
        tags=data.tags,
    )
    # 冗余写入（当 schema 尚未迁移时容错写入）
    for col, value in (
        ("province", province or None),
        ("city", city or None),
        ("district_name", district.name),
    ):
        try:
            setattr(prop, col, value)
        except Exception:
            pass
    db.add(prop)
    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        if _missing_migrated_columns(exc):
            raise HTTPException(
                status_code=400,
                detail=(
                    "数据库 schema 尚未迁移：缺少 properties.province / city / "
                    "district_name 列或 districts.parent_id / level / full_path。"
                    "请先执行 `python -m migrations.migrate_district_hierarchy`，"
                    "再重试。"
                ),
            )
        raise
    db.refresh(prop)
    return {"success": True, "property": _serialize_property(prop)}


@router.put("/properties/{property_id}")
async def admin_update_property(
    property_id: int,
    data: AdminPropertyUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员更新楼盘"""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="楼盘不存在")

    update_data = data.model_dump(exclude_unset=True)
    # 拆分 region 输入：province/city/district → upsert 后取 id
    region_fields = {"province", "city", "district"}
    has_region = region_fields.intersection(update_data.keys())
    if has_region:
        province = (update_data.pop("province", "") or "").strip()
        city = (update_data.pop("city", "") or "").strip()
        district_name = (update_data.pop("district", "") or "").strip()
        if not (city and district_name):
            raise HTTPException(
                status_code=400,
                detail="地区三段（city, district）必须同时提供",
            )
        new_id = _upsert_district(
            db, city=city, district=district_name, province=province,
        )
        update_data["district_id"] = new_id
        for col, value in (
            ("province", province or None),
            ("city", city or None),
            ("district_name", district_name),
        ):
            update_data.setdefault(col, value)

    for field, value in update_data.items():
        setattr(prop, field, value)

    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        if _missing_migrated_columns(exc):
            raise HTTPException(
                status_code=400,
                detail=(
                    "数据库 schema 尚未迁移：缺少 properties.province / city / "
                    "district_name 列或 districts.parent_id / level / full_path。"
                    "请先执行 `python -m migrations.migrate_district_hierarchy`，"
                    "再重试。"
                ),
            )
        raise
    db.refresh(prop)
    return {"success": True, "property": _serialize_property(prop)}


@router.delete("/properties/{property_id}")
async def admin_delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员下架/删除楼盘（逻辑删除，修改状态为已下架）"""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="楼盘不存在")

    prop.status = "已下架"
    db.commit()
    return {"success": True, "message": f"楼盘 {prop.name} 已下架"}


# ── 区域管理 ──────────────────────────────────────────────────────────────

@router.get("/districts")
async def admin_list_districts(
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """列出所有行政区域，按 full_path 排序。

    用于 AdminProperties / AdminKnowledge 表单 Cascader 下拉。
    """
    q = db.query(District).filter(District.is_active.is_(True))
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(District.name.like(like), District.city.like(like)))
    rows = q.order_by(District.full_path.asc(), District.sort_order.asc()).all()
    items = [
        {
            "id": r.id,
            "name": r.name,
            "city": r.city,
            "full_path": getattr(r, "full_path", None),
            "parent_id": getattr(r, "parent_id", None),
            "level": getattr(r, "level", 3),
            "code": getattr(r, "code", None),
        }
        for r in rows
    ]
    return {"success": True, "data": items}


@router.get("/districts/tree")
async def admin_districts_tree(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """返回省/市/区级联树，前端 ``<Cascader>`` 直接消费。

    若 DB 尚未迁移（缺少 parent_id / level / full_path 列），降级到
    二层结构 ``[ [市, 区县] ]``，最简级联可以使用，前端也能看见。
    """
    rows = (
        db.query(District)
        .filter(District.is_active.is_(True))
        .order_by(District.city.asc(), District.name.asc())
        .all()
    )
    if not rows:
        return {"success": True, "data": []}

    # 优先看是否真正迁移过 schema
    has_full_path = any(getattr(r, "full_path", None) for r in rows)

    # 部分历史数据 ``full_path`` 的省份字段为空；如果 schema 未迁移
    # 且 ``full_path`` 缺失值，从覆盖表（按 city 推断省份）补一个。
    _CITY_PROVINCE_FALLBACK: Dict[str, str] = {
        "上海": "上海", "北京": "北京", "天津": "天津", "重庆": "重庆",
        "广州": "广东", "深圳": "广东", "佛山": "广东", "东莞": "广东",
        "杭州": "浙江", "宁波": "浙江", "绍兴": "浙江", "温州": "浙江",
        "嘉兴": "浙江", "金华": "浙江",
        "南京": "江苏", "苏州": "江苏", "无锡": "江苏", "常州": "江苏", "南通": "江苏",
        "济南": "山东", "青岛": "山东", "烟台": "山东",
        "福州": "福建", "厦门": "福建", "泉州": "福建",
        "合肥": "安徽", "芜湖": "安徽", "蚌埠": "安徽",
        "武汉": "湖北", "宜昌": "湖北",
        "长沙": "湖南", "郑州": "河南", "石家庄": "河北", "太原": "山西",
        "西安": "陕西", "成都": "四川", "绵阳": "四川",
        "沈阳": "辽宁", "长春": "吉林", "哈尔滨": "黑龙江",
        "昆明": "云南", "贵阳": "贵州", "南宁": "广西", "南昌": "江西",
        "海口": "海南",
        "南京市": "江苏",
    }

    items = []
    if has_full_path:
        # 三层：province/city/district；只把省份挂到顶层，市级作为省份的
        # children 节点出现，避免把 "上海/广州" 这类市级名字放到顶层。
        prov_map: dict[str, dict] = {}

        for r in rows:
            full_path = (getattr(r, "full_path", None) or f"{r.city}/{r.name}").split("/")
            full_path = [p for p in full_path if p]
            if len(full_path) >= 3:
                province, city, district_name = full_path[0], full_path[1], full_path[2]
            else:
                province = ""
                city = full_path[0] if full_path else r.city
                district_name = r.name if len(full_path) > 1 else ""
            # schema 未迁移 / full_path 缺少省份时，按 CITY→province
            # 的覆盖表**严格**推断；推断不到的 city 仍归入 "其他" 占位省。
            if not province and city:
                province = _CITY_PROVINCE_FALLBACK.get(city) or "其他"

            province_key = f"prov-{province}"
            prov_node = prov_map.get(province_key)
            if prov_node is None:
                prov_node = {
                    "value": province_key,
                    "label": province,
                    "level": 1,
                    "children": [],
                }
                prov_map[province_key] = prov_node

            city_key = f"city-{province}-{city}"
            city_node = next(
                (c for c in prov_node["children"] if c["value"] == city_key),
                None,
            )
            if city_node is None:
                city_node = {
                    "value": city_key,
                    "label": city,
                    "level": 2,
                    "children": [],
                }
                prov_node["children"].append(city_node)

            city_node["children"].append({
                "value": f"dist-{city}-{district_name or r.name}",
                "label": district_name or r.name,
                "level": 3,
                "children": [],
                "city": r.city,
                "district_id": r.id,
            })

        items = list(prov_map.values())
    else:
        # schema 未迁移时降级为 :[ {city, children:[ {name, district_id} ]} ]
        groups: dict[str, list[dict]] = {}
        ids: dict[str, int] = {}
        for r in rows:
            groups.setdefault(r.city, []).append({
                "value": f"dist-{r.city}-{r.name}",
                "label": r.name,
                "city": r.city,
                "district_id": r.id,
            })
        for city, group in groups.items():
            items.append({
                "value": f"city--{city}",
                "label": city,
                "children": group,
            })

    return {"success": True, "data": items}


# ──────────────────────────────────────────────
# 2. 知识库管理
# ──────────────────────────────────────────────

@router.get("/knowledge")
async def admin_list_knowledge(
    page: int = 1,
    page_size: int = 20,
    doc_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """获取知识库文档列表"""
    query = db.query(KnowledgeDoc)

    if doc_type:
        query = query.filter(KnowledgeDoc.doc_type == doc_type)
    if is_active is not None:
        query = query.filter(KnowledgeDoc.is_active == is_active)
    if keyword:
        query = query.filter(
            KnowledgeDoc.title.contains(keyword) | KnowledgeDoc.content.contains(keyword)
        )

    total = query.count()
    docs = query.order_by(KnowledgeDoc.updated_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return {
        "success": True,
        "data": [
            {
                "id": d.id,
                "title": d.title,
                "doc_type": d.doc_type,
                "source": d.source,
                "is_active": d.is_active,
                "created_at": d.created_at,
                "updated_at": d.updated_at,
            }
            for d in docs
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    }


@router.post("/knowledge", status_code=status.HTTP_201_CREATED)
async def admin_create_knowledge(
    data: KnowledgeDocCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """新增知识库文档"""
    doc = KnowledgeDoc(
        title=data.title,
        doc_type=data.doc_type,
        content=data.content,
        source=data.source,
        doc_metadata=data.doc_metadata,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"success": True, "document": {"id": doc.id, "title": doc.title}}


@router.put("/knowledge/{doc_id}")
async def admin_update_knowledge(
    doc_id: int,
    data: KnowledgeDocUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """更新知识库文档"""
    doc = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)

    db.commit()
    db.refresh(doc)
    return {"success": True, "message": "文档已更新"}


@router.delete("/knowledge/{doc_id}")
async def admin_delete_knowledge(
    doc_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """删除知识库文档"""
    doc = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    db.delete(doc)
    db.commit()
    return {"success": True, "message": "文档已删除"}


# ──────────────────────────────────────────────
# 3. 对话日志管理
# ──────────────────────────────────────────────

@router.get("/conversations")
async def admin_list_conversations(
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取对话日志列表。

    管理员：可查看全部对话记录。
    房产公司：仅可查看与自己名下楼盘相关的脱敏摘要。
    """
    is_admin = current_user.is_admin and current_user.role == "admin"
    is_landlord = current_user.role == "landlord"

    # 统计摘要
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_properties = db.query(func.count(Property.id)).filter(
        Property.status == "在售"
    ).scalar() or 0
    total_policies = db.query(func.count(Policy.id)).filter(
        Policy.is_active == True
    ).scalar() or 0

    conversations = []

    if is_admin:
        # 管理员：查看完整对话列表
        query = db.query(Conversation).filter(Conversation.status == "active")
        if keyword:
            user_subquery = (
                db.query(User.id)
                .filter(User.username.contains(keyword) | User.full_name.contains(keyword))
                .subquery()
            )
            query = query.filter(
                Conversation.title.contains(keyword) |
                Conversation.user_id.in_(user_subquery)
            )
        total = query.count()
        convs = query.order_by(Conversation.updated_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        for conv in convs:
            user = db.query(User).filter(User.id == conv.user_id).first()
            last_msg = (
                db.query(Message)
                .filter(Message.conversation_id == conv.id)
                .order_by(Message.created_at.desc())
                .first()
            )
            # 透明解密 — ``middleware.crypto`` 对未加密 (历史) 文本会原
            # 样返回，对 ``sec://`` 密文会解密为明文。
            from middleware.crypto import decrypt_str
            title_display = decrypt_str(conv.title or "")
            last_msg_text = decrypt_str(last_msg.content) if last_msg else ""
            conversations.append({
                "id": conv.id,
                "user_id": conv.user_id,
                "user_name": user.username if user else f"用户_{conv.user_id}",
                "title": title_display or f"对话 #{conv.id}",
                "status": conv.status,
                "created_at": conv.created_at,
                "last_message": last_msg_text[:100] if last_msg_text else None,
                "message_count": db.query(func.count(Message.id)).filter(
                    Message.conversation_id == conv.id
                ).scalar() or 0,
            })
    elif is_landlord:
        # 房产公司：仅看脱敏摘要
        total = db.query(func.count(Conversation.id)).scalar() or 0
        # 这里简化为返回系统统计摘要
        conversations = [
            {
                "id": 0,
                "user_id": 0,
                "user_name": "系统",
                "title": "对话统计摘要",
                "status": "active",
                "created_at": "",
                "last_message": f"共有 {total_users} 个用户，{total_properties} 个在售楼盘",
                "message_count": 0,
            }
        ]

    return {
        "success": True,
        "data": {
            "summary": {
                "total_users": total_users,
                "total_properties": total_properties,
                "total_policies": total_policies,
            },
            "conversations": conversations,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
            },
        },
    }


# ──────────────────────────────────────────────
# 4. 合规配置（敏感词管理）
# ──────────────────────────────────────────────

@router.get("/compliance/words")
async def admin_get_compliance_words(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """获取敏感词列表（从数据库 system_configs 表读取）"""
    from models.property import SystemConfig
    from agents.blacklist import FORBIDDEN_PHRASES, RISK_KEYWORDS

    # 从数据库读取自定义敏感词
    configs = db.query(SystemConfig).filter(
        SystemConfig.config_group == "compliance_words"
    ).all()

    custom_words = []
    for cfg in configs:
        try:
            import json
            word_data = json.loads(cfg.config_value)
            custom_words.append({
                "word": word_data.get("word", cfg.config_key),
                "action": word_data.get("action", "block"),
                "replacement": word_data.get("replacement"),
                "category": word_data.get("category", "sensitive"),
            })
        except (json.JSONDecodeError, KeyError):
            custom_words.append({
                "word": cfg.config_key,
                "action": "block",
                "replacement": None,
                "category": "custom",
            })

    # 合并内置敏感词；同一 ``(word, action)`` 对在 ``custom_words`` 中已经存在时
    # 不再 push，否则前端 Ant Design ``rowKey`` 会因重复而抛
    # "Encountered two children with the same key" warning。
    # 注意：set 中的元素顺序与比较顺序要保持一致，下面 ``(action, word)`` /
    # ``(word, action)`` 的顺序不可写反，否则永远是 ``not in``。
    custom_pairs: set[tuple[str, str]] = {(w["word"], w["action"]) for w in custom_words}
    builtin_words = [
        {"word": w, "action": "block", "replacement": None, "category": "builtin"}
        for w in FORBIDDEN_PHRASES
        if (w, "block") not in custom_pairs
    ] + [
        {"word": w, "action": "warn", "replacement": None, "category": "risk"}
        for w in RISK_KEYWORDS
        if (w, "warn") not in custom_pairs
    ]
    # 防万一：自定义词之间自身重复也清掉
    dedup_custom: list[dict] = []
    seen_pairs: set[tuple[str, str]] = set()
    for w in custom_words:
        key = (w["word"], w["action"])
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        dedup_custom.append(w)

    all_words = dedup_custom + builtin_words
    return {"success": True, "data": all_words}


@router.post("/compliance/words")
async def admin_add_compliance_word(
    data: ComplianceWordCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """添加敏感词到数据库"""
    from models.property import SystemConfig
    import json

    # 检查是否已存在
    existing = db.query(SystemConfig).filter(
        SystemConfig.config_key == data.word,
        SystemConfig.config_group == "compliance_words"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该敏感词已存在")

    word_config = {
        "word": data.word,
        "action": data.action,
        "replacement": data.replacement,
        "category": data.category,
    }

    sys_config = SystemConfig(
        config_key=data.word,
        config_value=json.dumps(word_config, ensure_ascii=False),
        description=f"合规敏感词: {data.word}",
        config_group="compliance_words",
    )
    db.add(sys_config)
    db.commit()

    # 同时更新内存缓存
    from agents.blacklist import add_sensitive_word
    add_sensitive_word(data.word, data.action, data.replacement, data.category)

    return {"success": True, "message": f"已添加敏感词: {data.word}"}


@router.delete("/compliance/words/{word}")
async def admin_remove_compliance_word(
    word: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """从数据库删除敏感词"""
    from models.property import SystemConfig

    config = db.query(SystemConfig).filter(
        SystemConfig.config_key == word,
        SystemConfig.config_group == "compliance_words"
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="该敏感词不存在（非自定义词无法删除）")

    db.delete(config)
    db.commit()

    # 同时更新内存缓存
    from agents.blacklist import remove_sensitive_word
    remove_sensitive_word(word)

    return {"success": True, "message": f"已删除敏感词: {word}"}


# ──────────────────────────────────────────────
# 5. 账户管理
# ──────────────────────────────────────────────

@router.get("/accounts")
async def admin_list_accounts(
    page: int = 1,
    page_size: int = 20,
    role_filter: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """获取用户账户列表"""
    query = db.query(User).filter(User.id != admin.id)  # 不允许管理员操作自己

    if role_filter:
        query = query.filter(User.role == role_filter)
    if keyword:
        query = query.filter(
            User.username.contains(keyword) |
            User.email.contains(keyword) |
            (User.full_name != None) & User.full_name.contains(keyword)
        )

    total = query.count()
    users = query.order_by(User.id.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return {
        "success": True,
        "data": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "full_name": u.full_name,
                "phone": u.phone,
                "role": u.role,
                "company_name": u.company_name,
                "is_active": u.is_active,
                "is_admin": u.is_admin,
                "created_at": u.created_at,
            }
            for u in users
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    }


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
async def admin_create_account(
    data: UserCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员创建用户账户"""
    from config.security import get_password_hash

    # 检查用户名/邮箱是否已存在
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="用户名已被使用")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="邮箱已被注册")

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=data.role,
        company_name=data.company_name,
        is_admin=(data.role == "admin"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "is_active": user.is_active,
        },
    }


@router.put("/accounts/{user_id}/toggle")
async def admin_toggle_account(
    user_id: int,
    data: UserToggleRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """启用/禁用用户账户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.is_active = data.is_active
    db.commit()
    return {
        "success": True,
        "message": f"用户 {user.username} 已{'启用' if data.is_active else '禁用'}",
    }


@router.delete("/accounts/{user_id}")
async def admin_delete_account(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """删除用户账户（逻辑删除）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.is_active = False
    user.username = f"deleted_{user.id}"  # 避免用户名冲突
    db.commit()
    return {"success": True, "message": "用户已禁用"}


# ──────────────────────────────────────────────
# 6. 通知/SMS 自测（仅 admin），演示合规工具路径
# ──────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel, Field as _Field


class TestSmsRequest(_BaseModel):
    phone: str = _Field(..., description="中国大陆 11 位手机号", min_length=11, max_length=11)
    code: str = _Field("888888", description="4-6 位测试验证码", min_length=4, max_length=6)


@router.post("/notifications/test-sms")
async def admin_test_sms(
    payload: TestSmsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """管理员自测短信通道：通过注册的 ``@tool send_verification_sms`` 路径调用。

    CLAUDE.md §5.2 要求"外部服务封装为 tool"。``routers/auth.py`` 的验证码
    流程出于热路径性能考虑仍走 config.sms 直调；本端点用来演示 admin
    可以通过合规工具路径调用，以便未来把 auth 也迁到 ToolNode。
    """
    from tools.base import send_verification_sms
    result = await send_verification_sms.ainvoke({"phone": payload.phone, "code": payload.code})
    status_code = status.HTTP_200_OK if result.get("ok") else status.HTTP_429_TOO_MANY_REQUESTS
    return {"success": bool(result.get("ok")), "result": result}


# ──────────────────────────────────────────────
# 7. 统计面板
# ──────────────────────────────────────────────

@router.get("/statistics")
async def admin_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取系统统计数据。

    仅管理员可访问：全量数据。
    房产公司：仅自己名下楼盘相关统计。
    """
    is_admin = current_user.is_admin and current_user.role == "admin"
    is_landlord = current_user.role == "landlord"

    # 用户统计
    total_users = db.query(func.count(User.id)).scalar() or 0
    user_roles = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    role_distribution = {r: c for r, c in user_roles}

    # 楼盘统计
    if is_admin:
        total_properties = db.query(func.count(Property.id)).scalar() or 0
        active_properties = (
            db.query(func.count(Property.id)).filter(Property.status == "在售").scalar() or 0
        )
        district_stats = (
            db.query(District.name, func.count(Property.id))
            .join(Property, District.id == Property.district_id)
            .group_by(District.name)
            .all()
        )
        district_distribution = {d: c for d, c in district_stats}
        # 热门楼盘排序：优先有收藏数的，其次上架时间倒序
        from models.property import Favorite
        hot_properties = (
            db.query(Property.id, Property.name, Property.district_id,
                     func.coalesce(func.count(Favorite.id), 0).label("favs"))
            .outerjoin(Favorite, Favorite.property_id == Property.id)
            .filter(Property.status == "在售")
            .group_by(Property.id)
            .order_by(func.coalesce(func.count(Favorite.id), 0).desc(), Property.id.desc())
            .limit(5)
            .all()
        )
    elif is_landlord:
        total_properties = (
            db.query(func.count(Property.id)).filter(
                Property.owner_id == current_user.id
            ).scalar() or 0
        )
        active_properties = (
            db.query(func.count(Property.id)).filter(
                Property.owner_id == current_user.id, Property.status == "在售"
            ).scalar() or 0
        )
        district_stats = (
            db.query(District.name, func.count(Property.id))
            .join(Property, District.id == Property.district_id)
            .filter(Property.owner_id == current_user.id)
            .group_by(District.name)
            .all()
        )
        district_distribution = {d: c for d, c in district_stats}
        from models.property import Favorite
        hot_properties = (
            db.query(Property.id, Property.name, Property.district_id,
                     func.coalesce(func.count(Favorite.id), 0).label("favs"))
            .outerjoin(Favorite, Favorite.property_id == Property.id)
            .filter(Property.owner_id == current_user.id, Property.status == "在售")
            .group_by(Property.id)
            .order_by(func.coalesce(func.count(Favorite.id), 0).desc(), Property.id.desc())
            .limit(5)
            .all()
        )
    else:
        total_properties = 0
        active_properties = 0
        district_distribution = {}
        hot_properties = []

    hot_list = [
        {"id": p.id, "name": p.name, "district_id": p.district_id, "favs": int(p.favs or 0)}
        for p in hot_properties
    ]

    # 政策统计（修正 SQLAlchemy == True 警告）
    active_policies = (
        db.query(func.count(Policy.id))
        .filter(Policy.is_active.is_(True))
        .scalar() or 0
    )
    total_policies = db.query(func.count(Policy.id)).scalar() or 0

    # FAQ 统计
    active_faqs = (
        db.query(func.count(FAQ.id))
        .filter(FAQ.is_active.is_(True))
        .scalar() or 0
    )
    total_faqs = db.query(func.count(FAQ.id)).scalar() or 0

    # ── 对话 / 工具调用统计 ────────────────────────────────
    total_conversations = (
        db.query(func.count(Conversation.id)).scalar() or 0
    )
    last_24h_conversations = (
        db.query(func.count(Conversation.id))
        .filter(Conversation.created_at >= func.date_sub(func.now(), text("INTERVAL 1 DAY")))
        .scalar() or 0
        if is_admin
        else 0
    )

    # 工具调用成功率统计 — 解析 messages.tool_calls JSON 数组长度
    # MySQL 5.7+ JSON_LENGTH 即可。SQLite 则改为应用层 json.loads 计数。
    from sqlalchemy.dialects.mysql import JSON as MYSQL_JSON
    tool_call_total = (
        db.query(func.count(Message.id))
        .filter(Message.role == "assistant")
        .scalar() or 0
    )
    has_tool_calls = (
        db.query(func.count(Message.id))
        .filter(Message.role == "assistant", Message.tool_calls.isnot(None))
        .scalar() or 0
    )

    # 楼盘均价（仅 admin 取，转换为元/㎡）
    avg_price_per_sqm = None
    if is_admin:
        value = (
            db.query(func.avg(Property.price_per_sqm))
            .filter(Property.status == "在售")
            .scalar()
        )
        avg_price_per_sqm = float(value) if value is not None else None

    return {
        "success": True,
        "data": {
            "users": {
                "total": total_users,
                "by_role": role_distribution,
            },
            "properties": {
                "total": total_properties,
                "active": active_properties,
                "by_district": district_distribution,
                "hot": hot_list,
                "avg_price_per_sqm": avg_price_per_sqm,
            },
            "knowledge": {
                "policies": active_policies,
                "policies_total": total_policies,
                "faqs": active_faqs,
                "faqs_total": total_faqs,
            },
            "conversations": {
                "total": total_conversations,
                "last_24h": last_24h_conversations,
            },
            "tool_calls": {
                "total_assistant_msgs": tool_call_total,
                "with_tool_calls": has_tool_calls,
            },
            "system": {
                "uptime": "running",
                "version": "1.0.0",
            },
        },
    }
