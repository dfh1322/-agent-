"""数据库迁移：将 floor VARCHAR 替换为 floor_min / floor_max INT。

用法：
    python -m migrations.add_floor_range_columns

idempotent：重复执行安全。
"""

from __future__ import annotations

import sys

from sqlalchemy import text

from config.database import engine

# 按执行顺序排列
ADD_COLUMNS = [
    ("properties", "floor_min", "ALTER TABLE properties ADD COLUMN floor_min INT NULL COMMENT '最低楼层数'"),
    ("properties", "floor_max", "ALTER TABLE properties ADD COLUMN floor_max INT NULL COMMENT '最高楼层数'"),
    ("house_types", "floor_min", "ALTER TABLE house_types ADD COLUMN floor_min INT NULL COMMENT '最低楼层数'"),
    ("house_types", "floor_max", "ALTER TABLE house_types ADD COLUMN floor_max INT NULL COMMENT '最高楼层数'"),
]

DATA_MIGRATIONS = [
    (
        "properties: parse floor → floor_min/floor_max",
        """
        UPDATE properties
        SET floor_min = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(floor, '-', 1), '-', -1) AS UNSIGNED),
            floor_max = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(floor, '层', 1), '-', -1) AS UNSIGNED)
        WHERE floor IS NOT NULL
          AND floor REGEXP '^[0-9]+-[0-9]+层$'
          AND floor_min IS NULL
        """,
    ),
    (
        "house_types: parse floor → floor_min/floor_max",
        """
        UPDATE house_types
        SET floor_min = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(floor, '-', 1), '-', -1) AS UNSIGNED),
            floor_max = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(floor, '层', 1), '-', -1) AS UNSIGNED)
        WHERE floor IS NOT NULL
          AND floor REGEXP '^[0-9]+-[0-9]+层$'
          AND floor_min IS NULL
        """,
    ),
]

DROP_COLUMNS = [
    ("properties", "floor", "ALTER TABLE properties DROP COLUMN floor"),
    ("house_types", "floor", "ALTER TABLE house_types DROP COLUMN floor"),
]


def _column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(
        text(f"SHOW COLUMNS FROM `{table}` LIKE :col"),
        {"col": column},
    ).fetchall()
    return bool(rows)


def _try_exec(conn, label: str, sql: str) -> bool:
    try:
        conn.execute(text(sql))
        return True
    except Exception as exc:
        print(f"  [skip] {label}  ({exc.__class__.__name__}: {str(exc).splitlines()[0]})")
        return False


def main() -> int:
    with engine.begin() as conn:
        # 1) 添加新列
        for table, col, sql in ADD_COLUMNS:
            if _column_exists(conn, table, col):
                print(f"[done] {table}.{col} 已存在 → 跳过")
                continue
            print(f"[exec] {sql}")
            _try_exec(conn, f"{table}.{col}", sql)

        # 2) 数据迁移
        for label, sql in DATA_MIGRATIONS:
            print(f"[exec] {label}")
            _try_exec(conn, label, sql)

        # 3) 删除旧列
        for table, col, sql in DROP_COLUMNS:
            if not _column_exists(conn, table, col):
                print(f"[done] {table}.{col} 已删除 → 跳过")
                continue
            print(f"[exec] {sql}")
            _try_exec(conn, f"{table}.{col}", sql)

    print("\n[MIGRATE DONE]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
