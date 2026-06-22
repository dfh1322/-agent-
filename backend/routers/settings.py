"""
系统配置和用户偏好路由组。

功能：
    - 系统配置 CRUD（利率、额度等）
    - 用户偏好管理（预算、区域、户型等）
    - 用户资料更新
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from config.database import get_db
from middleware.deps import get_current_user, get_current_admin
from config.security import get_password_hash, verify_password
from models.property import SystemConfig
from models.property import UserPreference, Property
from models.user import User


router = APIRouter()


# ──────────────────────────────────────────────
# Pydantic 请求/响应模型
# ──────────────────────────────────────────────

class SystemConfigCreate(BaseModel):
    """新增系统配置请求体"""
    config_key: str = Field(..., max_length=100)
    config_value: str = Field(...)
    description: Optional[str] = None
    config_group: Optional[str] = None


class SystemConfigUpdate(BaseModel):
    """更新系统配置（所有字段可选）"""
    config_value: Optional[str] = None
    description: Optional[str] = None
    config_group: Optional[str] = None


class UserPreferenceUpdate(BaseModel):
    """更新用户偏好请求体"""
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    preferred_districts: Optional[list] = None
    preferred_house_types: Optional[list] = None
    need_school: Optional[bool] = None
    need_metro: Optional[bool] = None
    has_provident_fund: Optional[bool] = None
    family_members: Optional[int] = None
    is_first_home: Optional[bool] = None


class UpdateProfileRequest(BaseModel):
    """更新个人资料请求体"""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    """修改密码请求体"""
    old_password: str = Field(..., description="旧密码")
    new_password: str = Field(..., min_length=6, description="新密码")


# ──────────────────────────────────────────────
# 1. 系统配置管理（管理员）
# ──────────────────────────────────────────────

@router.get("/configs")
async def list_system_configs(
    config_group: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """获取系统配置列表"""
    query = db.query(SystemConfig)
    if config_group:
        query = query.filter(SystemConfig.config_group == config_group)

    configs = query.order_by(SystemConfig.config_group, SystemConfig.config_key).all()

    return {
        "success": True,
        "data": [
            {
                "id": c.id,
                "config_key": c.config_key,
                "config_value": c.config_value,
                "description": c.description,
                "config_group": c.config_group,
                "updated_at": c.updated_at,
            }
            for c in configs
        ],
    }


@router.post("/configs", status_code=status.HTTP_201_CREATED)
async def create_system_config(
    data: SystemConfigCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """新增系统配置"""
    existing = db.query(SystemConfig).filter(SystemConfig.config_key == data.config_key).first()
    if existing:
        raise HTTPException(status_code=400, detail="配置键已存在")

    config = SystemConfig(
        config_key=data.config_key,
        config_value=data.config_value,
        description=data.description,
        config_group=data.config_group,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return {"success": True, "message": "配置已创建", "config_id": config.id}


@router.put("/configs/{config_key}")
async def update_system_config(
    config_key: str,
    data: SystemConfigUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """更新系统配置"""
    config = db.query(SystemConfig).filter(SystemConfig.config_key == config_key).first()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)

    db.commit()
    db.refresh(config)
    return {"success": True, "message": "配置已更新"}


@router.delete("/configs/{config_key}")
async def delete_system_config(
    config_key: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """删除系统配置"""
    config = db.query(SystemConfig).filter(SystemConfig.config_key == config_key).first()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")

    db.delete(config)
    db.commit()
    return {"success": True, "message": "配置已删除"}


@router.get("/configs/group/{group}")
async def get_config_by_group(
    group: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """按组获取配置。

    客户端必须先登录；避免未登录用户任意扫描 system_configs。
    返回值是 ``{config_key: config_value}``，可以由前端解析 JSON/value 字符串。
    """
    configs = (
        db.query(SystemConfig)
        .filter(SystemConfig.config_group == group)
        .all()
    )
    payload: dict[str, str] = {}
    for c in configs:
        if c.config_key.startswith("_"):
            continue
        payload[c.config_key] = c.config_value
    return {
        "success": True,
        "data": payload,
        "group": group,
    }


# ──────────────────────────────────────────────
# 2. 用户偏好管理
# ──────────────────────────────────────────────

@router.get("/preferences")
async def get_user_preference(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取当前用户的偏好设置"""
    pref = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == user.id)
        .first()
    )

    if not pref:
        return {
            "success": True,
            "data": None,
            "message": "尚未设置偏好",
        }

    return {
        "success": True,
        "data": {
            "id": pref.id,
            "budget_min": float(pref.budget_min) if pref.budget_min else None,
            "budget_max": float(pref.budget_max) if pref.budget_max else None,
            "preferred_districts": pref.preferred_districts,
            "preferred_house_types": pref.preferred_house_types,
            "need_school": pref.need_school,
            "need_metro": pref.need_metro,
            "has_provident_fund": pref.has_provident_fund,
            "family_members": pref.family_members,
            "is_first_home": pref.is_first_home,
            "updated_at": pref.updated_at,
        },
    }


@router.put("/preferences")
async def update_user_preference(
    data: UserPreferenceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """更新用户偏好设置"""
    pref = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == user.id)
        .first()
    )

    if pref:
        # 更新已有偏好
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(pref, field, value)
    else:
        # 创建新偏好
        pref = UserPreference(user_id=user.id, **data.model_dump(exclude_unset=True))
        db.add(pref)

    db.commit()
    db.refresh(pref)
    return {"success": True, "message": "偏好已更新"}


# ──────────────────────────────────────────────
# 3. 用户资料管理
# ──────────────────────────────────────────────

@router.get("/profile")
async def get_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取当前用户资料"""
    return {
        "success": True,
        "data": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "avatar": user.avatar,
            "role": user.role,
            "company_name": user.company_name,
            "is_admin": user.is_admin,
            "created_at": user.created_at,
        },
    }


@router.put("/profile")
async def update_profile(
    data: UpdateProfileRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """更新用户个人资料"""
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return {
        "success": True,
        "message": "资料已更新",
        "data": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "phone": user.phone,
            "avatar": user.avatar,
        },
    }


@router.post("/profile/change-password")
async def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """修改密码"""
    if not verify_password(data.old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="旧密码不正确")

    user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"success": True, "message": "密码已修改"}
