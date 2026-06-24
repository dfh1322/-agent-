"""
models/property.py - 房产领域 SQLAlchemy ORM 模型

对应 MySQL 表：
  districts, communities, buildings, house_types, units,
  policies, knowledge_docs, faqs,
  conversations, messages, favorites, viewing_plans,
  operation_logs, system_configs, user_preferences
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Integer,
    Numeric, String, Text, UniqueConstraint, event, func,
)
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import relationship

from config.database import Base

from models.contact_message import ContactMessage

# ---------------------------------------------------------------------------
# 延迟导入 User（避免循环依赖）
# ---------------------------------------------------------------------------
if TYPE_CHECKING:
    from models.user import User  # noqa: F401


# =========================== mixins ========================================

class TimestampMixin:
    """自动维护 created_at / updated_at 的 mixin"""
    created_at = Column(
        DateTime, server_default=func.now(), nullable=False,
    )
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(),
    )


# =========================== 基础字典模型 ==================================

class District(Base):
    """行政区划字典。

    设计说明：
        * MySQL 表 schema 仅由 Dump 提供（CLAUDE.md §7 —
          完整字段定义参见数据库 Dump，代码中不得偏离）。
          故仅扩展 ORM 字段 ``parent_id`` 与 ``full_path`` 时 **必须**
          由 DBA 同步 ALTER TABLE，加列必须在线上 migration。
        * 当下启动 DB schema 没有 ``parent_id`` / ``full_path`` 列，
          ORM 这里以 ``__table_args__`` 加 ``Column`` 是无效的 ——
          SQLAlchemy 不会调整既有表。改用 ORM 默认值存于
          ``__table_args__`` 的 ``extend_existing``/``info`` 不合需求，
          所以**导入层只在生产 schema 已迁移后**才启用这些字段。
    """
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, index=True)
    # 在迁移前为空；可通过 SQL 脚本 offline migrate 在线加
    # ALTER TABLE districts ADD COLUMN parent_id INT NULL,
    #                   ADD COLUMN level INT DEFAULT 3,
    #                   ADD COLUMN full_path VARCHAR(150),
    #                   ADD CONSTRAINT fk_districts_parent
    #                       FOREIGN KEY (parent_id) REFERENCES districts(id)
    #                       ON DELETE CASCADE;
    # 现阶段保留为可空以向前兼容；ORM 同步启动后会检测 Schema 与模型不一致，
    # 推荐配合 `init_districts_meta.py` 脚本一次性补齐。
    parent_id = Column(Integer, nullable=True)
    level = Column(Integer, default=3)
    full_path = Column(String(150), index=True)
    code = Column(String(20), index=True)
    city = Column(String(50), default="杭州")
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    # 注意：自引用关系 parent/children 引入 ``ForeignKey`` 在 schema 未迁移
    # 之前会导致 ``Base.metadata.create_all`` 在启动时报错（找不到约束列）。
    # 因此仅在已迁移 schema 的实例上由 ``migrate_db.py`` 创建。
    communities = relationship("Community", back_populates="district")


# =========================== 小区模型 ======================================

class Community(Base, TimestampMixin):
    """小区 / 楼盘综合体 —— 一个完整的居住社区。

    与 properties（楼盘）不同，community 是面向购房者认知的实体：
    - 一个 community 可以有多栋 buildings（楼栋）
    - community 持有复合级属性（开发商、绿化率、总户数等）
    - properties 退化为兼容层，通过 community_id 关联
    """
    __tablename__ = "communities"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    name = Column(String(100), nullable=False)
    alias = Column(String(100))
    address = Column(String(200))
    developer = Column(String(100))
    property_type = Column(String(50))
    building_count = Column(Integer, default=0)
    total_households = Column(Integer)
    plot_ratio = Column(Numeric(5, 2))
    green_rate = Column(Numeric(5, 2))
    parking_ratio = Column(String(20))
    property_company = Column(String(100))
    property_fee = Column(Numeric(8, 2))
    land_area = Column(Numeric(15, 2))
    building_area = Column(Numeric(15, 2))
    delivery_date = Column(Date)
    decoration_status = Column(String(20))
    school_district = Column(String(200))
    metro_distance = Column(Integer)
    metro_line = Column(String(50))
    status = Column(String(20), default="在售")
    tags = Column(JSON)
    description = Column(Text)
    is_featured = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    owner_id = Column(Integer, ForeignKey("users.id"))
    price_per_sqm = Column(Numeric(10, 2))
    total_price_min = Column(Numeric(15, 2))
    total_price_max = Column(Numeric(15, 2))
    area_min = Column(Numeric(8, 2))
    area_max = Column(Numeric(8, 2))
    province = Column(String(30))
    city = Column(String(30))
    district_name = Column(String(50))
    floor_min = Column(Integer)
    floor_max = Column(Integer)

    # Relationships
    district = relationship("District", back_populates="communities")
    owner = relationship("User", back_populates="owned_communities")
    buildings = relationship("Building", back_populates="community",
                             cascade="all, delete-orphan")


# =========================== 楼栋模型 =====================================

class Building(Base, TimestampMixin):
    """楼栋 / 幢 —— 小区内的一栋独立建筑。

    持有楼栋级别的楼层范围、朝向、每层户数等属性。
    户型 (HouseType) 通过 building_id 关联到具体楼栋。
    """
    __tablename__ = "buildings"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False)
    name = Column(String(50), nullable=False)
    building_number = Column(String(20))
    building_type = Column(String(30))  # 板楼/塔楼/板塔结合/联排/独栋
    total_floors = Column(Integer)
    floor_min = Column(Integer)
    floor_max = Column(Integer)
    units_per_floor = Column(Integer)    # 每层户数
    unit_count = Column(Integer)         # 单元数
    elevator_count = Column(Integer)     # 电梯数
    orientation = Column(String(20))
    delivery_date = Column(Date)
    decoration_status = Column(String(20))
    metro_distance = Column(Integer)
    status = Column(String(20), default="在售")
    sort_order = Column(Integer, default=0)

    # Relationships
    community = relationship("Community", back_populates="buildings")
    house_types = relationship("HouseType", back_populates="building",
                               cascade="all, delete-orphan")
    units = relationship("Unit", back_populates="building", cascade="all, delete-orphan")


# =========================== 户型模型 ======================================

class HouseType(Base, TimestampMixin):
    __tablename__ = "house_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    bedrooms = Column(Integer)
    living_rooms = Column(Integer)
    bathrooms = Column(Integer)
    kitchens = Column(Integer, default=1)
    area = Column(Numeric(8, 2), nullable=False)
    floor_min = Column(Integer)              # 户型所在最低层数
    floor_max = Column(Integer)              # 户型所在最高层数
    orientation = Column(String(20))
    total_price = Column(Numeric(15, 2))
    layout_image = Column(String(255))
    description = Column(Text)
    is_available = Column(Boolean, default=True)

    building_id = Column(Integer, ForeignKey("buildings.id"))  # 关联楼栋

    building = relationship("Building", back_populates="house_types")
    units = relationship("Unit", back_populates="house_type", cascade="all, delete-orphan")


# =========================== 房间/房源模型 ==================================

class Unit(Base, TimestampMixin):
    """房间 / 房源 —— 具体可售的单套房屋。

    与 HouseType（户型）的关系：
    - HouseType 是"户型模板"（几室几厅、参考面积、参考价）
    - Unit 是"实际房源"（具体房号、实际面积、实际售价、销售状态）

    每个 Unit 必须关联一个 Building 和一个 HouseType。
    """
    __tablename__ = "units"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"), nullable=False)
    house_type_id = Column(Integer, ForeignKey("house_types.id"), nullable=False)
    room_number = Column(String(20), nullable=False)
    floor = Column(Integer)
    area = Column(Numeric(8, 2))
    total_price = Column(Numeric(15, 2))
    orientation = Column(String(20))
    status_tag = Column(String(20), default="在售")
    tags = Column(JSON)
    description = Column(Text)
    sort_order = Column(Integer, default=0)

    building = relationship("Building", back_populates="units")
    house_type = relationship("HouseType", back_populates="units")
    favorites = relationship("Favorite", back_populates="unit_ref",
                             foreign_keys="Favorite.unit_id")
    contact_messages = relationship("ContactMessage", back_populates="unit_ref",
                                    foreign_keys="ContactMessage.unit_id")


# =========================== 政策模型 ======================================

class Policy(Base, TimestampMixin):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    policy_type = Column(String(50), nullable=False)  # 限购/贷款/公积金/税费/落户
    content = Column(Text, nullable=False)
    source = Column(String(200))
    effective_date = Column(Date)
    expiry_date = Column(Date)
    city = Column(String(50), default="杭州")
    is_active = Column(Boolean, default=True)


# =========================== 知识库文档模型 ================================

class KnowledgeDoc(Base, TimestampMixin):
    __tablename__ = "knowledge_docs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    doc_type = Column(String(50), nullable=False)  # 楼盘详情/购房指南/政策解读/常见问答
    content = Column(Text, nullable=False)
    source = Column(String(200))
    metadata_col = Column("metadata", JSON)
    vector_id = Column(String(100))
    is_active = Column(Boolean, default=True)


# =========================== FAQ 模型 ======================================

class FAQ(Base, TimestampMixin):
    __tablename__ = "faqs"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String(500), nullable=False)
    answer = Column(Text, nullable=False)
    category = Column(String(50))
    tags = Column(JSON)
    sort_order = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


# =========================== 对话模型 ======================================

class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200))
    status = Column(String(20), default="active")  # active/closed

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """对话内的单条消息。

    注意：append-only 日志，**不**继承 ``TimestampMixin`` —— 库表 ``messages``
    只有 ``created_at`` 字段而没有 ``updated_at``。若沿用 mixin，SQLAlchemy
    会在所有 SELECT 里导出 ``messages.updated_at``，触发 MySQL 1054 错误并
    让 /admin/conversations 等接口全量 500。

    ``created_at`` 由 server_default 兜底，调用层不需要主动写入。
    """
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)  # user/assistant/tool
    content = Column(Text, nullable=False)
    tool_calls = Column(JSON)
    tool_responses = Column(JSON)
    metadata_col = Column("metadata", JSON)
    created_at = Column(
        DateTime, server_default=func.now(), nullable=False,
    )

    conversation = relationship("Conversation", back_populates="messages")


# =========================== 收藏模型 ======================================

class Favorite(Base, TimestampMixin):
    __tablename__ = "favorites"
    # 注意：SQL Schema 中对应 ``UNIQUE KEY uk_user_property (user_id, property_id)``；
    # 必须显式声明，否则 ``add_favorite`` 重复请求会被 SQL 触发重复键异常，
    # ORM 层失去了唯一性约束的双重保护。
    __table_args__ = (
        UniqueConstraint("user_id", "community_id", name="uk_user_community"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    notes = Column(Text)

    user = relationship("User", back_populates="favorites")
    community_ref = relationship("Community")
    unit_ref = relationship("Unit", back_populates="favorites", foreign_keys=[unit_id])


# =========================== 看房计划模型 ==================================

class ViewingPlan(Base, TimestampMixin):
    __tablename__ = "viewing_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200))
    community_ids = Column(JSON)
    unit_ids = Column(JSON, nullable=True)
    plan_date = Column(Date)
    notes = Column(Text)
    status = Column(String(20), default="pending")  # pending/completed

    user = relationship("User", back_populates="viewing_plans")


# =========================== 操作日志模型 ==================================

class OperationLog(Base, TimestampMixin):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    action = Column(String(100), nullable=False)
    module = Column(String(50))
    details = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(Text)

    user = relationship("User", back_populates="operation_logs")


# =========================== 系统配置模型 ==================================

class SystemConfig(Base, TimestampMixin):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(100), unique=True, nullable=False, index=True)
    config_value = Column(Text)
    description = Column(String(200))
    config_group = Column(String(50), index=True)


# =========================== 用户偏好模型 ==================================

class UserPreference(Base, TimestampMixin):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    budget_min = Column(Numeric(15, 2))
    budget_max = Column(Numeric(15, 2))
    preferred_districts = Column(JSON)
    preferred_house_types = Column(JSON)
    need_school = Column(Boolean)
    need_metro = Column(Boolean)
    has_provident_fund = Column(Boolean)
    family_members = Column(Integer)
    is_first_home = Column(Boolean)

    user = relationship("User", back_populates="user_preferences")
