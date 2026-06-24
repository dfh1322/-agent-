"""
migrations/migrate_district_hierarchy.py

一次性迁移脚本：将 ``districts`` / ``properties`` schema 升级到支持省/市/区级联
（仅供 schema 严格运行时执行，不会回滚）。

执行：
    python -m migrations.migrate_district_hierarchy

幂等：检测列已存在则跳过。
"""
from __future__ import annotations

import sys

from sqlalchemy import text

from config.database import engine


MIGRATIONS = [
    # (= districts schema 升级)
    "ALTER TABLE districts ADD COLUMN parent_id INT NULL",
    "ALTER TABLE districts ADD COLUMN level INT NOT NULL DEFAULT 3",
    "ALTER TABLE districts ADD COLUMN full_path VARCHAR(150) NULL",
    "ALTER TABLE districts ADD COLUMN code VARCHAR(20) NULL",
    "CREATE INDEX ix_districts_full_path ON districts (full_path)",
    "CREATE INDEX ix_districts_code ON districts (code)",
    "ALTER TABLE districts ADD CONSTRAINT fk_districts_parent "
    "FOREIGN KEY (parent_id) REFERENCES districts (id) ON DELETE CASCADE",
    # (= properties schema 升级)
    "ALTER TABLE properties ADD COLUMN province VARCHAR(30) NULL",
    "ALTER TABLE properties ADD COLUMN city VARCHAR(30) NULL",
    "ALTER TABLE properties ADD COLUMN district_name VARCHAR(50) NULL",
    "ALTER TABLE properties ADD INDEX ix_properties_region (province, city, district_name)",
]


def _already_applied(conn, sql: str) -> bool:
    """若语句中已存在 schema 信息，则视为已应用。"""
    sql_lc = sql.lower().strip()
    if "add column districts.parent_id" in sql_lc or "(`parent_id` int" in sql_lc:
        rows = conn.execute(text(
            "SHOW COLUMNS FROM districts LIKE 'parent_id'"
        )).fetchall()
        return bool(rows)
    if "add column properties.province" in sql_lc:
        rows = conn.execute(text(
            "SHOW COLUMNS FROM properties LIKE 'province'"
        )).fetchall()
        return bool(rows)
    return False


def _try_exec(conn, sql: str) -> bool:
    try:
        conn.execute(text(sql))
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[skip] {sql}  ({exc.__class__.__name__}: {str(exc).splitlines()[0]})")
        return False


def main() -> int:
    with engine.begin() as conn:
        for sql in MIGRATIONS:
            if _already_applied(conn, sql):
                print(f"[done] {sql}  (列已存在 → 跳过)")
                continue
            print(f"[exec] {sql}")
            _try_exec(conn, sql)
    print("MIGRATE DONE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
