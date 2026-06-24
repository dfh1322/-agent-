-- ============================================================================
-- add_floor_range_columns.sql
-- 将 properties / house_types 的 floor VARCHAR 列替换为 floor_min / floor_max INT
-- 与 ORM (backend/models/property.py) 同步。
--
-- 本文件为 idempotent —— 重复执行安全（列已存在则跳过，列已删除也跳过）。
--
-- 执行方法：
--   1) CLI（推荐）：
--         python -m migrations.add_floor_range_columns
--   2) MySQL 客户端直接执行本文件：
--         mysql -u <user> -p <db_name> < backend/migrations/add_floor_range_columns.sql
-- ============================================================================

-- ── 1) properties 表添加 floor_min / floor_max ──
ALTER TABLE properties ADD COLUMN floor_min INT NULL COMMENT '最低楼层数';
ALTER TABLE properties ADD COLUMN floor_max INT NULL COMMENT '最高楼层数';

-- ── 2) house_types 表添加 floor_min / floor_max ──
ALTER TABLE house_types ADD COLUMN floor_min INT NULL COMMENT '最低楼层数';
ALTER TABLE house_types ADD COLUMN floor_max INT NULL COMMENT '最高楼层数';

-- ── 3) 数据迁移：解析 "N-M层" → floor_min=N, floor_max=M ──
--     仅处理 floor_min IS NULL 的行（idempotent）
UPDATE properties
SET floor_min = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(floor, '-', 1), '-', -1) AS UNSIGNED),
    floor_max = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(floor, '层', 1), '-', -1) AS UNSIGNED)
WHERE floor IS NOT NULL
  AND floor REGEXP '^[0-9]+-[0-9]+层$'
  AND floor_min IS NULL;

UPDATE house_types
SET floor_min = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(floor, '-', 1), '-', -1) AS UNSIGNED),
    floor_max = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(floor, '层', 1), '-', -1) AS UNSIGNED)
WHERE floor IS NOT NULL
  AND floor REGEXP '^[0-9]+-[0-9]+层$'
  AND floor_min IS NULL;

-- ── 4) 删除旧 VARCHAR 列 ──
ALTER TABLE properties DROP COLUMN floor;
ALTER TABLE house_types DROP COLUMN floor;

-- END ============================================================================
