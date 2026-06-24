"""
认证路由组 —— 用户注册、短信验证码、登录与 JWT 签发。

完整的认证流程：
    1. send-code : 用户提交手机号，系统生成 6 位验证码并通过 Mock 短信发送。
    2. register  : 用户提交「手机号 + 验证码 + 账号信息」，服务端校验验证码后写入 User 表。
    3. login     : 用户提交「用户名 + 密码」，校验通过后签发 JWT access_token。

所有密码均以 bcrypt 哈希存储，令牌有效期由 ACCESS_TOKEN_EXPIRE_MINUTES 控制。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel, Field

from config.database import get_db
from config.security import (
    verify_password,          # bcrypt 密码校验
    get_password_hash,        # bcrypt 密码加密
    create_access_token,      # JWT 签发
    ACCESS_TOKEN_EXPIRE_MINUTES,  # 令牌默认过期时间（分钟）
)
from config.sms import (
    generate_verification_code,  # 生成 6 位随机数字验证码
    store_verification_code,     # 将验证码持久化（Redis / DB）
    verify_code,                 # 校验验证码是否正确且未过期
    send_verification_sms,       # 真实容联云短信发送
)
from models.user import User
from schemas.user import UserCreate, UserLogin, UserResponse, Token
from middleware.deps import get_current_user

router = APIRouter()


class RegisterResponse(BaseModel):
    """注册响应：包含 token 和用户信息"""
    access_token: str
    token_type: str
    user: UserResponse


class SendCodeRequest(BaseModel):
    """发送验证码请求体"""
    phone: str = Field(..., description="手机号")


class VerifyCodeRequest(BaseModel):
    """验证码校验请求体"""
    phone: str = Field(..., description="手机号")
    code: str = Field(..., description="验证码")


# ──────────────────────────────────────────────
# 1. 发送短信验证码
# ──────────────────────────────────────────────

@router.post("/send-code")
async def send_verification_code(data: SendCodeRequest):
    """发送短信验证码。

    流程：
        1) 校验手机号长度；
        2) Redis 频率检查（system_configs.notification.sms_rate_limit_per_hour）；
        3) 生成 6 位验证码 → 存入 Redis → 调用容联云或 mock。

    Returns:
        不返回验证码明文（生产环境），仅对开发模式回显提示。
    """
    if not data.phone or len(data.phone) < 11:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式不正确",
        )

    # 频率限制
    from config.sms import check_sms_rate_limit, SmsRateLimitExceeded
    try:
        check_sms_rate_limit(data.phone)
    except SmsRateLimitExceeded as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "sms_rate_limit",
                "message": f"{e.phone} 在 {e.window_seconds // 60} 分钟内发送短信超限（上限 {e.limit} 次），请稍后再试。",
            },
        )

    code = generate_verification_code()
    store_verification_code(data.phone, code)

    delivered = await send_verification_sms(data.phone, code)
    if not delivered:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="短信发送失败，请稍后重试",
        )

    return {
        "message": "验证码已发送",
        "code_dev_only": code if _is_dev_mode() else None,
    }


def _is_dev_mode() -> bool:
    """简单判断当前是否为开发模式。"""
    from config.config import get_env
    return (get_env("APP_ENV", "dev") or "dev").lower() not in {"prod", "production"}


# ──────────────────────────────────────────────
# 2. 用户注册
# ──────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    用户注册接口

    注册流程：
        ① 校验手机号非空
        ② 校验短信验证码（与 send-code 生成的码匹配且未过期）
        ③ 检查用户名、邮箱、手机号是否已被占用
        ④ 根据 role 字段区分普通用户 / 房东（房东需填写公司名）
        ⑤ 密码哈希后写入 User 表

    Args:
        user_data: 包含 username, email, phone, password, role, company_name 等
        db: 数据库会话
    """
    # ── 校验手机号是否为空 ──
    if not user_data.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号不能为空"
        )

    # ── 校验短信验证码（防伪造注册） ──
    if not verify_code(user_data.phone, user_data.verify_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期"
        )

    # ── 唯一性检查：用户名 ──
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已被使用"
        )

    # ── 唯一性检查：邮箱 ──
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )

    # ── 唯一性检查：手机号 ──
    existing_phone = db.query(User).filter(User.phone == user_data.phone).first()
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号已被注册"
        )

    # ── 确定角色：默认为 user，允许 landlord ──
    role = (user_data.role or "user").lower()
    if role not in ("user", "landlord"):
        role = "user"
    # 房东角色需要公司/品牌名称
    if role == "landlord" and not user_data.company_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="房东注册请填写公司或品牌名称",
        )

    # ── 密码哈希 + 创建用户记录 ──
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=role,
        company_name=user_data.company_name,
    )

    db.add(db_user)
    db.commit()              # 持久化到数据库
    db.refresh(db_user)      # 刷新以获取自增主键等字段

    # 注册成功后自动签发 JWT token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": db_user.username,
            "user_id": db_user.id,
            "role": db_user.role or "user",
        },
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm_user(db_user),
    }


# ──────────────────────────────────────────────
# 3. 用户登录 & JWT 签发
# ──────────────────────────────────────────────

@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    用户登录接口 —— 校验用户名/密码，签发 JWT access_token

    登录流程：
        ① 根据用户名查询用户记录
        ② 使用 bcrypt 校验密码
        ③ 检查用户状态（is_active）
        ④ 生成包含 username、user_id、role 的 JWT 令牌
        ⑤ 返回 access_token + token_type + 用户信息

    Args:
        user_data: 包含 username, password
        db: 数据库会话
    """
    # ── Step 1: 根据用户名查找用户 ──
    user = db.query(User).filter(User.username == user_data.username).first()

    # ── Step 2: 校验用户是否存在且密码正确 ──
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},  # RFC 7235: 要求客户端使用 Bearer token
        )

    # ── Step 3: 检查账户是否被禁用 ──
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用"
        )

    # ── Step 4: 签发 JWT access_token ──
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.username,       # subject: 用户名（JWT 标准字段）
            "user_id": user.id,         # 用户 ID
            "role": user.role or "user", # 用户角色
        },
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm_user(user),
    }


# ──────────────────────────────────────────────
# 4. 获取当前用户资料（Token 验证）
# ──────────────────────────────────────────────

@router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    """
    获取当前登录用户的资料。

    用途：
        - 前端用于验证 JWT token 是否仍然有效
        - 页面刷新时恢复用户信息

    Returns:
        { success: true, data: { ...用户信息... } }
    """
    return {
        "success": True,
        "data": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "phone": current_user.phone,
            "avatar": current_user.avatar,
            "role": current_user.role,
            "company_name": current_user.company_name,
            "is_active": current_user.is_active,
            "is_admin": current_user.is_admin,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        }
    }
