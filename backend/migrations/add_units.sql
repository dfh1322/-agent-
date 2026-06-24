-- ============================================================================
-- add_units.sql
-- 创建 units（房间/房源）表，扩展 favorites/viewing_plans/contact_messages。
--
-- 架构变更：
--   1. 新建 units 表（房间号、楼层、独立售价、状态标签、灵活标签）
--   2. favorites 添加 unit_id FK（可选）
--   3. viewing_plans 添加 unit_ids JSON 列（可选）
--   4. contact_messages 添加 unit_id FK（可选）
--   5. 回填：为每个可售 house_type 生成一条默认 Unit
--
-- idempotent — 重复执行安全。
-- ============================================================================

-- ── 1) 创建 units 表 ──
CREATE TABLE IF NOT EXISTS `units` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '房间ID',
  `building_id` int NOT NULL COMMENT 'FK → buildings.id',
  `house_type_id` int NOT NULL COMMENT 'FK → house_types.id',
  `room_number` varchar(20) NOT NULL COMMENT '房间号，如 301 / 3-1-01 / A-1501',
  `floor` int NULL COMMENT '所在楼层',
  `area` decimal(8,2) NULL COMMENT '实际面积(㎡)',
  `total_price` decimal(15,2) NULL COMMENT '实际售价(万元)',
  `orientation` varchar(20) NULL COMMENT '朝向，覆盖户型默认值',
  `status_tag` varchar(20) DEFAULT '在售' COMMENT '主状态标签',
  `tags` json NULL COMMENT '灵活标签数组',
  `description` text NULL COMMENT '备注说明',
  `sort_order` int DEFAULT 0 COMMENT '排序',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_building` (`building_id`) USING BTREE,
  INDEX `idx_house_type` (`house_type_id`) USING BTREE,
  INDEX `idx_status_tag` (`status_tag`) USING BTREE,
  INDEX `idx_floor` (`floor`) USING BTREE,
  INDEX `idx_total_price` (`total_price`) USING BTREE,
  INDEX `idx_room_number` (`room_number`) USING BTREE,
  CONSTRAINT `fk_units_building` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_units_house_type` FOREIGN KEY (`house_type_id`) REFERENCES `house_types` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='房间/房源表' ROW_FORMAT=DYNAMIC;

-- ── 2) favorites 添加 unit_id ──
ALTER TABLE favorites ADD COLUMN unit_id INT NULL COMMENT 'FK → units.id' AFTER property_id;
ALTER TABLE favorites ADD INDEX idx_favorites_unit (unit_id);

-- ── 3) viewing_plans 添加 unit_ids ──
ALTER TABLE viewing_plans ADD COLUMN unit_ids JSON NULL COMMENT '关联房间ID列表' AFTER property_ids;

-- ── 4) contact_messages 添加 unit_id ──
ALTER TABLE contact_messages ADD COLUMN unit_id INT NULL COMMENT 'FK → units.id' AFTER property_id;
ALTER TABLE contact_messages ADD INDEX idx_contact_messages_unit (unit_id);

-- ── 5) 回填默认 units ──
INSERT INTO units (building_id, house_type_id, room_number, floor, area, total_price, orientation, status_tag, tags, description)
SELECT
  ht.building_id,
  ht.id,
  '参考' AS room_number,
  ht.floor_min AS floor,
  ht.area,
  ht.total_price,
  ht.orientation,
  CASE WHEN ht.is_available = 1 THEN '在售' ELSE '已售' END AS status_tag,
  NULL AS tags,
  '自动生成（迁移回填）' AS description
FROM house_types ht
LEFT JOIN units u ON u.house_type_id = ht.id
WHERE u.id IS NULL
  AND ht.building_id IS NOT NULL;

-- ── 6) 补充 FK 约束 ──
-- MySQL 不支持 ADD CONSTRAINT IF NOT EXISTS，若约束已存在则忽略错误
-- ALTER TABLE favorites ADD CONSTRAINT fk_favorites_unit
--     FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE CASCADE;
-- ALTER TABLE contact_messages ADD CONSTRAINT fk_contact_messages_unit
--     FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE SET NULL;

-- END ============================================================================
