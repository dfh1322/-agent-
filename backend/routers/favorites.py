"""
收藏与看房计划路由组。

功能：
    - 楼盘收藏（增/删/查）
    - 看房计划（创建/查看/更新）
    - 操作日志记录
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
import json

from config.database import get_db
from middleware.deps import get_current_user
from models.property import (
    Favorite, ViewingPlan, Property, PropertyFacility, PropertyRisk, PropertyImage,
    Conversation, Message,
)
from models.user import User
from models.property import OperationLog


router = APIRouter()


# ──────────────────────────────────────────────
# Pydantic 请求/响应模型
# ──────────────────────────────────────────────

class FavoriteCreate(BaseModel):
    """收藏请求体"""
    property_id: int = Field(..., description="楼盘ID")
    notes: Optional[str] = None


class FavoriteRemove(BaseModel):
    """取消收藏请求体"""
    property_id: int = Field(..., description="楼盘ID")


class ViewingPlanCreate(BaseModel):
    """创建看房计划请求体"""
    title: str = Field(..., max_length=200, description="计划标题")
    property_ids: List[int] = Field(..., description="楼盘ID列表")
    plan_date: Optional[str] = None  # YYYY-MM-DD
    notes: Optional[str] = None


class ViewingPlanUpdate(BaseModel):
    """更新看房计划（所有字段可选）"""
    title: Optional[str] = None
    property_ids: Optional[List[int]] = None
    plan_date: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


# ──────────────────────────────────────────────
# 辅助函数
# ──────────────────────────────────────────────

def _log_operation(db: Session, user: User, action: str, module: str, details: str, request: Request = None):
    """记录操作日志"""
    ip = None
    ua = None
    if request:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
    log = OperationLog(
        user_id=user.id,
        action=action,
        module=module,
        details=details,
        ip_address=ip,
        user_agent=ua,
    )
    db.add(log)
    db.commit()


# ──────────────────────────────────────────────
# 1. 收藏功能
# ──────────────────────────────────────────────

@router.get("/favorites")
async def list_favorites(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取当前用户的收藏列表"""
    favorites = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )

    result = []
    for fav in favorites:
        prop = db.query(Property).filter(Property.id == fav.property_id).first()
        # 实际从 property_images 取首张图片 URL（不再写死 None）
        cover_image: Optional[str] = None
        if prop:
            img = (
                db.query(PropertyImage)
                .filter(PropertyImage.property_id == prop.id)
                .order_by(PropertyImage.sort_order.asc(), PropertyImage.id.asc())
                .first()
            )
            if img and img.image_url:
                cover_image = img.image_url
        result.append({
            "id": fav.id,
            "property_id": fav.property_id,
            "property_name": prop.name if prop else "已下架",
            "property_image": cover_image,
            "notes": fav.notes,
            "created_at": fav.created_at,
            "property": {
                "id": prop.id if prop else None,
                "name": prop.name if prop else None,
                "district": prop.district.name if prop and prop.district else None,
                "total_price_min": float(prop.total_price_min) if prop and prop.total_price_min else None,
                "total_price_max": float(prop.total_price_max) if prop and prop.total_price_max else None,
                "area_min": float(prop.area_min) if prop and prop.area_min else None,
                "area_max": float(prop.area_max) if prop and prop.area_max else None,
                "cover_image": cover_image,
            } if prop else None,
        })

    return {"success": True, "data": result}


@router.post("/favorites", status_code=status.HTTP_201_CREATED)
async def add_favorite(
    data: FavoriteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """收藏楼盘"""
    # 检查是否已收藏
    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.property_id == data.property_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="该楼盘已在收藏列表中")

    # 检查楼盘是否存在
    prop = db.query(Property).filter(Property.id == data.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="楼盘不存在")

    fav = Favorite(
        user_id=user.id,
        property_id=data.property_id,
        notes=data.notes,
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)

    _log_operation(db, user, "add_favorite", "favorites", f"收藏楼盘: {prop.name}", request)

    return {"success": True, "message": "收藏成功", "favorite_id": fav.id}


@router.delete("/favorites")
async def remove_favorite(
    data: FavoriteRemove,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """取消收藏"""
    fav = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.property_id == data.property_id)
        .first()
    )
    if not fav:
        raise HTTPException(status_code=404, detail="收藏记录不存在")

    db.delete(fav)
    db.commit()

    _log_operation(db, user, "remove_favorite", "favorites", f"取消收藏楼盘ID: {data.property_id}", request)

    return {"success": True, "message": "已取消收藏"}


@router.get("/favorites/check/{property_id}")
async def check_favorite(
    property_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """检查某楼盘是否已收藏"""
    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.property_id == property_id)
        .first()
    )
    return {"success": True, "is_favorited": existing is not None}


# ──────────────────────────────────────────────
# 2. 看房计划
# ──────────────────────────────────────────────

@router.get("/viewing-plans")
async def list_viewing_plans(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取当前用户的看房计划列表"""
    query = db.query(ViewingPlan).filter(ViewingPlan.user_id == user.id)
    if status_filter:
        query = query.filter(ViewingPlan.status == status_filter)

    plans = query.order_by(ViewingPlan.plan_date.desc()).all()

    result = []
    for plan in plans:
        prop_names = []
        if plan.property_ids:
            for pid in plan.property_ids:
                prop = db.query(Property).filter(Property.id == pid).first()
                if prop:
                    prop_names.append(prop.name)

        result.append({
            "id": plan.id,
            "title": plan.title,
            "property_ids": plan.property_ids,
            "property_names": prop_names,
            "plan_date": plan.plan_date,
            "notes": plan.notes,
            "status": plan.status,
            "created_at": plan.created_at,
        })

    return {"success": True, "data": result}


@router.post("/viewing-plans", status_code=status.HTTP_201_CREATED)
async def create_viewing_plan(
    data: ViewingPlanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """创建看房计划"""
    # 验证楼盘ID是否存在
    for pid in data.property_ids:
        if not db.query(Property).filter(Property.id == pid).first():
            raise HTTPException(status_code=400, detail=f"楼盘ID {pid} 不存在")

    plan_date = None
    if data.plan_date:
        from datetime import datetime as dt
        plan_date = dt.strptime(data.plan_date, "%Y-%m-%d").date()

    plan = ViewingPlan(
        user_id=user.id,
        title=data.title,
        property_ids=data.property_ids,
        plan_date=plan_date,
        notes=data.notes,
        status="pending",
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    prop_names = ", ".join(
        db.query(Property.name).filter(Property.id == pid).first().name
        for pid in data.property_ids
        if db.query(Property).filter(Property.id == pid).first()
    )
    _log_operation(db, user, "create_viewing_plan", "viewing_plans", f"创建看房计划: {data.title} ({prop_names})", request)

    return {"success": True, "message": "看房计划已创建", "plan_id": plan.id}


@router.put("/viewing-plans/{plan_id}")
async def update_viewing_plan(
    plan_id: int,
    data: ViewingPlanUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """更新看房计划"""
    plan = (
        db.query(ViewingPlan)
        .filter(ViewingPlan.id == plan_id, ViewingPlan.user_id == user.id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="看房计划不存在")

    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "plan_date" and value:
            from datetime import datetime as dt
            value = dt.strptime(value, "%Y-%m-%d").date()
        setattr(plan, field, value)

    db.commit()
    db.refresh(plan)
    return {"success": True, "message": "看房计划已更新"}


@router.delete("/viewing-plans/{plan_id}")
async def delete_viewing_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """删除看房计划"""
    plan = (
        db.query(ViewingPlan)
        .filter(ViewingPlan.id == plan_id, ViewingPlan.user_id == user.id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="看房计划不存在")

    db.delete(plan)
    db.commit()
    return {"success": True, "message": "看房计划已删除"}


# ──────────────────────────────────────────────
# 3. 操作日志查询（管理员）
# ──────────────────────────────────────────────

@router.get("/logs")
async def list_operation_logs(
    page: int = 1,
    page_size: int = 20,
    module: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    获取操作日志列表（管理员/房产公司）。

    管理员：查看全部日志。
    房产公司：仅查看自己相关的日志。
    """
    is_admin = user.is_admin and user.role == "admin"

    query = db.query(OperationLog)
    if not is_admin:
        query = query.filter(OperationLog.user_id == user.id)

    if module:
        query = query.filter(OperationLog.module == module)
    if keyword:
        query = query.filter(
            OperationLog.details.contains(keyword) |
            OperationLog.action.contains(keyword)
        )

    total = query.count()
    logs = query.order_by(OperationLog.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return {
        "success": True,
        "data": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "module": log.module,
                "details": log.details,
                "ip_address": log.ip_address,
                "created_at": log.created_at,
            }
            for log in logs
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    }


# ──────────────────────────────────────────────
# 4. 楼盘周边配套详情 API
# ──────────────────────────────────────────────

@router.get("/properties/{property_id}/facilities")
async def get_property_facilities(
    property_id: int,
    db: Session = Depends(get_db),
):
    """获取楼盘周边配套详情"""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="楼盘不存在")

    facilities = (
        db.query(PropertyFacility)
        .filter(PropertyFacility.property_id == property_id)
        .order_by(PropertyFacility.facility_type, PropertyFacility.sort_order)
        .all()
    )

    return {
        "success": True,
        "data": {
            "property_id": prop.id,
            "property_name": prop.name,
            "facilities": [
                {
                    "id": f.id,
                    "type": f.facility_type,
                    "name": f.name,
                    "distance": f.distance,
                    "description": f.description,
                }
                for f in facilities
            ],
            "basic_info": {
                "metro_distance": prop.metro_distance,
                "metro_line": prop.metro_line,
                "school_district": prop.school_district,
                "developer": prop.developer,
                "property_company": prop.property_company,
            },
        },
    }


# ──────────────────────────────────────────────
# 5. 楼盘风险详情 API
# ──────────────────────────────────────────────

@router.get("/properties/{property_id}/risks")
async def get_property_risks(
    property_id: int,
    db: Session = Depends(get_db),
):
    """获取楼盘不利因素详情"""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="楼盘不存在")

    risks = (
        db.query(PropertyRisk)
        .filter(PropertyRisk.property_id == property_id)
        .all()
    )

    return {
        "success": True,
        "data": {
            "property_id": prop.id,
            "property_name": prop.name,
            "risks": [
                {
                    "id": r.id,
                    "type": r.risk_type,
                    "description": r.description,
                    "distance": r.distance,
                    "impact_level": r.impact_level,
                }
                for r in risks
            ],
        },
    }


# ──────────────────────────────────────────────
# 6. 楼盘图片管理
# ──────────────────────────────────────────────

@router.get("/properties/{property_id}/images")
async def get_property_images(
    property_id: int,
    db: Session = Depends(get_db),
):
    """获取楼盘图片列表"""
    images = (
        db.query(PropertyImage)
        .filter(PropertyImage.property_id == property_id)
        .order_by(PropertyImage.sort_order)
        .all()
    )

    return {
        "success": True,
        "data": [
            {
                "id": img.id,
                "image_url": img.image_url,
                "image_type": img.image_type,
                "title": img.title,
                "sort_order": img.sort_order,
            }
            for img in images
        ],
    }


class UploadImageRequest(BaseModel):
    """上传图片请求体"""
    image_url: str = Field(..., description="图片URL")
    image_type: str = Field(default="photo", description="图片类型")
    title: Optional[str] = None
    sort_order: int = 0


@router.post("/properties/{property_id}/images", status_code=status.HTTP_201_CREATED)
async def upload_property_image(
    property_id: int,
    data: UploadImageRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    """添加楼盘图片（URL方式）"""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="楼盘不存在")

    image = PropertyImage(
        property_id=property_id,
        image_url=data.image_url,
        image_type=data.image_type,
        title=data.title,
        sort_order=data.sort_order,
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    _log_operation(db, user, "add_property_image", "property_images", f"添加图片到楼盘: {prop.name}", request)

    return {"success": True, "message": "图片添加成功", "image_id": image.id}


@router.delete("/properties/images/{image_id}")
async def delete_property_image(
    image_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """删除楼盘图片"""
    img = db.query(PropertyImage).filter(PropertyImage.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="图片不存在")

    db.delete(img)
    db.commit()
    return {"success": True, "message": "图片已删除"}
