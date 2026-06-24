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
    Favorite, ViewingPlan, Community,
    Conversation, Message, Unit, Building,
)
from models.user import User
from models.property import OperationLog


router = APIRouter()


# ──────────────────────────────────────────────
# Pydantic 请求/响应模型
# ──────────────────────────────────────────────

class FavoriteCreate(BaseModel):
    """收藏请求体"""
    community_id: int = Field(..., description="楼盘ID")
    unit_id: Optional[int] = Field(None, description="房间ID（可选）")
    notes: Optional[str] = None


class FavoriteRemove(BaseModel):
    """取消收藏请求体"""
    community_id: int = Field(..., description="楼盘ID")


class ViewingPlanCreate(BaseModel):
    """创建看房计划请求体"""
    title: str = Field(..., max_length=200, description="计划标题")
    community_ids: List[int] = Field(default_factory=list, description="楼盘ID列表")
    unit_ids: Optional[List[int]] = Field(None, description="房间ID列表")
    plan_date: Optional[str] = None  # YYYY-MM-DD
    notes: Optional[str] = None


class ViewingPlanUpdate(BaseModel):
    """更新看房计划（所有字段可选）"""
    title: Optional[str] = None
    community_ids: Optional[List[int]] = None
    unit_ids: Optional[List[int]] = None
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
        comm = db.query(Community).filter(Community.id == fav.community_id).first()
        cover_image: Optional[str] = None
        # Community does not have a PropertyImage relation; leave cover_image as None

        unit_info = None
        if fav.unit_id:
            unit = db.query(Unit).filter(Unit.id == fav.unit_id).first()
            if unit:
                bld = db.query(Building).filter(Building.id == unit.building_id).first()
                unit_info = {
                    "id": unit.id,
                    "room_number": unit.room_number,
                    "floor": unit.floor,
                    "total_price": float(unit.total_price) if unit.total_price else None,
                    "status_tag": unit.status_tag,
                    "building_name": bld.name if bld else None,
                }

        result.append({
            "id": fav.id,
            "community_id": fav.community_id,
            "community_name": comm.name if comm else "已下架",
            "community_image": cover_image,
            "notes": fav.notes,
            "created_at": fav.created_at,
            "unit_id": fav.unit_id,
            "unit": unit_info,
            "community": {
                "id": comm.id if comm else None,
                "name": comm.name if comm else None,
                "district": comm.district.name if comm and comm.district else None,
                "total_price_min": float(comm.total_price_min) if comm and comm.total_price_min else None,
                "total_price_max": float(comm.total_price_max) if comm and comm.total_price_max else None,
                "area_min": float(comm.area_min) if comm and comm.area_min else None,
                "area_max": float(comm.area_max) if comm and comm.area_max else None,
                "cover_image": cover_image,
            } if comm else None,
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
        .filter(Favorite.user_id == user.id, Favorite.community_id == data.community_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="该楼盘已在收藏列表中")

    # 检查楼盘是否存在
    prop = db.query(Community).filter(Community.id == data.community_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="楼盘不存在")

    # If unit_id provided, validate it exists
    if data.unit_id:
        unit = db.query(Unit).filter(Unit.id == data.unit_id).first()
        if not unit:
            raise HTTPException(status_code=404, detail="房间不存在")

    fav = Favorite(
        user_id=user.id,
        community_id=data.community_id,
        unit_id=data.unit_id,
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
        .filter(Favorite.user_id == user.id, Favorite.community_id == data.community_id)
        .first()
    )
    if not fav:
        raise HTTPException(status_code=404, detail="收藏记录不存在")

    db.delete(fav)
    db.commit()

    _log_operation(db, user, "remove_favorite", "favorites", f"取消收藏楼盘ID: {data.community_id}", request)

    return {"success": True, "message": "已取消收藏"}


@router.get("/favorites/check/{community_id}")
async def check_favorite(
    community_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """检查某楼盘是否已收藏"""
    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.community_id == community_id)
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
        comm_names = []
        if plan.community_ids:
            for cid in plan.community_ids:
                comm = db.query(Community).filter(Community.id == cid).first()
                if comm:
                    comm_names.append(comm.name)

        unit_details = []
        if plan.unit_ids:
            for uid in plan.unit_ids:
                unit = db.query(Unit).filter(Unit.id == uid).first()
                if unit:
                    bld = db.query(Building).filter(Building.id == unit.building_id).first()
                    unit_details.append({
                        "id": unit.id,
                        "room_number": unit.room_number,
                        "floor": unit.floor,
                        "building_name": bld.name if bld else None,
                        "total_price": float(unit.total_price) if unit.total_price else None,
                        "status_tag": unit.status_tag,
                    })

        result.append({
            "id": plan.id,
            "title": plan.title,
            "community_ids": plan.community_ids,
            "community_names": comm_names,
            "unit_ids": plan.unit_ids,
            "unit_details": unit_details,
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
    for cid in data.community_ids:
        if not db.query(Community).filter(Community.id == cid).first():
            raise HTTPException(status_code=400, detail=f"楼盘ID {cid} 不存在")

    if data.unit_ids:
        for uid in data.unit_ids:
            unit = db.query(Unit).filter(Unit.id == uid).first()
            if not unit:
                raise HTTPException(status_code=400, detail=f"房间ID {uid} 不存在")

    plan_date = None
    if data.plan_date:
        from datetime import datetime as dt
        plan_date = dt.strptime(data.plan_date, "%Y-%m-%d").date()

    plan = ViewingPlan(
        user_id=user.id,
        title=data.title,
        community_ids=data.community_ids,
        plan_date=plan_date,
        notes=data.notes,
        status="pending",
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    comm_names = ", ".join(
        db.query(Community.name).filter(Community.id == cid).first().name
        for cid in data.community_ids
        if db.query(Community).filter(Community.id == cid).first()
    )
    _log_operation(db, user, "create_viewing_plan", "viewing_plans", f"创建看房计划: {data.title} ({comm_names})", request)

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
# 4. 楼盘周边配套详情 API（已移除）
# ──────────────────────────────────────────────

@router.get("/properties/{property_id}/facilities")
async def get_property_facilities(
    property_id: int,
):
    """获取楼盘周边配套详情 —— 已移除"""
    return {"success": False, "detail": "已移除", "gone": True}


# ──────────────────────────────────────────────
# 5. 楼盘风险详情 API（已移除）
# ──────────────────────────────────────────────

@router.get("/properties/{property_id}/risks")
async def get_property_risks(
    property_id: int,
):
    """获取楼盘不利因素详情 —— 已移除"""
    return {"success": False, "detail": "已移除", "gone": True}


# ──────────────────────────────────────────────
# 6. 楼盘图片管理（已移除）
# ──────────────────────────────────────────────

@router.get("/properties/{property_id}/images")
async def get_property_images(
    property_id: int,
):
    """获取楼盘图片列表 —— 已移除"""
    return {"success": False, "detail": "已移除", "gone": True}


class UploadImageRequest(BaseModel):
    """上传图片请求体（已弃用）"""
    image_url: str = Field(..., description="图片URL")
    image_type: str = Field(default="photo", description="图片类型")
    title: Optional[str] = None
    sort_order: int = 0


@router.post("/properties/{property_id}/images")
async def upload_property_image(
    property_id: int,
    data: UploadImageRequest,
):
    """添加楼盘图片 —— 已移除"""
    return {"success": False, "detail": "已移除", "gone": True}


@router.delete("/properties/images/{image_id}")
async def delete_property_image(
    image_id: int,
):
    """删除楼盘图片 —— 已移除"""
    return {"success": False, "detail": "已移除", "gone": True}
