-- ============================================================================
-- migrate_district_hierarchy.sql
-- 一次性升级 districts / properties 表 schema，支持省/市/区县三级级联
-- 与 ORM (backend/models/property.py + backend/migrations/migrate_district_hierarchy.py)
-- 同步。已迁移的环境可重复执行（No-op）。
--
-- 执行方法（任选其一）：
--   1) CLI（推荐）：
--         python -m migrations.migrate_district_hierarchy
--   2) MySQL 客户端直接执行本文件：
--         mysql -u <user> -p <db_name> < backend/migrations/migrate_district_hierarchy.sql
--   3) 在 MySQL Workbench / Navicat 打开本文件，点击执行
--
-- 如本环境 schema 已经存在这些列，语句会因"列已存在"而失败，这是
-- 预期 (MySQL 8 没有 IF NOT EXISTS 列语法) — 失败行直接跳过即可。
-- ============================================================================

-- 1) districts 表新增级联列 -------------------------------------------------
ALTER TABLE districts ADD COLUMN parent_id INT NULL;
ALTER TABLE districts ADD COLUMN level INT NOT NULL DEFAULT 3;
ALTER TABLE districts ADD COLUMN full_path VARCHAR(150) NULL;
ALTER TABLE districts ADD COLUMN code VARCHAR(20) NULL;

-- 索引
CREATE INDEX ix_districts_full_path ON districts (full_path);
CREATE INDEX ix_districts_code ON districts (code);

-- 自引用外键（最后执行，避免脏数据时被拦下）
ALTER TABLE districts
    ADD CONSTRAINT fk_districts_parent
        FOREIGN KEY (parent_id) REFERENCES districts (id) ON DELETE CASCADE;

-- 2) properties 表添加省/市/区县缓存字段 ----------------------------------
ALTER TABLE properties ADD COLUMN province VARCHAR(30) NULL;
ALTER TABLE properties ADD COLUMN city VARCHAR(30) NULL;
ALTER TABLE properties ADD COLUMN district_name VARCHAR(50) NULL;
ALTER TABLE properties ADD INDEX ix_properties_region (province, city, district_name);

-- 3) (可选) 反向初始化 city 缓存：将已有 properties 的 city 从关联
--        District.city 反推写入 properties.city，仅在 policy 要求历史
--        数据迁移时执行；运行下面这段会展示受影响 row 数。
--
-- UPDATE properties p
-- JOIN districts d ON p.district_id = d.id
-- SET p.city = d.city,
--     p.district_name = d.name,
--     p.province = COALESCE(SUBSTRING_INDEX(d.full_path, '/', 1), '');
-- COMMIT;

-- END ============================================================================
