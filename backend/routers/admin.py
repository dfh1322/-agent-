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

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, text
import json

from config.database import get_db
from middleware.deps import get_current_admin, get_current_user
from models.property import (
    Building,
    Community,
    HouseType, District, Policy, FAQ, KnowledgeDoc,
    Conversation, Message, Unit as UnitModel,
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
    floor: Optional[str] = None              # 主力楼层范围  (removed)
    floor_min: Optional[int] = None  # 主力楼层最低层数
    floor_max: Optional[int] = None  # 主力楼层最高层数


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
    floor: Optional[str] = None
    floor_min: Optional[int] = None
    floor_max: Optional[int] = None


# ──────────────────────────────────────────────
# Community / Building / HouseType Pydantic 模型
# 必须在文件顶部定义，因为旧版 routes 和 landlord routes 中使用类型注解引用它们
# ──────────────────────────────────────────────

class CommunityCreate(BaseModel):
    """创建小区"""
    name: str = Field(..., max_length=100)
    district_id: Optional[int] = None
    alias: Optional[str] = None
    address: Optional[str] = None
    developer: Optional[str] = None
    property_type: Optional[str] = None
    total_households: Optional[int] = None
    plot_ratio: Optional[float] = None
    green_rate: Optional[float] = None
    property_company: Optional[str] = None
    property_fee: Optional[float] = None
    delivery_date: Optional[str] = None
    decoration_status: Optional[str] = None
    school_district: Optional[str] = None
    metro_distance: Optional[int] = None
    metro_line: Optional[str] = None
    status: str = "在售"
    tags: Optional[list] = None
    description: Optional[str] = None
    price_per_sqm: Optional[float] = None
    total_price_min: Optional[float] = None
    total_price_max: Optional[float] = None
    area_min: Optional[float] = None
    area_max: Optional[float] = None
    province: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    district_name: Optional[str] = None
    floor_min: Optional[int] = None
    floor_max: Optional[int] = None


class CommunityUpdate(BaseModel):
    """更新小区"""
    name: Optional[str] = Field(None, max_length=100)
    district_id: Optional[int] = None
    alias: Optional[str] = None
    address: Optional[str] = None
    developer: Optional[str] = None
    property_type: Optional[str] = None
    total_households: Optional[int] = None
    plot_ratio: Optional[float] = None
    green_rate: Optional[float] = None
    property_company: Optional[str] = None
    property_fee: Optional[float] = None
    delivery_date: Optional[str] = None
    decoration_status: Optional[str] = None
    school_district: Optional[str] = None
    metro_distance: Optional[int] = None
    metro_line: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[list] = None
    description: Optional[str] = None
    price_per_sqm: Optional[float] = None
    total_price_min: Optional[float] = None
    total_price_max: Optional[float] = None
    area_min: Optional[float] = None
    area_max: Optional[float] = None
    province: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    district_name: Optional[str] = None
    floor_min: Optional[int] = None
    floor_max: Optional[int] = None


class BuildingCreate(BaseModel):
    """创建楼栋"""
    name: str = Field(..., max_length=50)
    building_number: Optional[str] = None
    building_type: Optional[str] = None
    total_floors: Optional[int] = None
    floor_min: Optional[int] = None
    floor_max: Optional[int] = None
    units_per_floor: Optional[int] = None
    unit_count: Optional[int] = None
    elevator_count: Optional[int] = None
    orientation: Optional[str] = None
    delivery_date: Optional[str] = None
    decoration_status: Optional[str] = None
    metro_distance: Optional[int] = None
    status: str = "在售"

    @model_validator(mode='after')
    def validate_floor_range(self):
        if self.floor_min is not None and self.floor_max is not None:
            if self.floor_min > self.floor_max:
                raise ValueError('floor_min must be <= floor_max')
        return self


class BuildingUpdate(BaseModel):
    """更新楼栋"""
    name: Optional[str] = Field(None, max_length=50)
    building_number: Optional[str] = None
    building_type: Optional[str] = None
    total_floors: Optional[int] = None
    floor_min: Optional[int] = None
    floor_max: Optional[int] = None
    units_per_floor: Optional[int] = None
    unit_count: Optional[int] = None
    elevator_count: Optional[int] = None
    orientation: Optional[str] = None
    delivery_date: Optional[str] = None
    decoration_status: Optional[str] = None
    metro_distance: Optional[int] = None
    status: Optional[str] = None


class HouseTypeCreate(BaseModel):
    """在楼栋下创建户型"""
    name: str = Field(..., max_length=50)
    bedrooms: Optional[int] = None
    living_rooms: Optional[int] = None
    bathrooms: Optional[int] = None
    area: float
    total_price: Optional[float] = None
    floor_min: Optional[int] = None
    floor_max: Optional[int] = None
    orientation: Optional[str] = None
    description: Optional[str] = None

    @model_validator(mode='after')
    def validate_floor_range(self):
        if self.floor_min is not None and self.floor_max is not None:
            if self.floor_min > self.floor_max:
                raise ValueError('floor_min must be <= floor_max')
        return self


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
    query = db.query(Community)

    if district:
        query = query.join(District).filter(District.name.contains(district))
    if status_filter:
        query = query.filter(Community.status == status_filter)
    if keyword:
        query = query.filter(
            Community.name.contains(keyword) | Community.address.contains(keyword)
        )

    total = query.count()
    props = query.order_by(Community.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [_serialize_community(p, db) for p in props],
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
    query = db.query(Community).filter(Community.owner_id == landlord.id)

    if district:
        query = query.join(District).filter(District.name.contains(district))
    if status_filter:
        query = query.filter(Community.status == status_filter)
    if keyword:
        query = query.filter(
            Community.name.contains(keyword) | Community.address.contains(keyword)
        )

    total = query.count()
    props = query.order_by(Community.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [_serialize_community(p, db) for p in props],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    }


@router.post("/properties", status_code=status.HTTP_201_CREATED)
async def admin_create_property(
    data: CommunityCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员新增楼盘

    流程：
        1. 优先使用 ``data.district_id``（兼容老接口）。
        2. 若未提供 ID，按 ``(city, district)`` upsert District。
        3. 创建 Community（小区），用于楼栋/户型/房间管理。
        4. 同时把冗余字段写入 ``communities.province/city/district_name``。
    """
    province = (data.province or "").strip()
    city = (data.city or "").strip()
    district_name = (data.district_name or data.district or "").strip()

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

    # ── 创建 Community ──
    community = Community(
        name=data.name,
        district_id=district.id,
        address=data.address,
        developer=data.developer,
        total_price_min=data.total_price_min,
        total_price_max=data.total_price_max,
        area_min=data.area_min,
        area_max=data.area_max,
        floor_min=getattr(data, 'floor_min', None),
        floor_max=getattr(data, 'floor_max', None),
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
        province=province or None,
        city=city or None,
        district_name=district_name or district.name,
    )
    db.add(community)
    db.commit()
    db.refresh(community)
    return {"success": True, "property": _serialize_community(community, db)}


@router.put("/properties/{property_id}")
async def admin_update_property(
    property_id: int,
    data: CommunityUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员更新楼盘"""
    comm = db.query(Community).filter(Community.id == property_id).first()
    if not comm:
        raise HTTPException(status_code=404, detail="楼盘不存在")

    update_data = data.model_dump(exclude_unset=True)
    # 拆分 region 输入：province/city/district → upsert 后取 id
    region_fields = {"province", "city", "district"}
    has_region = region_fields.intersection(update_data.keys())
    if has_region:
        province = (update_data.pop("province", "") or "").strip()
        city = (update_data.pop("city", "") or "").strip()
        district_name = (update_data.pop("district", "") or update_data.pop("district_name", "") or "").strip()
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
        setattr(comm, field, value)

    db.commit()
    db.refresh(comm)
    return {"success": True, "property": _serialize_community(comm, db)}


@router.delete("/properties/{property_id}")
async def admin_delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员下架/删除楼盘（逻辑删除，修改状态为已下架）"""
    comm = db.query(Community).filter(Community.id == property_id).first()
    if not comm:
        raise HTTPException(status_code=404, detail="楼盘不存在")

    comm.status = "已下架"
    db.commit()
    return {"success": True, "message": f"楼盘 {comm.name} 已下架"}


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
    user_id: Optional[int] = None,
    include_closed: bool = False,
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
    total_properties = db.query(func.count(Community.id)).filter(
        Community.status == "在售"
    ).scalar() or 0
    total_policies = db.query(func.count(Policy.id)).filter(
        Policy.is_active == True
    ).scalar() or 0

    conversations = []

    if is_admin:
        # 管理员：查看完整对话列表
        query = db.query(Conversation)
        if not include_closed:
            query = query.filter(Conversation.status == "active")
        if user_id:
            query = query.filter(Conversation.user_id == user_id)
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


@router.get("/conversations/{conversation_id}/messages")
async def admin_get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员查看任意对话的完整消息列表（含解密内容）。

    绕过 chat 路由的所有权校验，管理员可审查任何用户对话。
    """
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")

    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    from middleware.crypto import decrypt_str

    return {
        "success": True,
        "data": [
            {
                "id": m.id,
                "role": m.role,
                "content": decrypt_str(m.content or ""),
                "tool_calls": m.tool_calls,
                "tool_responses": m.tool_responses,
                "metadata": m.metadata_col,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in msgs
        ],
    }


@router.put("/conversations/{conversation_id}/close")
async def admin_close_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员关闭指定对话。"""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")
    conv.status = "closed"
    db.commit()
    return {"success": True, "message": f"对话 #{conversation_id} 已关闭"}


@router.delete("/conversations/{conversation_id}")
async def admin_delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员删除指定对话及其所有消息。"""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")
    db.query(Message).filter(Message.conversation_id == conversation_id).delete()
    db.delete(conv)
    db.commit()
    return {"success": True, "message": f"对话 #{conversation_id} 已删除"}


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


def _compute_hot_properties(
    db: Session,
    owner_id: Optional[int] = None,
    limit: int = 10,
) -> list[dict]:
    """复合热度计算：收藏 + 对话提及 + 工具调用引用。

    数据来源：
        1. favorites 表 — 用户收藏数
        2. messages.tool_calls / tool_responses — 搜房工具被调用时传入/命中的楼盘名
        3. messages.content（assistant 回复）— 在回复文本中被提及的楼盘名

    每个来源归一化为 0-1 后按权重加合：
        * 收藏: 0.25
        * 对话搜房工具调用: 0.40
        * 对话回复提及: 0.35
    """
    from models.property import Favorite

    base_q = db.query(Community.id, Community.name, Community.district_id)
    if owner_id is not None:
        base_q = base_q.filter(Community.owner_id == owner_id)

    communities = base_q.filter(Community.status == "在售").limit(200).all()
    if not communities:
        return []

    community_names = {c.id: c.name for c in communities}

    # ── 维度 1: 收藏数 ──
    fav_rows = (
        db.query(Favorite.community_id, func.count(Favorite.id))
        .filter(Favorite.community_id.in_(community_names.keys()))
        .group_by(Favorite.community_id)
        .all()
    )
    fav_map = {cid: cnt for cid, cnt in fav_rows}

    # ── 维度 2 & 3: 对话中的楼盘引用 ──
    import json as _json

    msgs = (
        db.query(Message.tool_calls, Message.tool_responses, Message.content)
        .filter(Message.role == "assistant")
        .all()
    )

    mention_count: dict[int, int] = {}
    tool_hit_count: dict[int, int] = {}

    for row in msgs:
        # tool_calls / tool_responses 解析
        tc_list, tr_list = [], []
        try:
            if row.tool_calls:
                tc_list = _json.loads(row.tool_calls) if isinstance(row.tool_calls, str) else row.tool_calls
        except Exception:
            pass
        try:
            if row.tool_responses:
                tr_list = _json.loads(row.tool_responses) if isinstance(row.tool_responses, str) else row.tool_responses
        except Exception:
            pass

        for item in tc_list + tr_list:
            item_str = _json.dumps(item, ensure_ascii=False) if not isinstance(item, str) else item
            for cid, cname in community_names.items():
                if cname in item_str:
                    tool_hit_count[cid] = tool_hit_count.get(cid, 0) + 1

        # 从回复文本中提取
        content = ""
        try:
            if row.content:
                content = row.content if isinstance(row.content, str) else str(row.content)
        except Exception:
            pass
        if content:
            try:
                from middleware.crypto import decrypt_str
                content = decrypt_str(content)
            except Exception:
                pass
            for cid, cname in community_names.items():
                if cname in content:
                    mention_count[cid] = mention_count.get(cid, 0) + 1

    # ── 归一化 & 加权 ──
    def _norm(d: dict[int, int]) -> dict[int, float]:
        if not d:
            return {}
        mx = max(d.values())
        return {k: v / mx for k, v in d.items()} if mx > 0 else {}

    fav_norm = _norm(fav_map)
    tool_norm = _norm(tool_hit_count)
    mention_norm = _norm(mention_count)

    scores: dict[int, dict] = {}
    for c in communities:
        cid = c.id
        s_fav = fav_norm.get(cid, 0.0) * 0.25
        s_tool = tool_norm.get(cid, 0.0) * 0.40
        s_mention = mention_norm.get(cid, 0.0) * 0.35
        total = s_fav + s_tool + s_mention
        if total > 0:
            scores[cid] = {
                "id": c.id,
                "name": c.name,
                "district_id": c.district_id,
                "favs": fav_map.get(cid, 0),
                "chat_mentions": mention_count.get(cid, 0),
                "tool_hits": tool_hit_count.get(cid, 0),
                "heat_score": round(total, 3),
            }

    ranked = sorted(scores.values(), key=lambda x: x["heat_score"], reverse=True)
    return ranked[:limit]


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
        total_properties = db.query(func.count(Community.id)).scalar() or 0
        active_properties = (
            db.query(func.count(Community.id)).filter(Community.status == "在售").scalar() or 0
        )
        district_stats = (
            db.query(District.name, func.count(Community.id))
            .join(Community, District.id == Community.district_id)
            .group_by(District.name)
            .all()
        )
        district_distribution = {d: c for d, c in district_stats}
    elif is_landlord:
        total_properties = (
            db.query(func.count(Community.id)).filter(
                Community.owner_id == current_user.id
            ).scalar() or 0
        )
        active_properties = (
            db.query(func.count(Community.id)).filter(
                Community.owner_id == current_user.id, Community.status == "在售"
            ).scalar() or 0
        )
        district_stats = (
            db.query(District.name, func.count(Community.id))
            .join(Community, District.id == Community.district_id)
            .filter(Community.owner_id == current_user.id)
            .group_by(District.name)
            .all()
        )
        district_distribution = {d: c for d, c in district_stats}
    else:
        total_properties = 0
        active_properties = 0
        district_distribution = {}

    hot_list = _compute_hot_properties(
        db,
        owner_id=None if is_admin else (current_user.id if is_landlord else None),
        limit=10,
    )

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
            db.query(func.avg(Community.price_per_sqm))
            .filter(Community.status == "在售")
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


# ── Unit (房间) schemas ──────────────────────────────────────────────

class UnitCreate(BaseModel):
    """创建房间"""
    house_type_id: int
    room_number: str = Field(..., max_length=20)
    floor: Optional[int] = None
    area: Optional[float] = None
    total_price: Optional[float] = None
    orientation: Optional[str] = None
    status_tag: str = "在售"
    tags: Optional[list] = None
    description: Optional[str] = None
    sort_order: int = 0


class UnitBatchCreate(BaseModel):
    """批量创建房间"""
    units: List[UnitCreate]


class UnitUpdate(BaseModel):
    """更新房间（所有字段可选）"""
    house_type_id: Optional[int] = None
    room_number: Optional[str] = Field(None, max_length=20)
    floor: Optional[int] = None
    area: Optional[float] = None
    total_price: Optional[float] = None
    orientation: Optional[str] = None
    status_tag: Optional[str] = None
    tags: Optional[list] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class UnitBatchUpdate(BaseModel):
    """批量更新房间"""
    unit_ids: List[int]
    updates: Dict[str, Any]


class UnitGenerateRequest(BaseModel):
    """批量生成房间号"""
    house_type_id: int = Field(..., description="户型ID")
    floor_start: int = Field(..., description="起始楼层")
    floor_end: int = Field(..., description="结束楼层")
    rooms_per_floor: int = Field(default=2, description="每层户数")
    room_number_pattern: str = Field(
        default="{floor}0{room}",
        description="房间号模板：{floor}=楼层, {room}=户序号(从1起), {floor2}=楼层补零2位"
    )
    area: Optional[float] = Field(None, description="统一面积，留空则继承户型面积")
    total_price: Optional[float] = Field(None, description="统一售价(万元)，留空则继承户型参考价")
    orientation: Optional[str] = Field(None, description="统一朝向，留空则继承户型朝向")
    status_tag: str = Field(default="在售", description="初始状态")
    tags: Optional[list] = Field(None, description="统一标签")
    price_floor_adjust: Optional[float] = Field(
        None, description="每层差价(万元)，正数=越高越贵"
    )


def _serialize_unit(u) -> dict:
    """序列化 Unit 为字典，含展开的 house_type 摘要"""
    ht = u.house_type
    b = u.building
    return {
        "id": u.id,
        "building_id": u.building_id,
        "building_name": b.name if b else None,
        "house_type_id": u.house_type_id,
        "house_type_name": ht.name if ht else None,
        "bedrooms": ht.bedrooms if ht else None,
        "room_number": u.room_number,
        "floor": u.floor,
        "area": float(u.area) if u.area else None,
        "total_price": float(u.total_price) if u.total_price else None,
        "orientation": u.orientation,
        "status_tag": u.status_tag,
        "tags": u.tags,
        "description": u.description,
        "sort_order": u.sort_order,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "updated_at": u.updated_at.isoformat() if u.updated_at else None,
    }


def _serialize_community(c: Community, db: Session) -> dict:
    bld_count = db.query(func.count(Building.id)).filter(
        Building.community_id == c.id
    ).scalar() or 0
    return {
        "id": c.id, "name": c.name, "alias": c.alias,
        "district_id": c.district_id,
        "district": c.district.name if c.district else None,
        "address": c.address, "developer": c.developer,
        "property_type": c.property_type,
        "building_count": bld_count,
        "total_households": c.total_households,
        "plot_ratio": float(c.plot_ratio) if c.plot_ratio is not None else None,
        "green_rate": float(c.green_rate) if c.green_rate is not None else None,
        "property_company": c.property_company,
        "property_fee": float(c.property_fee) if c.property_fee is not None else None,
        "delivery_date": str(c.delivery_date) if c.delivery_date else None,
        "decoration_status": c.decoration_status,
        "school_district": c.school_district,
        "metro_distance": c.metro_distance,
        "metro_line": c.metro_line,
        "status": c.status, "tags": c.tags,
        "description": c.description,
        "is_featured": bool(c.is_featured),
        "floor_min": c.floor_min,
        "floor_max": c.floor_max,
        "price_per_sqm": float(c.price_per_sqm) if c.price_per_sqm else None,
        "total_price_min": float(c.total_price_min) if c.total_price_min else None,
        "total_price_max": float(c.total_price_max) if c.total_price_max else None,
        "area_min": float(c.area_min) if c.area_min else None,
        "area_max": float(c.area_max) if c.area_max else None,
        "owner_id": c.owner_id,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


# -- Communities CRUD --

@router.get("/communities")
async def list_communities(
    page: int = 1, page_size: int = 20,
    keyword: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """分页查询小区列表"""
    q = db.query(Community)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(Community.name.contains(like), Community.address.contains(like)))
    if status_filter:
        q = q.filter(Community.status == status_filter)
    total = q.count()
    rows = q.order_by(Community.sort_order.desc(), Community.id.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return {
        "success": True,
        "data": [_serialize_community(c, db) for c in rows],
        "pagination": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("/communities", status_code=201)
async def create_community(
    data: CommunityCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员创建小区"""
    district_id = data.district_id
    if not district_id:
        city = (data.city or "").strip()
        # 前端可能传 `district` 字段 (区/县名) 或 `district_name`
        district_name = (data.district or "").strip() or (data.district_name or "").strip()
        province = (data.province or "").strip()
        if not (city and district_name):
            raise HTTPException(
                status_code=400,
                detail="必须提供 district_id，或同时提供 city 与 district（区/县）字段",
            )
        district_id = _upsert_district(
            db, city=city, district=district_name, province=province,
        )

    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=400, detail="区域不存在")
    c = Community(
        name=data.name, district_id=data.district_id, alias=data.alias,
        address=data.address, developer=data.developer,
        property_type=data.property_type, total_households=data.total_households,
        plot_ratio=data.plot_ratio, green_rate=data.green_rate,
        property_company=data.property_company, property_fee=data.property_fee,
        delivery_date=data.delivery_date, decoration_status=data.decoration_status,
        school_district=data.school_district, metro_distance=data.metro_distance,
        metro_line=data.metro_line, status=data.status, tags=data.tags,
        description=data.description, price_per_sqm=data.price_per_sqm,
        total_price_min=data.total_price_min, total_price_max=data.total_price_max,
        area_min=data.area_min, area_max=data.area_max,
        floor_min=data.floor_min, floor_max=data.floor_max,
        province=data.province,
        city=data.city or district.city,
        district_name=data.district_name or district.name,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"success": True, "community": _serialize_community(c, db)}


@router.get("/communities/{community_id}")
async def get_community(
    community_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """获取小区详情（含楼栋列表）"""
    c = db.query(Community).filter(Community.id == community_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在")
    result = _serialize_community(c, db)
    buildings = db.query(Building).filter(
        Building.community_id == community_id
    ).order_by(Building.sort_order, Building.id).all()
    result["buildings"] = []
    for b in buildings:
        hts = db.query(HouseType).filter(HouseType.building_id == b.id).all()
        result["buildings"].append({
            "id": b.id, "name": b.name, "building_number": b.building_number,
            "building_type": b.building_type, "total_floors": b.total_floors,
            "floor_min": b.floor_min, "floor_max": b.floor_max,
            "units_per_floor": b.units_per_floor, "unit_count": b.unit_count,
            "elevator_count": b.elevator_count, "orientation": b.orientation,
            "status": b.status,
            "house_types": [{
                "id": h.id, "name": h.name, "bedrooms": h.bedrooms,
                "living_rooms": h.living_rooms, "bathrooms": h.bathrooms,
                "area": float(h.area) if h.area else None,
                "total_price": float(h.total_price) if h.total_price else None,
                "floor_min": h.floor_min, "floor_max": h.floor_max,
                "orientation": h.orientation,
                "units": [{
                    "id": u.id, "room_number": u.room_number, "floor": u.floor,
                    "total_price": float(u.total_price) if u.total_price else None,
                    "area": float(u.area) if u.area else None,
                    "orientation": u.orientation, "status_tag": u.status_tag,
                    "tags": u.tags,
                } for u in db.query(UnitModel).filter(
                    UnitModel.house_type_id == h.id
                ).order_by(UnitModel.floor, UnitModel.sort_order).all()],
            } for h in hts],
        })
    return {"success": True, "community": result}


@router.put("/communities/{community_id}")
async def update_community(
    community_id: int, data: CommunityUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员更新小区"""
    c = db.query(Community).filter(Community.id == community_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return {"success": True, "community": _serialize_community(c, db)}


@router.delete("/communities/{community_id}")
async def delete_community(
    community_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """管理员下架小区（软删除）"""
    c = db.query(Community).filter(Community.id == community_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在")
    c.status = "已下架"
    db.commit()
    return {"success": True}


# -- Buildings CRUD --

@router.get("/communities/{community_id}/buildings")
async def list_buildings(
    community_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """列出小区下的所有楼栋"""
    c = db.query(Community).filter(Community.id == community_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在")
    buildings = db.query(Building).filter(
        Building.community_id == community_id
    ).order_by(Building.sort_order, Building.id).all()
    return {
        "success": True,
        "buildings": [{
            "id": b.id, "name": b.name, "building_number": b.building_number,
            "building_type": b.building_type, "total_floors": b.total_floors,
            "floor_min": b.floor_min, "floor_max": b.floor_max,
            "units_per_floor": b.units_per_floor, "unit_count": b.unit_count,
            "elevator_count": b.elevator_count, "orientation": b.orientation,
            "status": b.status,
        } for b in buildings],
    }


@router.post("/communities/{community_id}/buildings", status_code=201)
async def create_building(
    community_id: int, data: BuildingCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """在小区下创建楼栋"""
    c = db.query(Community).filter(Community.id == community_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在")
    b = Building(
        community_id=community_id, name=data.name,
        building_number=data.building_number, building_type=data.building_type,
        total_floors=data.total_floors, floor_min=data.floor_min,
        floor_max=data.floor_max, units_per_floor=data.units_per_floor,
        unit_count=data.unit_count, elevator_count=data.elevator_count,
        orientation=data.orientation, delivery_date=data.delivery_date,
        decoration_status=data.decoration_status,
        metro_distance=data.metro_distance, status=data.status,
    )
    db.add(b)
    db.commit()
    # 更新小区楼栋数
    new_count = db.query(func.count(Building.id)).filter(
        Building.community_id == community_id
    ).scalar() or 0
    db.query(Community).filter(Community.id == community_id).update(
        {"building_count": new_count}
    )
    db.commit()
    db.refresh(b)
    return {"success": True, "building": {"id": b.id, "name": b.name, "floor_min": b.floor_min, "floor_max": b.floor_max}}


@router.put("/buildings/{building_id}")
async def update_building(
    building_id: int, data: BuildingUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """更新楼栋信息"""
    b = db.query(Building).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="楼栋不存在")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(b, field, value)
    db.commit()
    db.refresh(b)
    return {"success": True, "building": {"id": b.id, "name": b.name}}


@router.delete("/buildings/{building_id}")
async def delete_building(
    building_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """删除楼栋（CASCADE 到户型）"""
    b = db.query(Building).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="楼栋不存在")
    cid = b.community_id
    db.delete(b)
    db.commit()
    new_count = db.query(func.count(Building.id)).filter(
        Building.community_id == cid
    ).scalar() or 0
    db.query(Community).filter(Community.id == cid).update(
        {"building_count": new_count}
    )
    db.commit()
    return {"success": True}


# -- HouseType under Building --

@router.post("/buildings/{building_id}/house-types", status_code=201)
async def create_house_type(
    building_id: int, data: HouseTypeCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """在楼栋下添加户型"""
    b = db.query(Building).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="楼栋不存在")
    h = HouseType(
        building_id=building_id,
        name=data.name, bedrooms=data.bedrooms,
        living_rooms=data.living_rooms, bathrooms=data.bathrooms,
        area=data.area, total_price=data.total_price,
        floor_min=data.floor_min, floor_max=data.floor_max,
        orientation=data.orientation, description=data.description,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return {"success": True, "house_type": {"id": h.id, "name": h.name, "building_id": h.building_id}}


# ── Units (房间) CRUD ──────────────────────────────────────────────


@router.get("/buildings/{building_id}/units")
async def list_units(
    building_id: int,
    page: int = 1,
    page_size: int = 50,
    status_tag: Optional[str] = None,
    house_type_id: Optional[int] = None,
    floor_min: Optional[int] = None,
    floor_max: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """楼栋下房间列表（支持筛选）"""
    bld = db.query(Building).filter(Building.id == building_id).first()
    if not bld:
        raise HTTPException(status_code=404, detail="楼栋不存在")

    q = db.query(UnitModel).filter(UnitModel.building_id == building_id)
    if status_tag:
        q = q.filter(UnitModel.status_tag == status_tag)
    if house_type_id:
        q = q.filter(UnitModel.house_type_id == house_type_id)
    if floor_min is not None:
        q = q.filter(UnitModel.floor >= floor_min)
    if floor_max is not None:
        q = q.filter(UnitModel.floor <= floor_max)

    total = q.count()
    units = q.order_by(
        UnitModel.floor.asc(), UnitModel.sort_order.asc(), UnitModel.id.asc()
    ).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "success": True,
        "data": [_serialize_unit(u) for u in units],
        "pagination": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("/buildings/{building_id}/units", status_code=201)
async def create_units(
    building_id: int,
    data: UnitBatchCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """批量创建房间"""
    bld = db.query(Building).filter(Building.id == building_id).first()
    if not bld:
        raise HTTPException(status_code=404, detail="楼栋不存在")

    created = []
    for item in data.units:
        ht = db.query(HouseType).filter(
            HouseType.id == item.house_type_id,
            HouseType.building_id == building_id,
        ).first()
        if not ht:
            raise HTTPException(
                status_code=400,
                detail=f"户型 {item.house_type_id} 不属于楼栋 {building_id}",
            )
        u = UnitModel(
            building_id=building_id,
            house_type_id=item.house_type_id,
            room_number=item.room_number,
            floor=item.floor,
            area=item.area,
            total_price=item.total_price,
            orientation=item.orientation,
            status_tag=item.status_tag,
            tags=item.tags,
            description=item.description,
            sort_order=item.sort_order,
        )
        db.add(u)
        created.append(u)

    db.commit()
    return {
        "success": True,
        "message": f"已创建 {len(created)} 个房间",
        "ids": [u.id for u in created],
    }


@router.get("/units/{unit_id}")
async def get_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """房间详情"""
    u = db.query(UnitModel).filter(UnitModel.id == unit_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="房间不存在")
    return {"success": True, "unit": _serialize_unit(u)}


@router.put("/units/{unit_id}")
async def update_unit(
    unit_id: int,
    data: UnitUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """更新房间"""
    u = db.query(UnitModel).filter(UnitModel.id == unit_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="房间不存在")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(u, field, value)
    db.commit()
    db.refresh(u)
    return {"success": True, "unit": _serialize_unit(u)}


@router.delete("/units/{unit_id}")
async def delete_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """删除房间"""
    u = db.query(UnitModel).filter(UnitModel.id == unit_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="房间不存在")
    db.delete(u)
    db.commit()
    return {"success": True, "message": f"房间 {u.room_number} 已删除"}


@router.patch("/units/batch")
async def batch_update_units(
    data: UnitBatchUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """批量更新房间（改价、改状态等）"""
    units = db.query(UnitModel).filter(UnitModel.id.in_(data.unit_ids)).all()
    if not units:
        raise HTTPException(status_code=404, detail="未找到匹配的房间")

    updates = data.updates
    count = 0
    for u in units:
        if "total_price_adjust" in updates:
            adjust_str = str(updates["total_price_adjust"])
            current = float(u.total_price or 0)
            if adjust_str.endswith("%"):
                pct = float(adjust_str[:-1]) / 100.0
                u.total_price = current * (1 + pct)
            else:
                delta = float(adjust_str.replace("+", ""))
                u.total_price = current + delta
            count += 1
        for field in ("status_tag", "tags", "description"):
            if field in updates:
                setattr(u, field, updates[field])
                if field == "status_tag":
                    count += 1

    db.commit()
    return {"success": True, "message": f"已更新 {count} 个房间"}


@router.post("/buildings/{building_id}/units/generate", status_code=201)
async def generate_units(
    building_id: int,
    data: UnitGenerateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """批量生成房间号。

    按指定的户型、楼层范围和房间号模板，自动批量生成房间。
    支持楼层差价（price_floor_adjust）——每升高一层自动加减价。

    房间号模板变量：
    - {floor} → 楼层号
    - {floor2} → 楼层号补零2位（如 03）
    - {room} → 户序号（从1起）
    """
    bld = db.query(Building).filter(Building.id == building_id).first()
    if not bld:
        raise HTTPException(status_code=404, detail="楼栋不存在")

    ht = db.query(HouseType).filter(
        HouseType.id == data.house_type_id,
        HouseType.building_id == building_id,
    ).first()
    if not ht:
        raise HTTPException(
            status_code=400,
            detail=f"户型 {data.house_type_id} 不属于楼栋 {building_id}",
        )

    created = []
    for floor in range(data.floor_start, data.floor_end + 1):
        for room_idx in range(1, data.rooms_per_floor + 1):
            room_number = (
                data.room_number_pattern
                .replace("{floor}", str(floor))
                .replace("{floor2}", f"{floor:02d}")
                .replace("{room}", str(room_idx))
            )

            price = data.total_price if data.total_price is not None else (
                float(ht.total_price) if ht.total_price else None
            )
            if price is not None and data.price_floor_adjust is not None:
                price = price + data.price_floor_adjust * (floor - data.floor_start)

            area = data.area if data.area is not None else (
                float(ht.area) if ht.area else None
            )

            orientation = data.orientation or ht.orientation

            u = UnitModel(
                building_id=building_id,
                house_type_id=data.house_type_id,
                room_number=room_number,
                floor=floor,
                area=area,
                total_price=price,
                orientation=orientation,
                status_tag=data.status_tag,
                tags=data.tags,
            )
            db.add(u)
            created.append(u)

    db.commit()
    return {
        "success": True,
        "message": f"已生成 {len(created)} 个房间（{data.floor_start}-{data.floor_end}层，每层{data.rooms_per_floor}户）",
        "count": len(created),
        "ids": [u.id for u in created],
    }
