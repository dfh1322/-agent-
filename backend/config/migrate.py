"""轻量数据库迁移：为已有表补充新字段或索引。

本模块通过 SQLAlchemy 的 ``inspect`` 工具探测现有表结构，
以幂等方式为 ``users`` 和 ``communities`` 表添加缺失列、创建缺失索引。
每次执行 ``run_migrations()`` 都是安全的——已存在的字段不会被重复添加。

仅支持 MySQL。
"""
from sqlalchemy import inspect, text

from config.database import engine


def run_migrations() -> None:
    """执行数据库表结构迁移。

    迁移步骤：
        1. users 表：补齐 ``role`` / ``company_name`` 列；补齐常用索引。
        2. communities 表：补齐 ``owner_id`` 列。
        3. user_preferences / system_configs / operation_logs 表不存在时创建。
    """
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    # ── users 字段 & 索引 ──
    if "users" in table_names:
        user_cols = {c["name"] for c in inspector.get_columns("users")}
        user_idx = {i["name"] for i in inspector.get_indexes("users")}
        with engine.begin() as conn:
            if "role" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'"))
                conn.execute(text("UPDATE users SET role = 'admin' WHERE is_admin = 1"))
            if "company_name" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN company_name VARCHAR(100)"))
            if "wechat" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN wechat VARCHAR(100)"))
            if "address" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN address VARCHAR(255)"))
            if "created_at" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
            if "updated_at" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))
            # 索引补齐（与 User ORM 保持一致）
            if "ix_users_role" not in user_idx:
                conn.execute(text("CREATE INDEX ix_users_role ON users (role)"))
            if "ix_users_is_admin" not in user_idx:
                conn.execute(text("CREATE INDEX ix_users_is_admin ON users (is_admin)"))

    # ── communities 字段 ──
    if "communities" in table_names:
        comm_cols = {c["name"] for c in inspector.get_columns("communities")}
        comm_idx = {i["name"] for i in inspector.get_indexes("communities")}
        with engine.begin() as conn:
            if "owner_id" not in comm_cols:
                conn.execute(text("ALTER TABLE communities ADD COLUMN owner_id INT"))
            # 行政区划迁移（与 ``backend/models/property.py`` 的 ORM
            # 保持一致，供 Cascader 树形下拉使用）。
            if "province" not in comm_cols:
                conn.execute(
                    text("ALTER TABLE communities ADD COLUMN province VARCHAR(30) NULL")
                )
            if "city" not in comm_cols:
                conn.execute(
                    text("ALTER TABLE communities ADD COLUMN city VARCHAR(30) NULL")
                )
            if "district_name" not in comm_cols:
                conn.execute(
                    text(
                        "ALTER TABLE communities ADD COLUMN "
                        "district_name VARCHAR(50) NULL"
                    )
                )
            if "ix_communities_region" not in comm_idx:
                conn.execute(
                    text(
                        "CREATE INDEX ix_communities_region "
                        "ON communities (province, city, district_name)"
                    )
                )
            if "floor_min" not in comm_cols:
                conn.execute(
                    text("ALTER TABLE communities ADD COLUMN floor_min INT NULL COMMENT '最低楼层数'")
                )
            if "floor_max" not in comm_cols:
                conn.execute(
                    text("ALTER TABLE communities ADD COLUMN floor_max INT NULL COMMENT '最高楼层数'")
                )

    # ── districts 字段 & 索引 ──
    if "districts" in table_names:
        dis_cols = {c["name"] for c in inspector.get_columns("districts")}
        dis_idx = {i["name"] for i in inspector.get_indexes("districts")}
        with engine.begin() as conn:
            if "parent_id" not in dis_cols:
                conn.execute(
                    text("ALTER TABLE districts ADD COLUMN parent_id INT NULL")
                )
            if "level" not in dis_cols:
                conn.execute(
                    text(
                        "ALTER TABLE districts ADD COLUMN "
                        "level INT NOT NULL DEFAULT 3"
                    )
                )
            if "full_path" not in dis_cols:
                conn.execute(
                    text(
                        "ALTER TABLE districts ADD COLUMN "
                        "full_path VARCHAR(150) NULL"
                    )
                )
            if "code" not in dis_cols:
                conn.execute(
                    text("ALTER TABLE districts ADD COLUMN code VARCHAR(20) NULL")
                )
            if "ix_districts_full_path" not in dis_idx:
                conn.execute(
                    text(
                        "CREATE INDEX ix_districts_full_path "
                        "ON districts (full_path)"
                    )
                )
            if "ix_districts_code" not in dis_idx:
                conn.execute(
                    text("CREATE INDEX ix_districts_code ON districts (code)")
                )
            # FK … 现场测试发现很多库已无内联 FK 补全；尽量添加
            fk_names = {fk.get("name") for fk in inspector.get_foreign_keys("districts") if fk.get("name")}
            if "fk_districts_parent" not in fk_names:
                try:
                    conn.execute(
                        text(
                            "ALTER TABLE districts ADD CONSTRAINT fk_districts_parent "
                            "FOREIGN KEY (parent_id) REFERENCES districts (id) "
                            "ON DELETE CASCADE"
                        )
                    )
                except Exception:  # noqa: BLE001
                    pass

    # ── 缺失表自动创建（MySQL） ──
    if "user_preferences" not in table_names:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE user_preferences (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    user_id INT NOT NULL,
                    budget_min DECIMAL(15,2),
                    budget_max DECIMAL(15,2),
                    preferred_districts JSON,
                    preferred_house_types JSON,
                    need_school BOOLEAN,
                    need_metro BOOLEAN,
                    has_provident_fund BOOLEAN,
                    family_members INT,
                    is_first_home BOOLEAN,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """))

    if "system_configs" not in table_names:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE system_configs (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    config_key VARCHAR(100) UNIQUE NOT NULL,
                    config_value TEXT,
                    description VARCHAR(200),
                    config_group VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """))

    if "operation_logs" not in table_names:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE operation_logs (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    user_id INT,
                    action VARCHAR(100) NOT NULL,
                    module VARCHAR(50),
                    details TEXT,
                    ip_address VARCHAR(50),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """))

    if "contact_messages" not in table_names:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE contact_messages (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    landlord_id INT NOT NULL,
                    guest_name VARCHAR(50) NOT NULL,
                    guest_phone VARCHAR(20) NOT NULL,
                    community_id INT NULL,
                    unit_id INT NULL,
                    message TEXT NOT NULL,
                    preferred_date DATE NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (landlord_id) REFERENCES users(id),
                    FOREIGN KEY (community_id) REFERENCES communities(id),
                    FOREIGN KEY (unit_id) REFERENCES units(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """))

    # ── 补齐 TimestampMixin 缺失的 updated_at 列 ──
    _TIMESTAMP_TABLES = [
        "favorites", "house_types", "messages", "operation_logs",
        "buildings", "communities", "units",
    ]
    for _tbl in _TIMESTAMP_TABLES:
        if _tbl in table_names:
            _tbl_cols = {c["name"] for c in inspector.get_columns(_tbl)}
            if "updated_at" not in _tbl_cols:
                with engine.begin() as conn:
                    conn.execute(text(
                        f"ALTER TABLE {_tbl} "
                        "ADD COLUMN updated_at TIMESTAMP "
                        "DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                    ))
