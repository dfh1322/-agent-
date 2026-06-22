"""
User 模型 — 用户表

包含用户基本信息、角色权限、以及与其他表的关联关系。
字段长度严格对齐 MySQL Schema（database/housecodex.sql）：
  email          VARCHAR(100)
  company_name   VARCHAR(100)
  role           三种枚举值: user / landlord / admin

注意：``created_at`` / ``updated_at`` 由 SQLAlchemy 服务端默认 CURRENT_TIMESTAMP，
与 SQL 中 ``TIMESTAMP DEFAULT CURRENT_TIMESTAMP`` 对齐，避免时区漂移。
"""
from sqlalchemy import Column, Index, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship

from config.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    phone = Column(String(20))
    full_name = Column(String(100))
    avatar = Column(String(255))
    role = Column(String(20), default="user")  # user / landlord / admin
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    company_name = Column(String(100))
    wechat = Column(String(100))
    address = Column(String(255))
    # 时间戳使用数据库层默认值，与 SQL schema 完全一致
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships（依赖 Property 模型的反向引用在 property.py 中声明）
    owned_properties = relationship("Property", back_populates="owner")
    favorites = relationship("Favorite", back_populates="user")
    conversations = relationship("Conversation", back_populates="user")
    viewing_plans = relationship("ViewingPlan", back_populates="user")
    operation_logs = relationship("OperationLog", back_populates="user")
    user_preferences = relationship("UserPreference", back_populates="user")

    __table_args__ = (
        # 角色字段索引，加速按角色统计/筛选（如 ListAccounts 等接口）
        Index("ix_users_role", "role"),
        Index("ix_users_is_admin", "is_admin"),
    )

