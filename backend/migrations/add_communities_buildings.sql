-- ============================================================================
-- add_communities_buildings.sql
-- 创建 communities（小区）和 buildings（楼栋）表，重构楼盘数据层级。
--
-- 架构变更：
--   1. 新建 communities 表（小区/楼盘综合体）
--   2. 新建 buildings 表（楼栋）
--   3. properties 添加 community_id FK
--   4. house_types 添加 building_id FK
--   5. 将现有 properties 数据回填为 communities + buildings
--
-- idempotent — 重复执行安全。
-- ============================================================================

-- ── 1) 创建 communities 表 ──
CREATE TABLE IF NOT EXISTS `communities` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '小区ID',
  `district_id` int NOT NULL COMMENT '区域ID',
  `name` varchar(100) NOT NULL COMMENT '小区名称',
  `alias` varchar(100) NULL COMMENT '别名/曾用名',
  `address` varchar(200) NULL COMMENT '详细地址',
  `developer` varchar(100) NULL COMMENT '开发商',
  `property_type` varchar(50) NULL COMMENT '物业类型(住宅/公寓/别墅/商住)',
  `building_count` int NULL DEFAULT 0 COMMENT '楼栋总数',
  `total_households` int NULL COMMENT '总户数',
  `plot_ratio` decimal(5,2) NULL COMMENT '容积率',
  `green_rate` decimal(5,2) NULL COMMENT '绿化率(%)',
  `parking_ratio` varchar(20) NULL COMMENT '车位比',
  `property_company` varchar(100) NULL COMMENT '物业公司',
  `property_fee` decimal(8,2) NULL COMMENT '物业费(元/平方米*月)',
  `land_area` decimal(15,2) NULL COMMENT '占地面积(平方米)',
  `building_area` decimal(15,2) NULL COMMENT '建筑面积(平方米)',
  `delivery_date` date NULL COMMENT '交房时间',
  `decoration_status` varchar(20) NULL COMMENT '装修状态(毛坯/简装/精装)',
  `school_district` varchar(200) NULL COMMENT '学区',
  `metro_distance` int NULL COMMENT '最近地铁距离(米)',
  `metro_line` varchar(50) NULL COMMENT '最近地铁线路',
  `status` varchar(20) DEFAULT '在售' COMMENT '状态(在售/待售/售罄)',
  `tags` json NULL COMMENT '标签',
  `description` text NULL COMMENT '小区简介',
  `is_featured` tinyint(1) DEFAULT 0 COMMENT '是否推荐',
  `sort_order` int DEFAULT 0 COMMENT '排序',
  `owner_id` int NULL COMMENT '房东/发布者ID',
  `price_per_sqm` decimal(10,2) NULL COMMENT '参考均价(元/平方米)',
  `total_price_min` decimal(15,2) NULL COMMENT '最低总价(万)',
  `total_price_max` decimal(15,2) NULL COMMENT '最高总价(万)',
  `area_min` decimal(8,2) NULL COMMENT '最小面积(平方米)',
  `area_max` decimal(8,2) NULL COMMENT '最大面积(平方米)',
  `province` varchar(30) NULL,
  `city` varchar(30) NULL,
  `district_name` varchar(50) NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_district`(`district_id`) USING BTREE,
  INDEX `idx_name`(`name`) USING BTREE,
  INDEX `idx_status`(`status`) USING BTREE,
  INDEX `idx_featured`(`is_featured`) USING BTREE,
  INDEX `ix_communities_region`(`province`, `city`, `district_name`) USING BTREE,
  INDEX `idx_owner`(`owner_id`) USING BTREE,
  CONSTRAINT `communities_ibfk_1` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `communities_ibfk_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='小区表' ROW_FORMAT=DYNAMIC;

-- ── 2) 创建 buildings 表 ──
CREATE TABLE IF NOT EXISTS `buildings` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '楼栋ID',
  `community_id` int NOT NULL COMMENT '小区ID',
  `name` varchar(50) NOT NULL COMMENT '楼号(如: 1号楼/1幢/A座)',
  `building_number` varchar(20) NULL COMMENT '楼栋编号(纯数字/字母)',
  `building_type` varchar(30) NULL COMMENT '建筑类型(板楼/塔楼/板塔结合/联排/独栋)',
  `total_floors` int NULL COMMENT '总楼层数',
  `floor_min` int NULL COMMENT '最低层数',
  `floor_max` int NULL COMMENT '最高层数',
  `units_per_floor` int NULL COMMENT '每层户数',
  `unit_count` int NULL COMMENT '单元数',
  `elevator_count` int NULL COMMENT '电梯数',
  `orientation` varchar(20) NULL COMMENT '朝向(南/南北/东/西)',
  `delivery_date` date NULL COMMENT '该楼栋交房时间',
  `decoration_status` varchar(20) NULL COMMENT '装修(毛坯/简装/精装,覆盖小区级)',
  `metro_distance` int NULL COMMENT '该楼栋距最近地铁口距离(米)',
  `status` varchar(20) DEFAULT '在售' COMMENT '状态',
  `sort_order` int DEFAULT 0 COMMENT '排序',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_community`(`community_id`) USING BTREE,
  INDEX `idx_name`(`name`) USING BTREE,
  INDEX `idx_status`(`status`) USING BTREE,
  INDEX `idx_building_number`(`building_number`) USING BTREE,
  CONSTRAINT `buildings_ibfk_1` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='楼栋表' ROW_FORMAT=DYNAMIC;

-- ── 3) properties 添加 community_id ──
ALTER TABLE properties ADD COLUMN community_id INT NULL COMMENT '关联小区ID';
ALTER TABLE properties ADD INDEX idx_properties_community (community_id);
ALTER TABLE properties ADD CONSTRAINT properties_ibfk_community
    FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE SET NULL ON UPDATE RESTRICT;

-- ── 4) house_types 添加 building_id ──
ALTER TABLE house_types ADD COLUMN building_id INT NULL COMMENT '关联楼栋ID';
ALTER TABLE house_types ADD INDEX idx_house_types_building (building_id);
ALTER TABLE house_types ADD CONSTRAINT house_types_ibfk_building
    FOREIGN KEY (building_id) REFERENCES buildings (id) ON DELETE CASCADE ON UPDATE RESTRICT;

-- ── 5) 数据回填：properties → communities ──
INSERT INTO communities (id, district_id, name, address, developer, property_type,
    total_households, plot_ratio, green_rate, parking_ratio, property_company,
    property_fee, land_area, building_area, delivery_date, decoration_status,
    school_district, metro_distance, metro_line, status, tags, description,
    is_featured, sort_order, owner_id, price_per_sqm,
    total_price_min, total_price_max, area_min, area_max,
    province, city, district_name, building_count)
SELECT p.id, p.district_id, p.name, p.address, p.developer, p.property_type,
    p.total_households, p.plot_ratio, p.green_rate, p.parking_ratio, p.property_company,
    p.property_fee, p.land_area, p.building_area, p.delivery_date, p.decoration_status,
    p.school_district, p.metro_distance, p.metro_line, p.status, p.tags, p.description,
    p.is_featured, p.sort_order, p.owner_id, p.price_per_sqm,
    p.total_price_min, p.total_price_max, p.area_min, p.area_max,
    p.province, p.city, p.district_name, 1
FROM properties p
LEFT JOIN communities c ON c.id = p.id
WHERE c.id IS NULL;

-- ── 6) 回填 properties.community_id ──
UPDATE properties SET community_id = id WHERE community_id IS NULL;

-- ── 7) 回填 buildings（每个 properties 生成一条楼栋记录）──
INSERT INTO buildings (community_id, name, building_number, total_floors, floor_min, floor_max, status, sort_order)
SELECT p.community_id, '1号楼', '1',
    CASE WHEN p.floor_max IS NOT NULL AND p.floor_min IS NOT NULL
         THEN p.floor_max - p.floor_min + 1 ELSE NULL END,
    p.floor_min, p.floor_max, p.status, 0
FROM properties p
LEFT JOIN buildings b ON b.community_id = p.community_id AND b.name = '1号楼'
WHERE b.id IS NULL
  AND p.community_id IS NOT NULL;

-- ── 8) 回填 house_types.building_id ──
UPDATE house_types ht
INNER JOIN buildings b ON b.community_id = ht.property_id
SET ht.building_id = b.id
WHERE ht.building_id IS NULL;

-- ── 9) 更新 communities.building_count ──
UPDATE communities c
SET c.building_count = (SELECT COUNT(*) FROM buildings b WHERE b.community_id = c.id);

-- END ============================================================================
