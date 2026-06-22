"""FastAPI 依赖注入工具模块。

依赖链：
    ``get_current_user`` → 解析 / 验证 JWT；
    ``get_current_landlord`` → 限房东 / 管理员；
    ``get_current_admin`` → 限管理员。
"""
from typing import Optional, Tuple

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import decode_token
from models.user import User


# HTTP Bearer 认证方案（auto_error=False 使 token 缺失时由后续逻辑定义）
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """从请求头解析并验证 JWT Token，返回当前登录用户。

    Raises:
        HTTPException 401：未提供 token / token 过期 / token 无效 / 黑名单命中 / 用户未激活。
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_missing", "message": "未登录"},
        )

    payload, err = decode_token(credentials.credentials)
    if err == "token_expired":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_expired", "message": "登录已过期，请重新登录"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    if err == "token_blacklisted":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_blacklisted", "message": "token 已被吊销"},
        )
    if err or not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_invalid", "message": "无效令牌"},
        )

    user = db.query(User).filter(User.username == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "user_inactive", "message": "用户不存在或已禁用"},
        )
    return user


def get_current_landlord(user: User = Depends(get_current_user)) -> User:
    """校验当前用户具备 landlord 或 admin 角色。"""
    if user.role not in ("landlord", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要房东权限")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """校验当前用户具备 admin 角色。"""
    if not user.is_admin or user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """与 ``get_current_user`` 同语义，但 token 缺失/失效/过期都返回 ``None`` 而非 401。

    适用场景：公共聊天 / 智能搜索等允许匿名访问的接口。
    调用方需要明确处理 ``None``：偏好缓存跳过、个性化推荐 default 行为等。
    """
    if not credentials:
        return None
    payload, err = decode_token(credentials.credentials)
    if err or not payload or not payload.get("sub"):
        return None
    user = db.query(User).filter(User.username == payload["sub"]).first()
    if not user or not user.is_active:
        return None
    return user


def decode_token_safe(token: str) -> Tuple[Optional[dict], Optional[str]]:
    """Wapper ``config.security.decode_token``，供路由层使用。"""
    return decode_token(token)
