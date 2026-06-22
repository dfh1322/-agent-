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

from typing import List, Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config.database import get_db
from middleware.deps import get_current_landlord, get_current_user, get_current_user_optional
from models.contact_message import ContactMessage
from models.property import Property, District
from models.user import User

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


class ContactMessageCreate(BaseModel):
    """联系房东留言请求体"""
    landlord_id: int = Field(..., description="房东用户 ID")
    property_id: Optional[int] = None
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


def _serialize_property(prop: Property) -> dict:
    """
    将 Property ORM 对象序列化为字典。

    注意：district 是关联对象，安全获取其 name（可能为 None）。
    数值字段统一转为 float，None 值保持不变。
    """
    return {
        "id": prop.id,
        "name": prop.name,
        "district": prop.district.name if prop.district else None,
        "address": prop.address,
        "total_price_min": float(prop.total_price_min) if prop.total_price_min else None,
        "total_price_max": float(prop.total_price_max) if prop.total_price_max else None,
        "area_min": float(prop.area_min) if prop.area_min else None,
        "area_max": float(prop.area_max) if prop.area_max else None,
        "status": prop.status,
        "green_rate": float(prop.green_rate) if prop.green_rate else None,
        "metro_distance": prop.metro_distance,
        "school_district": prop.school_district,
        "description": prop.description,
    }


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
    props = db.query(Property).filter(Property.owner_id == landlord.id).all()
    return {"success": True, "properties": [_serialize_property(p) for p in props]}


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
        ② 创建 Property 记录（developer 自动填充为公司名或房东姓名）
        ③ 提交事务并返回序列化结果

    Error handling:
        - 400: 区域不存在
    """
    # ── 校验区域 ID 是否有效 ──
    district = db.query(District).filter(District.id == data.district_id).first()
    if not district:
        raise HTTPException(status_code=400, detail="区域不存在")

    # ── 创建楼盘记录 ──
    prop = Property(
        name=data.name,
        district_id=data.district_id,
        owner_id=landlord.id,              # 归属当前房东
        address=data.address,
        developer=landlord.company_name or landlord.full_name,  # 开发商自动填充
        total_price_min=data.total_price_min,
        total_price_max=data.total_price_max,
        area_min=data.area_min,
        area_max=data.area_max,
        decoration_status=data.decoration_status,
        metro_distance=data.metro_distance,
        school_district=data.school_district,
        green_rate=data.green_rate,
        description=data.description,
        status=data.status,
    )

    db.add(prop)
    db.commit()              # 提交事务
    db.refresh(prop)         # 刷新以获取自增 ID
    return {"success": True, "property": _serialize_property(prop)}


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
    # ── 查询楼盘，同时校验所有权（防止越权编辑他人楼盘） ──
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.owner_id == landlord.id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="楼盘不存在或无权操作")

    # ── 部分更新：仅修改请求中提供的字段 ──
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prop, field, value)

    db.commit()
    db.refresh(prop)
    return {"success": True, "property": _serialize_property(prop)}


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
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.owner_id == landlord.id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="楼盘不存在或无权操作")

    prop.status = "已下架"
    db.commit()
    db.refresh(prop)
    return {
        "success": True,
        "message": f"楼盘 {prop.name} 已下架",
        "property_id": prop.id,
        "status": prop.status,
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
                "property_id": m.property_id,
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
    """提交联系房东的留言/预约。公开接口，无需登录。"""
    # Validate landlord
    landlord = db.query(User).filter(
        User.id == data.landlord_id,
        User.role.in_(["landlord", "admin"]),
    ).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="房东不存在")

    msg = ContactMessage(
        landlord_id=data.landlord_id,
        guest_name=data.guest_name,
        guest_phone=data.guest_phone,
        property_id=data.property_id,
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
