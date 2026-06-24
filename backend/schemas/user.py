from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserCreate(BaseModel):
    """用户注册请求体"""
    username: str = Field(..., min_length=2, max_length=50, description="用户名")
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., min_length=6, max_length=64, description="密码")
    phone: str = Field(..., min_length=11, max_length=20, description="手机号")
    verify_code: str = Field(..., min_length=4, max_length=10, description="短信验证码")
    full_name: Optional[str] = Field(None, max_length=100, description="姓名")
    role: Optional[str] = Field("user", description="user / landlord")
    company_name: Optional[str] = Field(None, max_length=100, description="房东公司名")


class UserLogin(BaseModel):
    """用户登录请求体"""
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")


class UserResponse(BaseModel):
    """用户资料响应"""
    id: int
    username: str
    email: str
    is_active: bool = True
    role: Optional[str] = "user"
    phone: Optional[str] = None
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    is_admin: Optional[bool] = False
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_user(cls, user) -> "UserResponse":
        """宽容地从 ORM 对象构造：当 ``created_at`` 是 datetime 时转 ISO 字符串。"""
        created_at = getattr(user, "created_at", None)
        if created_at and not isinstance(created_at, str):
            try:
                created_at = created_at.isoformat()
            except Exception:
                created_at = None
        return cls(
            id=user.id,
            username=user.username,
            email=user.email,
            is_active=bool(user.is_active),
            role=getattr(user, "role", None) or "user",
            phone=getattr(user, "phone", None),
            full_name=getattr(user, "full_name", None),
            company_name=getattr(user, "company_name", None),
            is_admin=bool(getattr(user, "is_admin", False)),
            created_at=created_at,
        )


class Token(BaseModel):
    """JWT token 响应"""
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None
