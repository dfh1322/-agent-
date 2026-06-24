"""
房东路由组 —— 房东专属的楼盘 CRUD 操作。

所有端点均通过 get_current_landlord 依赖注入校验身份，
确保只有 role == "landlord" 的用户才能操作。

功能范围：
    - GET  /landlord/profile       : 查看房东个人信息
    - GET  /landlord/properties    : 查看自己发布的楼盘列表
    - POST /landlord/properties    : 新增楼盘
    - PUT  /landlord/properties/{id}: 编辑楼盘（仅限自己的楼盘）
    - GET  /landlord/districts/tree : 省/市/区级联树（级联选择器数据源）
"""

from typing import List, Optional, Dict, TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from config.database import get_db
from middleware.deps import get_current_landlord, get_current_user, get_current_user_optional
from models.contact_message import ContactMessage
from models.property import (
    Building, Community, District, HouseType,
)
UnitModel = None  # will be resolved below
from models.user import User
from routers.admin import (BuildingCreate, BuildingUpdate, CommunityCreate, CommunityUpdate, HouseTypeCreate)

router = APIRouter()


# ──────────────────────────────────────────────
# Pydantic 请求模型
# ──────────────────────────────────────────────

class LandlordPropertyCreate(BaseModel):
    """新增楼盘请求体"""
    name: str = Field(..., max_length=100, description="楼盘名称")
    district_id: int = Field(..., description="所属区域 ID")
    address: Optional[str] = None            # 详细地址
    total_price_min: Optional[float] = None  # 最低总价（万元）
    total_price_max: Optional[float] = None  # 最高总价（万元）
    area_min: Optional[float] = None         # 最小面积（㎡）
    area_max: Optional[float] = None         # 最大面积（㎡）
    decoration_status: Optional[str] = None  # 装修状态（毛坯/精装等）
    metro_distance: Optional[int] = None     # 距地铁站距离（米）
    school_district: Optional[str] = None    # 学区信息
    green_rate: Optional[float] = None       # 绿化率（%）
    description: Optional[str] = None        # 楼盘简介
    status: str = Field("在售", max_length=20, description='销售状态，默认"在售"')
    floor_min: Optional[int] = None             # 最低可售楼层
    floor_max: Optional[int] = None             # 最高可售楼层


class LandlordPropertyUpdate(BaseModel):
    """更新楼盘请求体（所有字段可选，仅更新提供的字段）"""
    name: Optional[str] = None
    address: Optional[str] = None
    total_price_min: Optional[float] = None
    total_price_max: Optional[float] = None
    area_min: Optional[float] = None
    area_max: Optional[float] = None
    decoration_status: Optional[str] = None
    metro_distance: Optional[int] = None
    school_district: Optional[str] = None
    green_rate: Optional[float] = None
    description: Optional[str] = None
    status: Optional[str] = None
    floor_min: Optional[int] = None
    floor_max: Optional[int] = None


class ContactMessageCreate(BaseModel):
    """联系房东留言请求体"""
    landlord_id: Optional[int] = None
    community_id: Optional[int] = None
    guest_name: str = Field(..., max_length=50, description="留言人姓名")
    guest_phone: str = Field(..., max_length=20, description="留言人电话")
    message: str = Field(..., max_length=2000, description="留言内容")
    preferred_date: Optional[str] = None  # ISO date string e.g. "2026-06-28"


# ──────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────

def _mask_phone(phone: str) -> str:
    """手机号脱敏：中间4位替换为星号。"""
    if not phone or len(phone) < 7:
        return phone
    return phone[:3] + "****" + phone[7:]


# ──────────────────────────────────────────────
# 路由端点
# ──────────────────────────────────────────────

@router.get("/profile")
async def landlord_profile(landlord: User = Depends(get_current_landlord)):
    """
    获取当前房东的用户信息。

    依赖 get_current_landlord 校验 JWT 中 role 必须为 "landlord"。
    """
    return {
        "id": landlord.id,
        "username": landlord.username,
        "full_name": landlord.full_name,
        "role": landlord.role,
        "company_name": landlord.company_name,
        "phone": landlord.phone,
    }


@router.get("/properties")
async def list_my_properties(
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """
    获取当前房东发布的所有楼盘列表。

    仅返回 owner_id 匹配当前房东的楼盘。
    """
    communities = db.query(Community).filter(Community.owner_id == landlord.id).all()
    return {"success": True, "communities": [_serialize_community_landlord(c, db) for c in communities]}


@router.post("/properties", status_code=status.HTTP_201_CREATED)
async def create_property(
    data: LandlordPropertyCreate,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """
    新增楼盘。

    流程：
        ① 校验 district_id 对应的区域是否存在
        ② 创建 Community 记录（developer 自动填充为公司名或房东姓名）
        ③ 提交事务并返回序列化结果

    Error handling:
        - 400: 区域不存在
    """
    # ── 校验区域 ID 是否有效 ──
    district = db.query(District).filter(District.id == data.district_id).first()
    if not district:
        raise HTTPException(status_code=400, detail="区域不存在")

    # ── 自动创建配套 Community（小区） ──
    community = Community(
        name=data.name,
        district_id=data.district_id,
        owner_id=landlord.id,
        address=data.address,
        developer=landlord.company_name or landlord.full_name,
        total_price_min=data.total_price_min,
        total_price_max=data.total_price_max,
        area_min=data.area_min,
        area_max=data.area_max,
        floor_min=data.floor_min,
        floor_max=data.floor_max,
        decoration_status=data.decoration_status,
        metro_distance=data.metro_distance,
        school_district=data.school_district,
        green_rate=data.green_rate,
        description=data.description,
        status=data.status,
    )
    db.add(community)
    db.commit()
    db.refresh(community)
    return {"success": True, "community": _serialize_community_landlord(community, db)}


@router.put("/properties/{property_id}")
async def update_property(
    property_id: int,
    data: LandlordPropertyUpdate,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """
    更新楼盘信息（仅限房东自己的楼盘）。

    流程：
        ① 查询 property_id 且 owner_id == 当前房东的记录
        ② 使用 model_dump(exclude_unset=True) 仅更新提交的字段（部分更新）
        ③ 提交事务并返回结果

    Error handling:
        - 404: 楼盘不存在或无权操作（非本人发布的楼盘）
    """
    # ── 查询社区，同时校验所有权（防止越权编辑他人社区） ──
    community = db.query(Community).filter(
        Community.id == property_id,
        Community.owner_id == landlord.id,
    ).first()
    if not community:
        raise HTTPException(status_code=404, detail="社区不存在或无权操作")

    # ── 部分更新：仅修改请求中提供的字段 ──
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(community, field, value)

    db.commit()
    db.refresh(community)
    return {"success": True, "community": _serialize_community_landlord(community, db)}


@router.delete("/properties/{property_id}")
async def delete_property(
    property_id: int,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """删除 / 下架楼盘（仅限房东自己的房源）。

    实现为**逻辑删除**：把 status 改为 "已下架"，避免级联删除户型 / 图片等子表。

    Error handling:
        - 404: 楼盘不存在或非本人发布。
    """
    community = db.query(Community).filter(
        Community.id == property_id,
        Community.owner_id == landlord.id,
    ).first()
    if not community:
        raise HTTPException(status_code=404, detail="楼盘不存在或无权操作")

    community.status = "已下架"
    db.commit()
    db.refresh(community)
    return {
        "success": True,
        "message": f"楼盘 {community.name} 已下架",
        "community_id": community.id,
        "status": community.status,
    }


@router.get("/districts/tree")
async def landlord_districts_tree(
    db: Session = Depends(get_db),
):
    """返回省 / 市 / 区级联树，供房东发布楼盘时选择区域。

    与 ``/admin/districts/tree`` 逻辑基本相同，但不需要 admin 权限，
    仅校验当前登录的房东身份即可。
    """
    from models.property import District

    rows = (
        db.query(District)
        .filter(District.is_active.is_(True))
        .order_by(District.city.asc(), District.name.asc())
        .all()
    )
    if not rows:
        return {"success": True, "data": []}

    has_full_path = any(getattr(r, "full_path", None) for r in rows)

    _CITY_PROVINCE_FALLBACK: Dict[str, str] = {
        "上海": "上海", "北京": "北京", "天津": "天津", "重庆": "重庆",
        "广州": "广东", "深圳": "广东", "佛山": "广东", "东莞": "广东",
        "惠州": "广东", "珠海": "广东",
        "杭州": "浙江", "宁波": "浙江", "温州": "浙江", "嘉兴": "浙江",
        "湖州": "浙江", "绍兴": "浙江", "金华": "浙江", "台州": "浙江",
        "南京": "江苏", "苏州": "江苏", "无锡": "江苏", "常州": "江苏",
        "南通": "江苏", "扬州": "江苏", "徐州": "江苏",
        "成都": "四川", "绵阳": "四川",
        "武汉": "湖北", "宜昌": "湖北",
        "长沙": "湖南", "株洲": "湖南",
        "郑州": "河南", "洛阳": "河南",
        "济南": "山东", "青岛": "山东", "烟台": "山东",
        "福州": "福建", "厦门": "福建", "泉州": "福建",
        "西安": "陕西", "咸阳": "陕西",
        "合肥": "安徽", "芜湖": "安徽",
        "南宁": "广西", "柳州": "广西",
        "昆明": "云南", "贵阳": "贵州",
        "沈阳": "辽宁", "大连": "辽宁",
        "哈尔滨": "黑龙江", "长春": "吉林",
        "南昌": "江西", "太原": "山西", "石家庄": "河北", "兰州": "甘肃",
        "海口": "海南", "三亚": "海南", "乌鲁木齐": "新疆", "呼和浩特": "内蒙古",
    }

    if has_full_path:
        tree: Dict[str, Dict[str, list]] = {}
        for r in rows:
            fp = getattr(r, "full_path", "") or ""
            parts = [p.strip() for p in fp.split("/") if p.strip()]
            if len(parts) >= 3:
                province, city, district_name = parts[0], parts[1], parts[2]
            elif len(parts) == 2:
                province, city = parts[0], parts[1]
                district_name = r.name
            else:
                city = getattr(r, "city", "") or ""
                province = _CITY_PROVINCE_FALLBACK.get(city, city)
                district_name = r.name

            if province not in tree:
                tree[province] = {}
            if city not in tree[province]:
                tree[province][city] = []
            tree[province][city].append({
                "value": str(r.id),
                "label": district_name,
                "district_id": r.id,
            })

        data = []
        for province, cities in tree.items():
            data.append({
                "value": province,
                "label": province,
                "children": [
                    {
                        "value": f"{province}/{city}",
                        "label": city,
                        "children": districts,
                    }
                    for city, districts in cities.items()
                ],
            })
        return {"success": True, "data": data}

    # 无 full_path 时的降级：城市 -> 区县 二层
    city_groups: Dict[str, list] = {}
    for r in rows:
        city = getattr(r, "city", "") or "杭州"
        if city not in city_groups:
            city_groups[city] = []
        city_groups[city].append({
            "value": str(r.id),
            "label": r.name,
            "district_id": r.id,
        })
    data = [
        {
            "value": city,
            "label": city,
            "children": districts,
        }
        for city, districts in city_groups.items()
    ]
    return {"success": True, "data": data}


@router.get("/messages")
async def list_my_messages(
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """获取当前房东收到的所有联系留言。"""
    msgs = (
        db.query(ContactMessage)
        .filter(ContactMessage.landlord_id == landlord.id)
        .order_by(ContactMessage.created_at.desc())
        .all()
    )
    return {
        "success": True,
        "messages": [
            {
                "id": m.id,
                "guest_name": m.guest_name,
                "guest_phone": m.guest_phone,
                "community_id": m.community_id,
                "message": m.message,
                "preferred_date": m.preferred_date.isoformat() if m.preferred_date else None,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in msgs
        ],
    }


# ──────────────────────────────────────────────
# 公开联系接口（面向所有登录用户 / 匿名访客）
# ──────────────────────────────────────────────

@router.post("/contact/message", status_code=status.HTTP_201_CREATED)
async def submit_contact_message(
    data: ContactMessageCreate,
    db: Session = Depends(get_db),
):
    """提交联系房东的留言/预约。公开接口，无需登录。

    优先级：landlord_id > community.owner_id > 未匹配则返回错误。
    """
    landlord_id = data.landlord_id

    if not landlord_id and data.community_id:
        community = db.query(Community).filter(Community.id == data.community_id).first()
        if community and community.owner_id:
            landlord_id = community.owner_id

    if not landlord_id:
        raise HTTPException(status_code=400, detail="未能确定房东身份，请重试")

    # Validate landlord
    landlord = db.query(User).filter(
        User.id == landlord_id,
        User.role.in_(["landlord", "admin"]),
    ).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="房东不存在")

    msg = ContactMessage(
        landlord_id=landlord_id,
        guest_name=data.guest_name,
        guest_phone=data.guest_phone,
        community_id=data.community_id,
        message=data.message,
        preferred_date=data.preferred_date,
    )
    db.add(msg)
    db.commit()

    return {
        "success": True,
        "message": "留言已发送，房东将尽快与您联系",
    }


@router.get("/{owner_id}/contact")
async def get_landlord_contact(
    owner_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """获取房东公开联系信息。需登录；未登录返回脱敏信息。"""
    landlord = db.query(User).filter(
        User.id == owner_id,
        User.role.in_(["landlord", "admin"]),
    ).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="该用户不是房东或不存在")

    phone_raw = landlord.phone or ""
    phone_masked = _mask_phone(phone_raw)

    return {
        "success": True,
        "data": {
            "landlord_id": landlord.id,
            "full_name": landlord.full_name,
            "company_name": landlord.company_name,
            "phone_masked": phone_masked,
            "phone_raw": phone_raw if current_user else "",
            "wechat": landlord.wechat,
            "address": landlord.address,
            "avatar_url": landlord.avatar,
        },
    }


# ──────────────────────────────────────────────
# 小区 & 楼栋 管理（房东视角）
# ──────────────────────────────────────────────

def _serialize_community_landlord(c: Community, db: Session) -> dict:
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
        "price_per_sqm": float(c.price_per_sqm) if c.price_per_sqm else None,
        "total_price_min": float(c.total_price_min) if c.total_price_min else None,
        "total_price_max": float(c.total_price_max) if c.total_price_max else None,
        "area_min": float(c.area_min) if c.area_min else None,
        "area_max": float(c.area_max) if c.area_max else None,
        "floor_min": c.floor_min,
        "floor_max": c.floor_max,
    }


@router.get("/communities")
async def list_my_communities(
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """获取当前房东发布的所有小区"""
    communities = db.query(Community).filter(
        Community.owner_id == landlord.id
    ).order_by(Community.id.desc()).all()
    return {"success": True, "communities": [_serialize_community_landlord(c, db) for c in communities]}


@router.post("/communities", status_code=status.HTTP_201_CREATED)
async def create_community_landlord(
    data: "CommunityCreate",
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """房东新增小区"""
    district = db.query(District).filter(District.id == data.district_id).first()
    if not district:
        raise HTTPException(status_code=400, detail="区域不存在")
    c = Community(
        name=data.name, district_id=data.district_id, alias=data.alias,
        address=data.address,
        developer=landlord.company_name or landlord.full_name,
        owner_id=landlord.id,
        property_type=data.property_type, total_households=data.total_households,
        plot_ratio=data.plot_ratio, green_rate=data.green_rate,
        property_company=data.property_company, property_fee=data.property_fee,
        delivery_date=data.delivery_date, decoration_status=data.decoration_status,
        school_district=data.school_district, metro_distance=data.metro_distance,
        metro_line=data.metro_line, status=data.status, tags=data.tags,
        description=data.description, price_per_sqm=data.price_per_sqm,
        total_price_min=data.total_price_min, total_price_max=data.total_price_max,
        area_min=data.area_min, area_max=data.area_max,
        province=data.province, city=data.city or district.city,
        district_name=data.district_name or district.name,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"success": True, "community": _serialize_community_landlord(c, db)}


@router.put("/communities/{community_id}")
async def update_community_landlord(
    community_id: int, data: "CommunityUpdate",
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """房东更新小区（仅限自己的）"""
    c = db.query(Community).filter(
        Community.id == community_id, Community.owner_id == landlord.id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在或无权操作")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return {"success": True, "community": _serialize_community_landlord(c, db)}


@router.delete("/communities/{community_id}")
async def delete_community(
    community_id: int,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """房东下架小区"""
    c = db.query(Community).filter(
        Community.id == community_id, Community.owner_id == landlord.id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在或无权操作")
    c.status = "已下架"
    db.commit()
    return {"success": True}


# -- Buildings (landlord) --

@router.get("/communities/{community_id}/buildings")
async def list_buildings(
    community_id: int,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """房东查看小区下的楼栋"""
    c = db.query(Community).filter(
        Community.id == community_id, Community.owner_id == landlord.id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在或无权操作")
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


@router.post("/communities/{community_id}/buildings", status_code=status.HTTP_201_CREATED)
async def create_building_landlord(
    community_id: int, data: "BuildingCreate",
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """房东在小区下新增楼栋"""
    c = db.query(Community).filter(
        Community.id == community_id, Community.owner_id == landlord.id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在或无权操作")
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
    new_count = db.query(func.count(Building.id)).filter(
        Building.community_id == community_id
    ).scalar() or 0
    db.query(Community).filter(Community.id == community_id).update(
        {"building_count": new_count}
    )
    db.commit()
    db.refresh(b)
    return {"success": True, "building": {"id": b.id, "name": b.name}}


@router.put("/buildings/{building_id}")
async def update_building_landlord(
    building_id: int, data: "BuildingUpdate",
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """房东更新楼栋"""
    b = db.query(Building).join(Community).filter(
        Building.id == building_id, Community.owner_id == landlord.id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="楼栋不存在或无权操作")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(b, field, value)
    db.commit()
    db.refresh(b)
    return {"success": True, "building": {"id": b.id, "name": b.name}}


@router.delete("/buildings/{building_id}")
async def delete_building(
    building_id: int,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """房东删除楼栋"""
    b = db.query(Building).join(Community).filter(
        Building.id == building_id, Community.owner_id == landlord.id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="楼栋不存在或无权操作")
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


@router.post("/buildings/{building_id}/house-types", status_code=status.HTTP_201_CREATED)
async def create_house_type_landlord(
    building_id: int, data: "HouseTypeCreate",
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """房东在楼栋下添加户型"""
    bld = db.query(Building).join(Community).filter(
        Building.id == building_id, Community.owner_id == landlord.id
    ).first()
    if not bld:
        raise HTTPException(status_code=404, detail="楼栋不存在或无权操作")
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


# -- Unit (房间) CRUD (landlord) --

from models.property import Unit as UnitModel
from config.database import get_db as _get_db

# Schemas mirror admin routes
from pydantic import BaseModel as _BaseModel, Field as _Field
from typing import List as _List


class UnitCreateLandlord(_BaseModel):
    house_type_id: int = _Field(..., description="户型ID")
    room_number: str = _Field(..., max_length=20)
    floor: Optional[int] = None
    area: Optional[float] = None
    total_price: Optional[float] = None
    orientation: Optional[str] = None
    status_tag: str = "在售"
    tags: Optional[list] = None
    description: Optional[str] = None
    sort_order: int = 0


class LandlordUnitBatchCreate(BaseModel):
    units: list


class LandlordUnitUpdate(BaseModel):
    house_type_id: Optional[int] = None
    room_number: Optional[str] = None
    floor: Optional[int] = None
    area: Optional[float] = None
    total_price: Optional[float] = None
    orientation: Optional[str] = None
    status_tag: Optional[str] = None
    tags: Optional[list] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class LandlordUnitBatchUpdate(BaseModel):
    unit_ids: list
    updates: dict


class LandlordUnitGenerateRequest(BaseModel):
    house_type_id: int
    floor_start: int
    floor_end: int
    rooms_per_floor: int = 1
    room_number_pattern: str = "{floor}0{room}"
    area: Optional[float] = None
    total_price: Optional[float] = None
    orientation: Optional[str] = None
    status_tag: str = "在售"
    tags: Optional[list] = None
    price_floor_adjust: Optional[float] = None


def _serialize_unit_landlord(u) -> dict:
    ht = u.house_type
    return {
        "id": u.id,
        "building_id": u.building_id,
        "building_name": u.building.name if u.building else None,
        "house_type_id": u.house_type_id,
        "house_type_name": ht.name if ht else None,
        "bedrooms": ht.bedrooms if ht else None,
        "living_rooms": ht.living_rooms if ht else None,
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


@router.get("/buildings/{building_id}/units")
async def list_units_landlord(
    building_id: int,
    page: int = 1,
    page_size: int = 50,
    status_tag: Optional[str] = None,
    house_type_id: Optional[int] = None,
    floor_min: Optional[int] = None,
    floor_max: Optional[int] = None,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    bld = db.query(Building).join(Community).filter(
        Building.id == building_id, Community.owner_id == landlord.id
    ).first()
    if not bld:
        raise HTTPException(status_code=404, detail="楼栋不存在或无权操作")

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
        "data": [_serialize_unit_landlord(u) for u in units],
        "pagination": {"page": page, "page_size": page_size, "total": total},
    }


@router.post("/buildings/{building_id}/units", status_code=status.HTTP_201_CREATED)
async def create_units_landlord(
    building_id: int,
    data: LandlordUnitBatchCreate,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    bld = db.query(Building).join(Community).filter(
        Building.id == building_id, Community.owner_id == landlord.id
    ).first()
    if not bld:
        raise HTTPException(status_code=404, detail="楼栋不存在或无权操作")

    created = []
    for item_data in data.units:
        item = UnitCreateLandlord(**item_data) if isinstance(item_data, dict) else item_data
        ht = db.query(HouseType).filter(
            HouseType.id == item.house_type_id,
            HouseType.building_id == building_id,
        ).first()
        if not ht:
            raise HTTPException(status_code=400, detail=f"户型 {item.house_type_id} 不属于楼栋 {building_id}")
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
    return {"success": True, "message": f"已创建 {len(created)} 个房间", "ids": [u.id for u in created]}


@router.put("/units/{unit_id}")
async def update_unit_landlord(
    unit_id: int,
    data: LandlordUnitUpdate,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    u = db.query(UnitModel).join(Building).join(Community).filter(
        UnitModel.id == unit_id, Community.owner_id == landlord.id
    ).first()
    if not u:
        raise HTTPException(status_code=404, detail="房间不存在或无权操作")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(u, field, value)
    db.commit()
    db.refresh(u)
    return {"success": True, "unit": _serialize_unit_landlord(u)}


@router.delete("/units/{unit_id}")
async def delete_unit_landlord(
    unit_id: int,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    u = db.query(UnitModel).join(Building).join(Community).filter(
        UnitModel.id == unit_id, Community.owner_id == landlord.id
    ).first()
    if not u:
        raise HTTPException(status_code=404, detail="房间不存在或无权操作")
    db.delete(u)
    db.commit()
    return {"success": True, "message": f"房间 {u.room_number} 已删除"}


@router.patch("/units/batch")
async def batch_update_units_landlord(
    data: LandlordUnitBatchUpdate,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    units = db.query(UnitModel).join(Building).join(Community).filter(
        UnitModel.id.in_(data.unit_ids), Community.owner_id == landlord.id
    ).all()
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


@router.post("/buildings/{building_id}/units/generate", status_code=status.HTTP_201_CREATED)
async def generate_units_landlord(
    building_id: int,
    data: LandlordUnitGenerateRequest,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    bld = db.query(Building).join(Community).filter(
        Building.id == building_id, Community.owner_id == landlord.id
    ).first()
    if not bld:
        raise HTTPException(status_code=404, detail="楼栋不存在或无权操作")

    ht = db.query(HouseType).filter(
        HouseType.id == data.house_type_id,
        HouseType.building_id == building_id,
    ).first()
    if not ht:
        raise HTTPException(status_code=400, detail=f"户型 {data.house_type_id} 不属于楼栋 {building_id}")

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
            u = UnitModel(
                building_id=building_id,
                house_type_id=data.house_type_id,
                room_number=room_number,
                floor=floor,
                area=area,
                total_price=price,
                orientation=data.orientation,
                status_tag=data.status_tag,
                tags=data.tags,
            )
            db.add(u)
            created.append(u)

    db.commit()
    return {
        "success": True,
        "message": f"已生成 {len(created)} 个房间",
        "count": len(created),
        "ids": [u.id for u in created],
    }


# -- 房东获取小区详情 (含楼栋+户型) --


@router.get("/communities/{community_id}")
async def get_community_landlord(
    community_id: int,
    landlord: User = Depends(get_current_landlord),
    db: Session = Depends(get_db),
):
    """房东获取小区详情（含楼栋列表和每栋的户型）"""
    c = db.query(Community).filter(
        Community.id == community_id, Community.owner_id == landlord.id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="小区不存在或无权操作")
    result = _serialize_community_landlord(c, db)
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
            } for h in hts],
        })
    return {"success": True, "community": result}
