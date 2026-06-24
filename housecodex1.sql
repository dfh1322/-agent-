/*
 Navicat MySQL Dump SQL

 Source Server         : localhost_3306
 Source Server Type    : MySQL
 Source Server Version : 80100 (8.1.0)
 Source Host           : localhost:3306
 Source Schema         : housecodex

 Target Server Type    : MySQL
 Target Server Version : 80100 (8.1.0)
 File Encoding         : 65001

 Date: 24/06/2026 11:38:54
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for buildings
-- ----------------------------
DROP TABLE IF EXISTS `buildings`;
CREATE TABLE `buildings`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '楼栋ID',
  `community_id` int NOT NULL COMMENT '小区ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '楼号',
  `building_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '楼栋编号',
  `building_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '建筑类型(板楼/塔楼/板塔结合/联排/独栋)',
  `total_floors` int NULL DEFAULT NULL COMMENT '总楼层数',
  `floor_min` int NULL DEFAULT NULL COMMENT '最低层数',
  `floor_max` int NULL DEFAULT NULL COMMENT '最高层数',
  `units_per_floor` int NULL DEFAULT NULL COMMENT '每层户数',
  `unit_count` int NULL DEFAULT NULL COMMENT '单元数',
  `elevator_count` int NULL DEFAULT NULL COMMENT '电梯数',
  `orientation` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '朝向',
  `delivery_date` date NULL DEFAULT NULL COMMENT '交房时间',
  `decoration_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '装修',
  `metro_distance` int NULL DEFAULT NULL COMMENT '距地铁距离(米)',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '在售' COMMENT '状态',
  `sort_order` int NULL DEFAULT 0 COMMENT '排序',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_community`(`community_id` ASC) USING BTREE,
  INDEX `idx_name`(`name` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE,
  INDEX `idx_building_number`(`building_number` ASC) USING BTREE,
  CONSTRAINT `buildings_ibfk_1` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '楼栋表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of buildings
-- ----------------------------
INSERT INTO `buildings` VALUES (1, 1, '1', '1', '小高层', 10, 1, 10, 4, NULL, 2, '南', NULL, NULL, NULL, '在售', 0, '2026-06-24 11:26:07', '2026-06-24 11:26:07');

-- ----------------------------
-- Table structure for communities
-- ----------------------------
DROP TABLE IF EXISTS `communities`;
CREATE TABLE `communities`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '小区ID',
  `district_id` int NOT NULL COMMENT '区域ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '小区名称（对客展示为\"楼盘\"）',
  `alias` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '别名',
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '详细地址',
  `developer` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '开发商',
  `property_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '物业类型(住宅/公寓/别墅/商住)',
  `building_count` int NULL DEFAULT 0 COMMENT '楼栋总数',
  `total_households` int NULL DEFAULT NULL COMMENT '总户数',
  `plot_ratio` decimal(5, 2) NULL DEFAULT NULL COMMENT '容积率',
  `green_rate` decimal(5, 2) NULL DEFAULT NULL COMMENT '绿化率(%)',
  `parking_ratio` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '车位比',
  `property_company` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '物业公司',
  `property_fee` decimal(8, 2) NULL DEFAULT NULL COMMENT '物业费',
  `land_area` decimal(15, 2) NULL DEFAULT NULL COMMENT '占地面积',
  `building_area` decimal(15, 2) NULL DEFAULT NULL COMMENT '建筑面积',
  `delivery_date` date NULL DEFAULT NULL COMMENT '交房时间',
  `decoration_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '装修状态',
  `school_district` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '学区',
  `metro_distance` int NULL DEFAULT NULL COMMENT '地铁距离(米)',
  `metro_line` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '地铁线路',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '在售' COMMENT '状态',
  `tags` json NULL COMMENT '标签',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '简介',
  `is_featured` tinyint(1) NULL DEFAULT 0 COMMENT '是否推荐',
  `sort_order` int NULL DEFAULT 0 COMMENT '排序',
  `owner_id` int NULL DEFAULT NULL COMMENT '房东/发布者ID',
  `price_per_sqm` decimal(10, 2) NULL DEFAULT NULL COMMENT '参考均价',
  `total_price_min` decimal(15, 2) NULL DEFAULT NULL COMMENT '最低总价(万)',
  `total_price_max` decimal(15, 2) NULL DEFAULT NULL COMMENT '最高总价(万)',
  `area_min` decimal(8, 2) NULL DEFAULT NULL COMMENT '最小面积',
  `area_max` decimal(8, 2) NULL DEFAULT NULL COMMENT '最大面积',
  `province` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `city` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `district_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `floor_min` int NULL DEFAULT NULL COMMENT '最低楼层数',
  `floor_max` int NULL DEFAULT NULL COMMENT '最高楼层数',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_district`(`district_id` ASC) USING BTREE,
  INDEX `idx_name`(`name` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE,
  INDEX `idx_featured`(`is_featured` ASC) USING BTREE,
  INDEX `ix_communities_region`(`province` ASC, `city` ASC, `district_name` ASC) USING BTREE,
  INDEX `idx_owner`(`owner_id` ASC) USING BTREE,
  CONSTRAINT `communities_ibfk_1` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `communities_ibfk_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '小区/楼盘表（主实体）' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of communities
-- ----------------------------
INSERT INTO `communities` VALUES (1, 219, '测试1', NULL, '1', '1', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '简装', NULL, NULL, NULL, '在售', 'null', NULL, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, '广东', '广州', '天河区', '2026-06-24 11:25:42', '2026-06-24 11:26:07', 1, 10);

-- ----------------------------
-- Table structure for contact_messages
-- ----------------------------
DROP TABLE IF EXISTS `contact_messages`;
CREATE TABLE `contact_messages`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `landlord_id` int NOT NULL,
  `guest_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `guest_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `community_id` int NULL DEFAULT NULL COMMENT 'FK → communities.id',
  `unit_id` int NULL DEFAULT NULL COMMENT 'FK → units.id',
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `preferred_date` date NULL DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_contact_messages_community`(`community_id` ASC) USING BTREE,
  INDEX `ix_contact_messages_id`(`id` ASC) USING BTREE,
  INDEX `ix_contact_messages_landlord_id`(`landlord_id` ASC) USING BTREE,
  INDEX `idx_contact_messages_unit`(`unit_id` ASC) USING BTREE,
  CONSTRAINT `contact_messages_ibfk_1` FOREIGN KEY (`landlord_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `contact_messages_ibfk_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of contact_messages
-- ----------------------------

-- ----------------------------
-- Table structure for conversations
-- ----------------------------
DROP TABLE IF EXISTS `conversations`;
CREATE TABLE `conversations`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '对话ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '对话标题',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'active' COMMENT '状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE,
  CONSTRAINT `conversations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '对话记录表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of conversations
-- ----------------------------

-- ----------------------------
-- Table structure for districts
-- ----------------------------
DROP TABLE IF EXISTS `districts`;
CREATE TABLE `districts`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '区域ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '区域名称',
  `city` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '杭州' COMMENT '城市',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `sort_order` int NULL DEFAULT 0 COMMENT '排序',
  `is_active` tinyint(1) NULL DEFAULT 1 COMMENT '是否启用',
  `parent_id` int NULL DEFAULT NULL,
  `level` int NOT NULL DEFAULT 3,
  `full_path` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_name`(`name` ASC) USING BTREE,
  INDEX `ix_districts_full_path`(`full_path` ASC) USING BTREE,
  INDEX `ix_districts_code`(`code` ASC) USING BTREE,
  INDEX `fk_districts_parent`(`parent_id` ASC) USING BTREE,
  CONSTRAINT `fk_districts_parent` FOREIGN KEY (`parent_id`) REFERENCES `districts` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 381 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '区域表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of districts
-- ----------------------------
INSERT INTO `districts` VALUES (1, '西湖区', '杭州', '杭州市中心区域，配套成熟', 1, 1, NULL, 3, NULL, NULL);
INSERT INTO `districts` VALUES (2, '拱墅区', '杭州', '运河新城，发展迅速', 2, 1, NULL, 3, NULL, NULL);
INSERT INTO `districts` VALUES (3, '上城区', '杭州', '钱江新城，CBD核心', 3, 1, NULL, 3, NULL, NULL);
INSERT INTO `districts` VALUES (4, '滨江区', '杭州', '高新区，互联网产业聚集', 4, 1, NULL, 3, NULL, NULL);
INSERT INTO `districts` VALUES (5, '余杭区', '杭州', '未来科技城，城西科创大走廊', 5, 1, NULL, 3, NULL, NULL);
INSERT INTO `districts` VALUES (6, '萧山区', '杭州', '亚运村，南站枢纽', 6, 1, NULL, 3, NULL, NULL);
INSERT INTO `districts` VALUES (7, '东城区', '北京', NULL, 0, 1, NULL, 3, '北京/北京/东城区', NULL);
INSERT INTO `districts` VALUES (8, '西城区', '北京', NULL, 0, 1, NULL, 3, '北京/北京/西城区', NULL);
INSERT INTO `districts` VALUES (9, '朝阳区', '北京', NULL, 0, 1, NULL, 3, '北京/北京/朝阳区', NULL);
INSERT INTO `districts` VALUES (10, '海淀区', '北京', NULL, 0, 1, NULL, 3, '北京/北京/海淀区', NULL);
INSERT INTO `districts` VALUES (11, '丰台区', '北京', NULL, 0, 1, NULL, 3, '北京/北京/丰台区', NULL);
INSERT INTO `districts` VALUES (12, '石景山区', '北京', NULL, 0, 1, NULL, 3, '北京/北京/石景山区', NULL);
INSERT INTO `districts` VALUES (13, '通州区', '北京', NULL, 0, 1, NULL, 3, '北京/北京/通州区', NULL);
INSERT INTO `districts` VALUES (14, '昌平区', '北京', NULL, 0, 1, NULL, 3, '北京/北京/昌平区', NULL);
INSERT INTO `districts` VALUES (15, '黄浦区', '上海', NULL, 0, 1, NULL, 3, '上海/上海/黄浦区', NULL);
INSERT INTO `districts` VALUES (16, '徐汇区', '上海', NULL, 0, 1, NULL, 3, '上海/上海/徐汇区', NULL);
INSERT INTO `districts` VALUES (17, '长宁区', '上海', NULL, 0, 1, NULL, 3, '上海/上海/长宁区', NULL);
INSERT INTO `districts` VALUES (18, '静安区', '上海', NULL, 0, 1, NULL, 3, '上海/上海/静安区', NULL);
INSERT INTO `districts` VALUES (19, '普陀区', '上海', NULL, 0, 1, NULL, 3, '上海/上海/普陀区', NULL);
INSERT INTO `districts` VALUES (20, '虹口区', '上海', NULL, 0, 1, NULL, 3, '上海/上海/虹口区', NULL);
INSERT INTO `districts` VALUES (201, '浦东新区', '上海', NULL, 0, 1, NULL, 3, '上海/上海/浦东新区', NULL);
INSERT INTO `districts` VALUES (202, '闵行区', '上海', NULL, 0, 1, NULL, 3, '上海/上海/闵行区', NULL);
INSERT INTO `districts` VALUES (203, '宝山区', '上海', NULL, 0, 1, NULL, 3, '上海/上海/宝山区', NULL);
INSERT INTO `districts` VALUES (204, '松江区', '上海', NULL, 0, 1, NULL, 3, '上海/上海/松江区', NULL);
INSERT INTO `districts` VALUES (205, '和平区', '天津', NULL, 0, 1, NULL, 3, '天津/天津/和平区', NULL);
INSERT INTO `districts` VALUES (206, '河西区', '天津', NULL, 0, 1, NULL, 3, '天津/天津/河西区', NULL);
INSERT INTO `districts` VALUES (207, '南开区', '天津', NULL, 0, 1, NULL, 3, '天津/天津/南开区', NULL);
INSERT INTO `districts` VALUES (208, '河北区', '天津', NULL, 0, 1, NULL, 3, '天津/天津/河北区', NULL);
INSERT INTO `districts` VALUES (209, '河东区', '天津', NULL, 0, 1, NULL, 3, '天津/天津/河东区', NULL);
INSERT INTO `districts` VALUES (210, '滨海新区', '天津', NULL, 0, 1, NULL, 3, '天津/天津/滨海新区', NULL);
INSERT INTO `districts` VALUES (211, '渝中区', '重庆', NULL, 0, 1, NULL, 3, '重庆/重庆/渝中区', NULL);
INSERT INTO `districts` VALUES (212, '江北区', '重庆', NULL, 0, 1, NULL, 3, '重庆/重庆/江北区', NULL);
INSERT INTO `districts` VALUES (213, '南岸区', '重庆', NULL, 0, 1, NULL, 3, '重庆/重庆/南岸区', NULL);
INSERT INTO `districts` VALUES (214, '九龙坡区', '重庆', NULL, 0, 1, NULL, 3, '重庆/重庆/九龙坡区', NULL);
INSERT INTO `districts` VALUES (215, '沙坪坝区', '重庆', NULL, 0, 1, NULL, 3, '重庆/重庆/沙坪坝区', NULL);
INSERT INTO `districts` VALUES (216, '渝北区', '重庆', NULL, 0, 1, NULL, 3, '重庆/重庆/渝北区', NULL);
INSERT INTO `districts` VALUES (217, '巴南区', '重庆', NULL, 0, 1, NULL, 3, '重庆/重庆/巴南区', NULL);
INSERT INTO `districts` VALUES (218, '北碚区', '重庆', NULL, 0, 1, NULL, 3, '重庆/重庆/北碚区', NULL);
INSERT INTO `districts` VALUES (219, '天河区', '广州', NULL, 0, 1, NULL, 3, '广东/广州/天河区', NULL);
INSERT INTO `districts` VALUES (220, '越秀区', '广州', NULL, 0, 1, NULL, 3, '广东/广州/越秀区', NULL);
INSERT INTO `districts` VALUES (221, '海珠区', '广州', NULL, 0, 1, NULL, 3, '广东/广州/海珠区', NULL);
INSERT INTO `districts` VALUES (222, '荔湾区', '广州', NULL, 0, 1, NULL, 3, '广东/广州/荔湾区', NULL);
INSERT INTO `districts` VALUES (223, '白云区', '广州', NULL, 0, 1, NULL, 3, '广东/广州/白云区', NULL);
INSERT INTO `districts` VALUES (224, '黄埔区', '广州', NULL, 0, 1, NULL, 3, '广东/广州/黄埔区', NULL);
INSERT INTO `districts` VALUES (225, '番禺区', '广州', NULL, 0, 1, NULL, 3, '广东/广州/番禺区', NULL);
INSERT INTO `districts` VALUES (226, '南沙区', '广州', NULL, 0, 1, NULL, 3, '广东/广州/南沙区', NULL);
INSERT INTO `districts` VALUES (227, '福田', '深圳', NULL, 0, 1, NULL, 3, '广东/深圳/福田', NULL);
INSERT INTO `districts` VALUES (228, '罗湖', '深圳', NULL, 0, 1, NULL, 3, '广东/深圳/罗湖', NULL);
INSERT INTO `districts` VALUES (229, '南山', '深圳', NULL, 0, 1, NULL, 3, '广东/深圳/南山', NULL);
INSERT INTO `districts` VALUES (230, '宝安', '深圳', NULL, 0, 1, NULL, 3, '广东/深圳/宝安', NULL);
INSERT INTO `districts` VALUES (231, '龙岗', '深圳', NULL, 0, 1, NULL, 3, '广东/深圳/龙岗', NULL);
INSERT INTO `districts` VALUES (232, '龙华', '深圳', NULL, 0, 1, NULL, 3, '广东/深圳/龙华', NULL);
INSERT INTO `districts` VALUES (233, '光明', '深圳', NULL, 0, 1, NULL, 3, '广东/深圳/光明', NULL);
INSERT INTO `districts` VALUES (234, '禅城', '佛山', NULL, 0, 1, NULL, 3, '广东/佛山/禅城', NULL);
INSERT INTO `districts` VALUES (235, '南海', '佛山', NULL, 0, 1, NULL, 3, '广东/佛山/南海', NULL);
INSERT INTO `districts` VALUES (236, '顺德', '佛山', NULL, 0, 1, NULL, 3, '广东/佛山/顺德', NULL);
INSERT INTO `districts` VALUES (237, '东城', '东莞', NULL, 0, 1, NULL, 3, '广东/东莞/东城', NULL);
INSERT INTO `districts` VALUES (238, '南城', '东莞', NULL, 0, 1, NULL, 3, '广东/东莞/南城', NULL);
INSERT INTO `districts` VALUES (239, '万江', '东莞', NULL, 0, 1, NULL, 3, '广东/东莞/万江', NULL);
INSERT INTO `districts` VALUES (240, '临平区', '杭州', NULL, 0, 1, NULL, 3, '浙江/杭州/临平区', NULL);
INSERT INTO `districts` VALUES (241, '钱塘区', '杭州', NULL, 0, 1, NULL, 3, '浙江/杭州/钱塘区', NULL);
INSERT INTO `districts` VALUES (242, '海曙', '宁波', NULL, 0, 1, NULL, 3, '浙江/宁波/海曙', NULL);
INSERT INTO `districts` VALUES (243, '江北', '宁波', NULL, 0, 1, NULL, 3, '浙江/宁波/江北', NULL);
INSERT INTO `districts` VALUES (244, '鄞州', '宁波', NULL, 0, 1, NULL, 3, '浙江/宁波/鄞州', NULL);
INSERT INTO `districts` VALUES (245, '镇海', '宁波', NULL, 0, 1, NULL, 3, '浙江/宁波/镇海', NULL);
INSERT INTO `districts` VALUES (246, '越城', '绍兴', NULL, 0, 1, NULL, 3, '浙江/绍兴/越城', NULL);
INSERT INTO `districts` VALUES (247, '柯桥', '绍兴', NULL, 0, 1, NULL, 3, '浙江/绍兴/柯桥', NULL);
INSERT INTO `districts` VALUES (248, '鹿城', '温州', NULL, 0, 1, NULL, 3, '浙江/温州/鹿城', NULL);
INSERT INTO `districts` VALUES (249, '瓯海', '温州', NULL, 0, 1, NULL, 3, '浙江/温州/瓯海', NULL);
INSERT INTO `districts` VALUES (250, '南湖', '嘉兴', NULL, 0, 1, NULL, 3, '浙江/嘉兴/南湖', NULL);
INSERT INTO `districts` VALUES (251, '秀洲', '嘉兴', NULL, 0, 1, NULL, 3, '浙江/嘉兴/秀洲', NULL);
INSERT INTO `districts` VALUES (252, '婺城', '金华', NULL, 0, 1, NULL, 3, '浙江/金华/婺城', NULL);
INSERT INTO `districts` VALUES (253, '金东', '金华', NULL, 0, 1, NULL, 3, '浙江/金华/金东', NULL);
INSERT INTO `districts` VALUES (254, '鼓楼区', '南京', NULL, 0, 1, NULL, 3, '江苏/南京/鼓楼区', NULL);
INSERT INTO `districts` VALUES (255, '玄武区', '南京', NULL, 0, 1, NULL, 3, '江苏/南京/玄武区', NULL);
INSERT INTO `districts` VALUES (256, '建邺区', '南京', NULL, 0, 1, NULL, 3, '江苏/南京/建邺区', NULL);
INSERT INTO `districts` VALUES (257, '秦淮区', '南京', NULL, 0, 1, NULL, 3, '江苏/南京/秦淮区', NULL);
INSERT INTO `districts` VALUES (258, '栖霞区', '南京', NULL, 0, 1, NULL, 3, '江苏/南京/栖霞区', NULL);
INSERT INTO `districts` VALUES (259, '雨花台区', '南京', NULL, 0, 1, NULL, 3, '江苏/南京/雨花台区', NULL);
INSERT INTO `districts` VALUES (260, '江宁区', '南京', NULL, 0, 1, NULL, 3, '江苏/南京/江宁区', NULL);
INSERT INTO `districts` VALUES (261, '浦口区', '南京', NULL, 0, 1, NULL, 3, '江苏/南京/浦口区', NULL);
INSERT INTO `districts` VALUES (262, '姑苏', '苏州', NULL, 0, 1, NULL, 3, '江苏/苏州/姑苏', NULL);
INSERT INTO `districts` VALUES (263, '工业园区', '苏州', NULL, 0, 1, NULL, 3, '江苏/苏州/工业园区', NULL);
INSERT INTO `districts` VALUES (264, '高新区', '苏州', NULL, 0, 1, NULL, 3, '江苏/苏州/高新区', NULL);
INSERT INTO `districts` VALUES (265, '吴中', '苏州', NULL, 0, 1, NULL, 3, '江苏/苏州/吴中', NULL);
INSERT INTO `districts` VALUES (266, '相城', '苏州', NULL, 0, 1, NULL, 3, '江苏/苏州/相城', NULL);
INSERT INTO `districts` VALUES (267, '梁溪', '无锡', NULL, 0, 1, NULL, 3, '江苏/无锡/梁溪', NULL);
INSERT INTO `districts` VALUES (268, '锡山', '无锡', NULL, 0, 1, NULL, 3, '江苏/无锡/锡山', NULL);
INSERT INTO `districts` VALUES (269, '天宁', '常州', NULL, 0, 1, NULL, 3, '江苏/常州/天宁', NULL);
INSERT INTO `districts` VALUES (270, '钟楼', '常州', NULL, 0, 1, NULL, 3, '江苏/常州/钟楼', NULL);
INSERT INTO `districts` VALUES (271, '崇川', '南通', NULL, 0, 1, NULL, 3, '江苏/南通/崇川', NULL);
INSERT INTO `districts` VALUES (272, '通州', '南通', NULL, 0, 1, NULL, 3, '江苏/南通/通州', NULL);
INSERT INTO `districts` VALUES (273, '历下区', '济南', NULL, 0, 1, NULL, 3, '山东/济南/历下区', NULL);
INSERT INTO `districts` VALUES (274, '市中区', '济南', NULL, 0, 1, NULL, 3, '山东/济南/市中区', NULL);
INSERT INTO `districts` VALUES (275, '槐荫区', '济南', NULL, 0, 1, NULL, 3, '山东/济南/槐荫区', NULL);
INSERT INTO `districts` VALUES (276, '天桥区', '济南', NULL, 0, 1, NULL, 3, '山东/济南/天桥区', NULL);
INSERT INTO `districts` VALUES (277, '高新区', '济南', NULL, 0, 1, NULL, 3, '山东/济南/高新区', NULL);
INSERT INTO `districts` VALUES (278, '历城区', '济南', NULL, 0, 1, NULL, 3, '山东/济南/历城区', NULL);
INSERT INTO `districts` VALUES (279, '市南', '青岛', NULL, 0, 1, NULL, 3, '山东/青岛/市南', NULL);
INSERT INTO `districts` VALUES (280, '市北', '青岛', NULL, 0, 1, NULL, 3, '山东/青岛/市北', NULL);
INSERT INTO `districts` VALUES (281, '崂山', '青岛', NULL, 0, 1, NULL, 3, '山东/青岛/崂山', NULL);
INSERT INTO `districts` VALUES (282, '李沧', '青岛', NULL, 0, 1, NULL, 3, '山东/青岛/李沧', NULL);
INSERT INTO `districts` VALUES (283, '黄岛', '青岛', NULL, 0, 1, NULL, 3, '山东/青岛/黄岛', NULL);
INSERT INTO `districts` VALUES (284, '芝罘', '烟台', NULL, 0, 1, NULL, 3, '山东/烟台/芝罘', NULL);
INSERT INTO `districts` VALUES (285, '福山', '烟台', NULL, 0, 1, NULL, 3, '山东/烟台/福山', NULL);
INSERT INTO `districts` VALUES (286, '鼓楼区', '福州', NULL, 0, 1, NULL, 3, '福建/福州/鼓楼区', NULL);
INSERT INTO `districts` VALUES (287, '台江区', '福州', NULL, 0, 1, NULL, 3, '福建/福州/台江区', NULL);
INSERT INTO `districts` VALUES (288, '仓山区', '福州', NULL, 0, 1, NULL, 3, '福建/福州/仓山区', NULL);
INSERT INTO `districts` VALUES (289, '晋安区', '福州', NULL, 0, 1, NULL, 3, '福建/福州/晋安区', NULL);
INSERT INTO `districts` VALUES (290, '马尾区', '福州', NULL, 0, 1, NULL, 3, '福建/福州/马尾区', NULL);
INSERT INTO `districts` VALUES (291, '思明', '厦门', NULL, 0, 1, NULL, 3, '福建/厦门/思明', NULL);
INSERT INTO `districts` VALUES (292, '湖里', '厦门', NULL, 0, 1, NULL, 3, '福建/厦门/湖里', NULL);
INSERT INTO `districts` VALUES (293, '集美', '厦门', NULL, 0, 1, NULL, 3, '福建/厦门/集美', NULL);
INSERT INTO `districts` VALUES (294, '海沧', '厦门', NULL, 0, 1, NULL, 3, '福建/厦门/海沧', NULL);
INSERT INTO `districts` VALUES (295, '鲤城', '泉州', NULL, 0, 1, NULL, 3, '福建/泉州/鲤城', NULL);
INSERT INTO `districts` VALUES (296, '丰泽', '泉州', NULL, 0, 1, NULL, 3, '福建/泉州/丰泽', NULL);
INSERT INTO `districts` VALUES (297, '蜀山区', '合肥', NULL, 0, 1, NULL, 3, '安徽/合肥/蜀山区', NULL);
INSERT INTO `districts` VALUES (298, '庐阳区', '合肥', NULL, 0, 1, NULL, 3, '安徽/合肥/庐阳区', NULL);
INSERT INTO `districts` VALUES (299, '包河区', '合肥', NULL, 0, 1, NULL, 3, '安徽/合肥/包河区', NULL);
INSERT INTO `districts` VALUES (300, '瑶海区', '合肥', NULL, 0, 1, NULL, 3, '安徽/合肥/瑶海区', NULL);
INSERT INTO `districts` VALUES (301, '高新区', '合肥', NULL, 0, 1, NULL, 3, '安徽/合肥/高新区', NULL);
INSERT INTO `districts` VALUES (302, '镜湖', '芜湖', NULL, 0, 1, NULL, 3, '安徽/芜湖/镜湖', NULL);
INSERT INTO `districts` VALUES (303, '鸠江', '芜湖', NULL, 0, 1, NULL, 3, '安徽/芜湖/鸠江', NULL);
INSERT INTO `districts` VALUES (304, '蚌山', '蚌埠', NULL, 0, 1, NULL, 3, '安徽/蚌埠/蚌山', NULL);
INSERT INTO `districts` VALUES (305, '龙子湖', '蚌埠', NULL, 0, 1, NULL, 3, '安徽/蚌埠/龙子湖', NULL);
INSERT INTO `districts` VALUES (306, '江岸区', '武汉', NULL, 0, 1, NULL, 3, '湖北/武汉/江岸区', NULL);
INSERT INTO `districts` VALUES (307, '江汉区', '武汉', NULL, 0, 1, NULL, 3, '湖北/武汉/江汉区', NULL);
INSERT INTO `districts` VALUES (308, '硚口区', '武汉', NULL, 0, 1, NULL, 3, '湖北/武汉/硚口区', NULL);
INSERT INTO `districts` VALUES (309, '汉阳区', '武汉', NULL, 0, 1, NULL, 3, '湖北/武汉/汉阳区', NULL);
INSERT INTO `districts` VALUES (310, '武昌区', '武汉', NULL, 0, 1, NULL, 3, '湖北/武汉/武昌区', NULL);
INSERT INTO `districts` VALUES (311, '青山区', '武汉', NULL, 0, 1, NULL, 3, '湖北/武汉/青山区', NULL);
INSERT INTO `districts` VALUES (312, '洪山区', '武汉', NULL, 0, 1, NULL, 3, '湖北/武汉/洪山区', NULL);
INSERT INTO `districts` VALUES (313, '西陵', '宜昌', NULL, 0, 1, NULL, 3, '湖北/宜昌/西陵', NULL);
INSERT INTO `districts` VALUES (314, '伍家岗', '宜昌', NULL, 0, 1, NULL, 3, '湖北/宜昌/伍家岗', NULL);
INSERT INTO `districts` VALUES (315, '芙蓉区', '长沙', NULL, 0, 1, NULL, 3, '湖南/长沙/芙蓉区', NULL);
INSERT INTO `districts` VALUES (316, '天心区', '长沙', NULL, 0, 1, NULL, 3, '湖南/长沙/天心区', NULL);
INSERT INTO `districts` VALUES (317, '岳麓区', '长沙', NULL, 0, 1, NULL, 3, '湖南/长沙/岳麓区', NULL);
INSERT INTO `districts` VALUES (318, '开福区', '长沙', NULL, 0, 1, NULL, 3, '湖南/长沙/开福区', NULL);
INSERT INTO `districts` VALUES (319, '雨花区', '长沙', NULL, 0, 1, NULL, 3, '湖南/长沙/雨花区', NULL);
INSERT INTO `districts` VALUES (320, '中原区', '郑州', NULL, 0, 1, NULL, 3, '河南/郑州/中原区', NULL);
INSERT INTO `districts` VALUES (321, '二七区', '郑州', NULL, 0, 1, NULL, 3, '河南/郑州/二七区', NULL);
INSERT INTO `districts` VALUES (322, '管城区', '郑州', NULL, 0, 1, NULL, 3, '河南/郑州/管城区', NULL);
INSERT INTO `districts` VALUES (323, '金水区', '郑州', NULL, 0, 1, NULL, 3, '河南/郑州/金水区', NULL);
INSERT INTO `districts` VALUES (324, '惠济区', '郑州', NULL, 0, 1, NULL, 3, '河南/郑州/惠济区', NULL);
INSERT INTO `districts` VALUES (325, '长安区', '石家庄', NULL, 0, 1, NULL, 3, '河北/石家庄/长安区', NULL);
INSERT INTO `districts` VALUES (326, '桥西区', '石家庄', NULL, 0, 1, NULL, 3, '河北/石家庄/桥西区', NULL);
INSERT INTO `districts` VALUES (327, '新华区', '石家庄', NULL, 0, 1, NULL, 3, '河北/石家庄/新华区', NULL);
INSERT INTO `districts` VALUES (328, '裕华区', '石家庄', NULL, 0, 1, NULL, 3, '河北/石家庄/裕华区', NULL);
INSERT INTO `districts` VALUES (329, '小店区', '太原', NULL, 0, 1, NULL, 3, '山西/太原/小店区', NULL);
INSERT INTO `districts` VALUES (330, '迎泽区', '太原', NULL, 0, 1, NULL, 3, '山西/太原/迎泽区', NULL);
INSERT INTO `districts` VALUES (331, '杏花岭区', '太原', NULL, 0, 1, NULL, 3, '山西/太原/杏花岭区', NULL);
INSERT INTO `districts` VALUES (332, '万柏林区', '太原', NULL, 0, 1, NULL, 3, '山西/太原/万柏林区', NULL);
INSERT INTO `districts` VALUES (333, '新城区', '西安', NULL, 0, 1, NULL, 3, '陕西/西安/新城区', NULL);
INSERT INTO `districts` VALUES (334, '碑林区', '西安', NULL, 0, 1, NULL, 3, '陕西/西安/碑林区', NULL);
INSERT INTO `districts` VALUES (335, '莲湖区', '西安', NULL, 0, 1, NULL, 3, '陕西/西安/莲湖区', NULL);
INSERT INTO `districts` VALUES (336, '雁塔区', '西安', NULL, 0, 1, NULL, 3, '陕西/西安/雁塔区', NULL);
INSERT INTO `districts` VALUES (337, '未央区', '西安', NULL, 0, 1, NULL, 3, '陕西/西安/未央区', NULL);
INSERT INTO `districts` VALUES (338, '高新区', '西安', NULL, 0, 1, NULL, 3, '陕西/西安/高新区', NULL);
INSERT INTO `districts` VALUES (339, '锦江区', '成都', NULL, 0, 1, NULL, 3, '四川/成都/锦江区', NULL);
INSERT INTO `districts` VALUES (340, '青羊区', '成都', NULL, 0, 1, NULL, 3, '四川/成都/青羊区', NULL);
INSERT INTO `districts` VALUES (341, '金牛区', '成都', NULL, 0, 1, NULL, 3, '四川/成都/金牛区', NULL);
INSERT INTO `districts` VALUES (342, '武侯区', '成都', NULL, 0, 1, NULL, 3, '四川/成都/武侯区', NULL);
INSERT INTO `districts` VALUES (343, '成华区', '成都', NULL, 0, 1, NULL, 3, '四川/成都/成华区', NULL);
INSERT INTO `districts` VALUES (344, '高新区', '成都', NULL, 0, 1, NULL, 3, '四川/成都/高新区', NULL);
INSERT INTO `districts` VALUES (345, '涪城', '绵阳', NULL, 0, 1, NULL, 3, '四川/绵阳/涪城', NULL);
INSERT INTO `districts` VALUES (346, '游仙', '绵阳', NULL, 0, 1, NULL, 3, '四川/绵阳/游仙', NULL);
INSERT INTO `districts` VALUES (347, '和平区', '沈阳', NULL, 0, 1, NULL, 3, '辽宁/沈阳/和平区', NULL);
INSERT INTO `districts` VALUES (348, '沈河区', '沈阳', NULL, 0, 1, NULL, 3, '辽宁/沈阳/沈河区', NULL);
INSERT INTO `districts` VALUES (349, '皇姑区', '沈阳', NULL, 0, 1, NULL, 3, '辽宁/沈阳/皇姑区', NULL);
INSERT INTO `districts` VALUES (350, '铁西区', '沈阳', NULL, 0, 1, NULL, 3, '辽宁/沈阳/铁西区', NULL);
INSERT INTO `districts` VALUES (351, '浑南区', '沈阳', NULL, 0, 1, NULL, 3, '辽宁/沈阳/浑南区', NULL);
INSERT INTO `districts` VALUES (352, '南关区', '长春', NULL, 0, 1, NULL, 3, '吉林/长春/南关区', NULL);
INSERT INTO `districts` VALUES (353, '宽城区', '长春', NULL, 0, 1, NULL, 3, '吉林/长春/宽城区', NULL);
INSERT INTO `districts` VALUES (354, '朝阳区', '长春', NULL, 0, 1, NULL, 3, '吉林/长春/朝阳区', NULL);
INSERT INTO `districts` VALUES (355, '二道区', '长春', NULL, 0, 1, NULL, 3, '吉林/长春/二道区', NULL);
INSERT INTO `districts` VALUES (356, '绿园区', '长春', NULL, 0, 1, NULL, 3, '吉林/长春/绿园区', NULL);
INSERT INTO `districts` VALUES (357, '道里区', '哈尔滨', NULL, 0, 1, NULL, 3, '黑龙江/哈尔滨/道里区', NULL);
INSERT INTO `districts` VALUES (358, '南岗区', '哈尔滨', NULL, 0, 1, NULL, 3, '黑龙江/哈尔滨/南岗区', NULL);
INSERT INTO `districts` VALUES (359, '道外区', '哈尔滨', NULL, 0, 1, NULL, 3, '黑龙江/哈尔滨/道外区', NULL);
INSERT INTO `districts` VALUES (360, '香坊区', '哈尔滨', NULL, 0, 1, NULL, 3, '黑龙江/哈尔滨/香坊区', NULL);
INSERT INTO `districts` VALUES (361, '五华区', '昆明', NULL, 0, 1, NULL, 3, '云南/昆明/五华区', NULL);
INSERT INTO `districts` VALUES (362, '盘龙区', '昆明', NULL, 0, 1, NULL, 3, '云南/昆明/盘龙区', NULL);
INSERT INTO `districts` VALUES (363, '官渡区', '昆明', NULL, 0, 1, NULL, 3, '云南/昆明/官渡区', NULL);
INSERT INTO `districts` VALUES (364, '西山区', '昆明', NULL, 0, 1, NULL, 3, '云南/昆明/西山区', NULL);
INSERT INTO `districts` VALUES (365, '云岩区', '贵阳', NULL, 0, 1, NULL, 3, '贵州/贵阳/云岩区', NULL);
INSERT INTO `districts` VALUES (366, '南明区', '贵阳', NULL, 0, 1, NULL, 3, '贵州/贵阳/南明区', NULL);
INSERT INTO `districts` VALUES (367, '观山湖区', '贵阳', NULL, 0, 1, NULL, 3, '贵州/贵阳/观山湖区', NULL);
INSERT INTO `districts` VALUES (368, '青秀区', '南宁', NULL, 0, 1, NULL, 3, '广西/南宁/青秀区', NULL);
INSERT INTO `districts` VALUES (369, '兴宁区', '南宁', NULL, 0, 1, NULL, 3, '广西/南宁/兴宁区', NULL);
INSERT INTO `districts` VALUES (370, '江南区', '南宁', NULL, 0, 1, NULL, 3, '广西/南宁/江南区', NULL);
INSERT INTO `districts` VALUES (371, '西乡塘区', '南宁', NULL, 0, 1, NULL, 3, '广西/南宁/西乡塘区', NULL);
INSERT INTO `districts` VALUES (372, '东湖区', '南昌', NULL, 0, 1, NULL, 3, '江西/南昌/东湖区', NULL);
INSERT INTO `districts` VALUES (373, '西湖区', '南昌', NULL, 0, 1, NULL, 3, '江西/南昌/西湖区', NULL);
INSERT INTO `districts` VALUES (374, '青云谱区', '南昌', NULL, 0, 1, NULL, 3, '江西/南昌/青云谱区', NULL);
INSERT INTO `districts` VALUES (375, '青山湖区', '南昌', NULL, 0, 1, NULL, 3, '江西/南昌/青山湖区', NULL);
INSERT INTO `districts` VALUES (376, '红谷滩区', '南昌', NULL, 0, 1, NULL, 3, '江西/南昌/红谷滩区', NULL);
INSERT INTO `districts` VALUES (377, '秀英区', '海口', NULL, 0, 1, NULL, 3, '海南/海口/秀英区', NULL);
INSERT INTO `districts` VALUES (378, '龙华区', '海口', NULL, 0, 1, NULL, 3, '海南/海口/龙华区', NULL);
INSERT INTO `districts` VALUES (379, '琼山区', '海口', NULL, 0, 1, NULL, 3, '海南/海口/琼山区', NULL);
INSERT INTO `districts` VALUES (380, '美兰区', '海口', NULL, 0, 1, NULL, 3, '海南/海口/美兰区', NULL);

-- ----------------------------
-- Table structure for faqs
-- ----------------------------
DROP TABLE IF EXISTS `faqs`;
CREATE TABLE `faqs`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'FAQ ID',
  `question` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `answer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `tags` json NULL,
  `sort_order` int NULL DEFAULT 0,
  `view_count` int NULL DEFAULT 0,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_category`(`category` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '常见问答表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of faqs
-- ----------------------------
INSERT INTO `faqs` VALUES (1, '杭州买房需要什么条件？', '杭州买房条件如下：\n\n1. 杭州户籍：单身可购买1套，已婚家庭可购买2套。\n\n2. 非杭州户籍：需提供在杭州连续缴纳12个月以上个人所得税或社会保险证明，可购买1套。\n\n3. 高层次人才：经认定的A-E类人才，按人才政策执行，可享受优先购房。', '限购政策', '[\"限购\", \"购房条件\"]', 1, 1000, 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');
INSERT INTO `faqs` VALUES (2, '公积金贷款最高能贷多少？', '杭州公积金贷款最高额度如下：\n\n1. 单人缴存：最高可贷款50万元。\n\n2. 夫妻双方缴存：最高可贷款80万元。\n\n3. 贷款额度还受缴存基数、账户余额、月还款能力等因素影响。', '贷款政策', '[\"公积金\", \"贷款额度\"]', 2, 800, 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');
INSERT INTO `faqs` VALUES (3, '首套房首付比例是多少？', '杭州首套房首付比例如下：\n\n1. 公积金贷款：首付比例不低于20%。\n\n2. 商业贷款：首付比例不低于30%。\n\n3. 组合贷款：按公积金和商业贷款中较高的首付比例执行。', '贷款政策', '[\"首付\", \"首套房\"]', 3, 750, 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');
INSERT INTO `faqs` VALUES (4, '二套房怎么认定？', '杭州二套房认定标准：\n\n1. 以家庭为单位，已有一套住房，再次购房算二套。\n\n2. 有过住房贷款记录，无论是否结清，再购房算二套。\n\n3. 住房以不动产权登记系统记录为准。', '限购政策', '[\"二套房\", \"认定标准\"]', 4, 600, 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');
INSERT INTO `faqs` VALUES (5, '二手房交易税费有哪些？', '二手房交易税费主要包括：\n\n1. 契税：首套房90㎡及以下1%，90㎡以上1.5%；二套房90㎡及以下1%，90㎡以上2%。\n\n2. 增值税：满2年免征，不满2年按5.3%征收。\n\n3. 个人所得税：满5年且是家庭唯一住房免征，否则按1%或差额20%征收。\n\n4. 中介费：一般为总房款的1-3%。', '税费政策', '[\"二手房\", \"税费\"]', 5, 550, 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');

-- ----------------------------
-- Table structure for favorites
-- ----------------------------
DROP TABLE IF EXISTS `favorites`;
CREATE TABLE `favorites`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '收藏ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `community_id` int NOT NULL COMMENT '小区/楼盘ID',
  `unit_id` int NULL DEFAULT NULL COMMENT 'FK → units.id',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_user_community`(`user_id` ASC, `community_id` ASC) USING BTREE,
  INDEX `idx_favorites_community`(`community_id` ASC) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
  INDEX `idx_favorites_unit`(`unit_id` ASC) USING BTREE,
  CONSTRAINT `favorites_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `favorites_ibfk_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户收藏表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of favorites
-- ----------------------------

-- ----------------------------
-- Table structure for house_types
-- ----------------------------
DROP TABLE IF EXISTS `house_types`;
CREATE TABLE `house_types`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '户型ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '户型名称',
  `bedrooms` int NULL DEFAULT NULL COMMENT '卧室数',
  `living_rooms` int NULL DEFAULT NULL COMMENT '客厅数',
  `bathrooms` int NULL DEFAULT NULL COMMENT '卫生间数',
  `kitchens` int NULL DEFAULT 1 COMMENT '厨房数',
  `area` decimal(8, 2) NOT NULL COMMENT '面积(㎡)',
  `orientation` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '朝向',
  `total_price` decimal(15, 2) NULL DEFAULT NULL COMMENT '总价(万)',
  `layout_image` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '户型图URL',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `is_available` tinyint(1) NULL DEFAULT 1 COMMENT '是否在售',
  `floor_min` int NULL DEFAULT NULL COMMENT '最低楼层',
  `floor_max` int NULL DEFAULT NULL COMMENT '最高楼层',
  `building_id` int NULL DEFAULT NULL COMMENT '关联楼栋ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_house_types_building`(`building_id` ASC) USING BTREE,
  CONSTRAINT `house_types_ibfk_building` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '户型表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of house_types
-- ----------------------------
INSERT INTO `house_types` VALUES (1, '101', 101, 2, 1, 1, 50.00, NULL, 100.00, NULL, NULL, 1, NULL, NULL, 1, '2026-06-24 11:26:35', '2026-06-24 11:26:35');

-- ----------------------------
-- Table structure for knowledge_docs
-- ----------------------------
DROP TABLE IF EXISTS `knowledge_docs`;
CREATE TABLE `knowledge_docs`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '文档ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `doc_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '文档类型',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `source` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `metadata` json NULL,
  `vector_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '向量数据库ID',
  `is_active` tinyint(1) NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_type`(`doc_type` ASC) USING BTREE,
  INDEX `idx_active`(`is_active` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '知识库文档表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of knowledge_docs
-- ----------------------------
INSERT INTO `knowledge_docs` VALUES (1, '杭州买房攻略-新手必看', '购房指南', '11', 'HouseCodex原创', '{\"views\": 5000, \"author\": \"房产小编\"}', NULL, 1, '2026-06-17 12:59:43', '2026-06-22 11:16:12');
INSERT INTO `knowledge_docs` VALUES (2, '杭州购房税费明细', '政策解读', '杭州购买新房税费明细：\n\n1. 契税\n- 首套房90㎡及以下：1%\n- 首套房90㎡以上：1.5%\n- 二套房90㎡及以下：1%\n- 二套房90㎡以上：2%\n- 三套房及以上：3%\n\n2. 维修基金\n- 多层住宅：55元/㎡\n- 高层住宅：65元/㎡\n\n3. 物业费\n- 一般2-6元/㎡·月，具体看小区\n\n4. 产权登记费\n- 80元/户\n\n5. 工本费\n- 10元/本', 'HouseCodex原创', '{\"views\": 3500, \"author\": \"税务专家\"}', NULL, 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');
INSERT INTO `knowledge_docs` VALUES (3, '杭州地铁规划详解', '楼盘详情', '杭州目前已开通地铁线路：\n\n1. 1号线：湘湖-萧山机场\n2. 2号线：朝阳-良渚\n3. 3号线：吴山前村-星桥\n4. 4号线：池华街-浦沿\n5. 5号线：金星-姑娘桥\n6. 6号线：枸桔弄-桂花西路/双浦\n7. 7号线：吴山广场-江东二路\n8. 8号线：文海南路-新湾路\n9. 9号线：观音塘-龙安\n10. 10号线：黄龙体育中心-逸盛路\n11. 16号线：绿汀路-九州街\n\n地铁规划线路（在建/规划中）：\n1. 3号线北延\n2. 4号线南延\n3. 12号线\n4. 15号线\n5. 18号线', 'HouseCodex原创', '{\"views\": 4200, \"author\": \"城市规划师\"}', NULL, 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');

-- ----------------------------
-- Table structure for messages
-- ----------------------------
DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  `conversation_id` int NOT NULL COMMENT '对话ID',
  `role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `tool_calls` json NULL,
  `tool_responses` json NULL,
  `metadata` json NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_conversation_id`(`conversation_id` ASC) USING BTREE,
  INDEX `idx_created_at`(`created_at` ASC) USING BTREE,
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 257 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '对话消息表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of messages
-- ----------------------------

-- ----------------------------
-- Table structure for operation_logs
-- ----------------------------
DROP TABLE IF EXISTS `operation_logs`;
CREATE TABLE `operation_logs`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `user_id` int NULL DEFAULT NULL,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `module` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `details` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `ip_address` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
  INDEX `idx_action`(`action` ASC) USING BTREE,
  INDEX `idx_created_at`(`created_at` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '操作日志表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of operation_logs
-- ----------------------------

-- ----------------------------
-- Table structure for policies
-- ----------------------------
DROP TABLE IF EXISTS `policies`;
CREATE TABLE `policies`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '政策ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `policy_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '政策类型',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `source` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `effective_date` date NULL DEFAULT NULL,
  `expiry_date` date NULL DEFAULT NULL,
  `city` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '杭州',
  `is_active` tinyint(1) NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_type`(`policy_type` ASC) USING BTREE,
  INDEX `idx_city`(`city` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '购房政策表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of policies
-- ----------------------------
INSERT INTO `policies` VALUES (1, '杭州住房限购政策', '限购', '一、杭州住房限购范围：限购区域为上城区、拱墅区、西湖区、滨江区、萧山区、余杭区、临平区、钱塘区、富阳区、临安区范围内。\n\n二、杭州住房限购条件：\n1. 杭州户籍：单身可购买1套，已婚家庭可购买2套。\n2. 非杭州户籍：需提供在杭州连续缴纳12个月以上个人所得税或社会保险证明，可购买1套。', '杭州市住房保障和房产管理局', '2024-01-01', NULL, '杭州', 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');
INSERT INTO `policies` VALUES (2, '杭州住房信贷政策', '贷款', '一、住房公积金贷款政策：\n1. 首套房公积金贷款首付比例不低于20%，二套房首付比例不低于30%。\n2. 公积金贷款最高额度：单人50万元，夫妻双方80万元。\n3. 公积金贷款利率：首套房3.1%，二套房3.575%。\n\n二、商业性住房贷款政策：\n1. 首套房商业贷款首付比例不低于30%，利率不低于LPR减20BP。\n2. 二套房商业贷款首付比例不低于40%，利率不低于LPR加60BP。', '中国人民银行杭州中心支行', '2024-01-01', NULL, '杭州', 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');
INSERT INTO `policies` VALUES (3, '杭州住房公积金政策', '公积金', '一、公积金缴存基数和比例：\n1. 缴存基数上限为杭州市上年度职工月平均工资的3倍。\n2. 缴存比例为5%-12%。\n\n二、公积金提取政策：\n1. 购买自住住房可提取公积金用于支付首付或偿还贷款。\n2. 租房可提取公积金支付房租。\n3. 离退休可一次性提取公积金账户余额。', '杭州住房公积金管理中心', '2024-01-01', NULL, '杭州', 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');
INSERT INTO `policies` VALUES (4, '杭州购房税费政策', '税费', '一、契税：\n1. 首套房90㎡及以下1%，90㎡以上1.5%。\n2. 二套房90㎡及以下1%，90㎡以上2%。\n3. 三套房及以上3%。\n\n二、维修基金：\n1. 多层住宅55元/㎡。\n2. 高层住宅65元/㎡。\n\n三、物业费：\n根据物业公司和小区不同，一般为2-6元/㎡·月。', '国家税务总局杭州市税务局', '2024-01-01', NULL, '杭州', 1, '2026-06-17 12:59:43', '2026-06-17 12:59:43');

-- ----------------------------
-- Table structure for price_history
-- ----------------------------
DROP TABLE IF EXISTS `price_history`;
CREATE TABLE `price_history`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `property_id` int NOT NULL,
  `price_per_sqm` decimal(10, 2) NULL DEFAULT NULL,
  `record_date` date NOT NULL,
  `note` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NULL DEFAULT (now()),
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `property_id`(`property_id` ASC) USING BTREE,
  INDEX `ix_price_history_id`(`id` ASC) USING BTREE,
  CONSTRAINT `price_history_ibfk_1` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of price_history
-- ----------------------------

-- ----------------------------
-- Table structure for properties
-- ----------------------------
DROP TABLE IF EXISTS `properties`;
CREATE TABLE `properties`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `district_id` int NOT NULL,
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `owner_id` int NULL DEFAULT NULL,
  `developer` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `property_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `price_per_sqm` decimal(10, 2) NULL DEFAULT NULL,
  `total_price_min` decimal(15, 2) NULL DEFAULT NULL,
  `total_price_max` decimal(15, 2) NULL DEFAULT NULL,
  `area_min` decimal(8, 2) NULL DEFAULT NULL,
  `area_max` decimal(8, 2) NULL DEFAULT NULL,
  `building_area` decimal(15, 2) NULL DEFAULT NULL,
  `land_area` decimal(15, 2) NULL DEFAULT NULL,
  `plot_ratio` decimal(5, 2) NULL DEFAULT NULL,
  `green_rate` decimal(5, 2) NULL DEFAULT NULL,
  `total_households` int NULL DEFAULT NULL,
  `parking_ratio` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `property_company` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `property_fee` decimal(8, 2) NULL DEFAULT NULL,
  `delivery_date` date NULL DEFAULT NULL,
  `decoration_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `school_district` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `metro_distance` int NULL DEFAULT NULL,
  `metro_line` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `tags` json NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `is_featured` tinyint(1) NULL DEFAULT NULL,
  `sort_order` int NULL DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NULL DEFAULT (now()),
  `province` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `city` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `district_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `district_id`(`district_id` ASC) USING BTREE,
  INDEX `owner_id`(`owner_id` ASC) USING BTREE,
  INDEX `ix_properties_id`(`id` ASC) USING BTREE,
  INDEX `ix_properties_region`(`province` ASC, `city` ASC, `district_name` ASC) USING BTREE,
  CONSTRAINT `properties_ibfk_1` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `properties_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of properties
-- ----------------------------

-- ----------------------------
-- Table structure for property_facilities
-- ----------------------------
DROP TABLE IF EXISTS `property_facilities`;
CREATE TABLE `property_facilities`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `property_id` int NOT NULL,
  `facility_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `distance` int NULL DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `sort_order` int NULL DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NULL DEFAULT (now()),
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `property_id`(`property_id` ASC) USING BTREE,
  INDEX `ix_property_facilities_id`(`id` ASC) USING BTREE,
  CONSTRAINT `property_facilities_ibfk_1` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of property_facilities
-- ----------------------------

-- ----------------------------
-- Table structure for property_images
-- ----------------------------
DROP TABLE IF EXISTS `property_images`;
CREATE TABLE `property_images`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `property_id` int NOT NULL,
  `image_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `image_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `sort_order` int NULL DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NULL DEFAULT (now()),
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `property_id`(`property_id` ASC) USING BTREE,
  INDEX `ix_property_images_id`(`id` ASC) USING BTREE,
  CONSTRAINT `property_images_ibfk_1` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of property_images
-- ----------------------------

-- ----------------------------
-- Table structure for property_risks
-- ----------------------------
DROP TABLE IF EXISTS `property_risks`;
CREATE TABLE `property_risks`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `property_id` int NOT NULL,
  `risk_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `distance` int NULL DEFAULT NULL,
  `impact_level` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  `updated_at` datetime NULL DEFAULT (now()),
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `property_id`(`property_id` ASC) USING BTREE,
  INDEX `ix_property_risks_id`(`id` ASC) USING BTREE,
  CONSTRAINT `property_risks_ibfk_1` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of property_risks
-- ----------------------------

-- ----------------------------
-- Table structure for system_configs
-- ----------------------------
DROP TABLE IF EXISTS `system_configs`;
CREATE TABLE `system_configs`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `config_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `config_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `description` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `config_group` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `config_key`(`config_key` ASC) USING BTREE,
  INDEX `idx_key`(`config_key` ASC) USING BTREE,
  INDEX `idx_group`(`config_group` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 46 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '系统配置表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of system_configs
-- ----------------------------
INSERT INTO `system_configs` VALUES (1, 'site_name', 'HouseCodex-Agent', '网站名称', 'basic', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (2, 'site_description', '智能房产咨询Agent', '网站描述', 'basic', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (3, 'loan_rate_first', '0.038', '首套房贷款利率(%)', 'finance', '2026-06-17 12:58:33', '2026-06-19 20:18:42');
INSERT INTO `system_configs` VALUES (4, 'loan_rate_second', '0.044', '二套房贷款利率(%)', 'finance', '2026-06-17 12:58:33', '2026-06-19 20:18:42');
INSERT INTO `system_configs` VALUES (5, 'provident_fund_rate', '0.031', '公积金贷款利率(%)', 'finance', '2026-06-17 12:58:33', '2026-06-19 20:18:42');
INSERT INTO `system_configs` VALUES (6, 'max_provident_fund', '80', '公积金最高贷款额度(万)', 'finance', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (8, '稳赚不赔', '{\"word\": \"稳赚不赔\", \"action\": \"block\", \"replacement\": \"投资有风险\", \"category\": \"promissory\"}', '合规敏感词', 'compliance_words', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (9, '零风险', '{\"word\": \"零风险\", \"action\": \"block\", \"replacement\": \"投资有风险\", \"category\": \"promissory\"}', '合规敏感词', 'compliance_words', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (10, '不限购', '{\"word\": \"不限购\", \"action\": \"block\", \"replacement\": \"请咨询当地购房政策\", \"category\": \"policy\"}', '合规敏感词', 'compliance_words', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (11, '马上通地铁', '{\"word\": \"马上通地铁\", \"action\": \"block\", \"replacement\": \"周边交通便捷\", \"category\": \"misleading\"}', '合规敏感词', 'compliance_words', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (12, '闭眼买', '{\"word\": \"闭眼买\", \"action\": \"block\", \"replacement\": \"建议实地考察\", \"category\": \"promissory\"}', '合规敏感词', 'compliance_words', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (13, '内部底价', '{\"word\": \"内部底价\", \"action\": \"block\", \"replacement\": \"市场参考价格\", \"category\": \"misleading\"}', '合规敏感词', 'compliance_words', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (14, '即将涨价', '{\"word\": \"即将涨价\", \"action\": \"block\", \"replacement\": \"价格以实际为准\", \"category\": \"promissory\"}', '合规敏感词', 'compliance_words', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (15, '必涨', '{\"word\": \"必涨\", \"action\": \"block\", \"replacement\": \"市场有波动\", \"category\": \"promissory\"}', '合规敏感词', 'compliance_words', '2026-06-17 12:58:33', '2026-06-17 12:58:33');
INSERT INTO `system_configs` VALUES (16, '马上入手', '{\"word\": \"马上入手\", \"action\": \"block\", \"replacement\": null, \"category\": \"sensitive\"}', '合规敏感词: 马上入手', 'compliance_words', '2026-06-19 00:34:38', '2026-06-19 00:34:38');
INSERT INTO `system_configs` VALUES (17, 'down_payment_ratio_min', '0.3', '首付最低比例', 'finance', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (18, 'max_loan_term', '30', '最长贷款年限', 'finance', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (19, 'deed_tax_first_small', '0.01', '首套 90㎡ 以下契税 1%', 'tax', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (20, 'deed_tax_first_large', '0.015', '首套 90㎡ 以上契税 1.5%', 'tax', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (21, 'deed_tax_second_small', '0.01', '二套 90㎡ 以下契税 1%', 'tax', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (22, 'deed_tax_second_large', '0.02', '二套 90㎡ 以上契税 2%', 'tax', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (23, 'vat_rate_short', '0.053', '未满 2 年增值税 5.3%', 'tax', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (24, 'income_tax_rate', '0.01', '个税 1%', 'tax', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (25, '_placeholder', '{\"__note__\": \"合规敏感词由 main.py 初始化\"}', '占位说明', 'compliance_words', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (26, 'default_llm_provider', 'siliconflow', '默认 LLM 服务商', 'ai_model', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (27, 'primary_model', 'deepseek-v3', '主模型', 'ai_model', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (28, 'fallback_model', 'qwen2.5-72b', '备用降级模型', 'ai_model', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (29, 'llm_temperature', '0.7', '默认 temperature', 'ai_model', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (30, 'llm_max_tokens', '4096', '单次回复最大 token', 'ai_model', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (31, 'similarity_threshold', '0.7', '向量检索相似度阈值', 'ai_model', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (32, 'session_ttl', '7200', '会话缓存 TTL（秒）', 'redis', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (33, 'cache_ttl_property', '300', '楼盘缓存 TTL（秒）', 'redis', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (34, 'sms_rate_limit_per_hour', '5', '单手机号每小时短信发送上限', 'redis', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (35, 'enable_compliance_check', 'true', '是否启用合规敏感词过滤', 'business', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (36, 'enable_fact_checker', 'true', '是否启用 FactChecker 防幻觉节点', 'business', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (37, 'default_city', '杭州', '默认城市', 'business', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (38, 'max_property_recommendations', '5', '推荐楼盘最大数量', 'business', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (39, 'sms_provider', '容联云', '短信服务商', 'notification', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (40, 'verification_code_ttl', '300', '验证码 TTL（秒）', 'notification', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (41, 'max_conversation_messages', '20', '短期记忆最大消息条数', 'agent', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (42, 'enable_tool_logging', 'true', '是否记录工具调用', 'agent', '2026-06-19 12:04:29', '2026-06-19 12:04:29');
INSERT INTO `system_configs` VALUES (43, '一定升值', '{\"word\": \"一定升值\", \"action\": \"block\", \"replacement\": null, \"category\": \"sensitive\"}', '合规敏感词: 一定升值', 'compliance_words', '2026-06-20 23:16:49', '2026-06-20 23:16:49');
INSERT INTO `system_configs` VALUES (45, '马上入手啊', '{\"word\": \"马上入手啊\", \"action\": \"block\", \"replacement\": null, \"category\": \"sensitive\"}', '合规敏感词: 马上入手啊', 'compliance_words', '2026-06-23 21:37:16', '2026-06-23 21:37:16');

-- ----------------------------
-- Table structure for units
-- ----------------------------
DROP TABLE IF EXISTS `units`;
CREATE TABLE `units`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '房间ID',
  `building_id` int NOT NULL COMMENT 'FK → buildings.id',
  `house_type_id` int NOT NULL COMMENT 'FK → house_types.id',
  `room_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '房间号',
  `floor` int NULL DEFAULT NULL COMMENT '所在楼层',
  `area` decimal(8, 2) NULL DEFAULT NULL COMMENT '实际面积(㎡)',
  `total_price` decimal(15, 2) NULL DEFAULT NULL COMMENT '实际售价(万元)',
  `orientation` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '朝向',
  `status_tag` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '在售' COMMENT '主状态标签',
  `tags` json NULL COMMENT '灵活标签数组',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '备注',
  `sort_order` int NULL DEFAULT 0 COMMENT '排序',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_building`(`building_id` ASC) USING BTREE,
  INDEX `idx_house_type`(`house_type_id` ASC) USING BTREE,
  INDEX `idx_status_tag`(`status_tag` ASC) USING BTREE,
  INDEX `idx_floor`(`floor` ASC) USING BTREE,
  INDEX `idx_total_price`(`total_price` ASC) USING BTREE,
  INDEX `idx_room_number`(`room_number` ASC) USING BTREE,
  CONSTRAINT `fk_units_building` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_units_house_type` FOREIGN KEY (`house_type_id`) REFERENCES `house_types` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '房间/房源表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of units
-- ----------------------------
INSERT INTO `units` VALUES (1, 1, 1, '1', 1, 1.00, NULL, NULL, '在售', 'null', NULL, 0, '2026-06-24 11:26:59', '2026-06-24 11:26:59');

-- ----------------------------
-- Table structure for user_preferences
-- ----------------------------
DROP TABLE IF EXISTS `user_preferences`;
CREATE TABLE `user_preferences`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `budget_min` decimal(15, 2) NULL DEFAULT NULL COMMENT '最低预算(万)',
  `budget_max` decimal(15, 2) NULL DEFAULT NULL COMMENT '最高预算(万)',
  `preferred_districts` json NULL COMMENT '偏好区域',
  `preferred_house_types` json NULL COMMENT '偏好户型',
  `need_school` tinyint(1) NULL DEFAULT NULL COMMENT '是否需要学区',
  `need_metro` tinyint(1) NULL DEFAULT NULL COMMENT '是否需要地铁',
  `has_provident_fund` tinyint(1) NULL DEFAULT NULL COMMENT '是否有公积金',
  `family_members` int NULL DEFAULT NULL COMMENT '家庭人数',
  `is_first_home` tinyint(1) NULL DEFAULT NULL COMMENT '是否首套房',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
  CONSTRAINT `user_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户偏好表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of user_preferences
-- ----------------------------

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '用户名',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '邮箱',
  `hashed_password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `full_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `is_admin` tinyint(1) NULL DEFAULT 0,
  `role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'user' COMMENT '角色',
  `company_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `wechat` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `username`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email`(`email` ASC) USING BTREE,
  INDEX `idx_username`(`username` ASC) USING BTREE,
  INDEX `idx_email`(`email` ASC) USING BTREE,
  INDEX `ix_users_role`(`role` ASC) USING BTREE,
  INDEX `ix_users_is_admin`(`is_admin` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO `users` VALUES (1, 'admin', 'admin@housecodex.com', '$2b$12$owbt9R6OFC5.Kv6T06kpAO2ofTPPUSbGlaHUDMuwZwgrO.uyEbkQ6', '系统管理员', NULL, NULL, 1, 1, 'admin', NULL, '2026-06-17 12:58:33', '2026-06-18 23:31:26', NULL, NULL);

-- ----------------------------
-- Table structure for viewing_plans
-- ----------------------------
DROP TABLE IF EXISTS `viewing_plans`;
CREATE TABLE `viewing_plans`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '计划ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `community_ids` json NULL COMMENT '小区/楼盘ID列表',
  `unit_ids` json NULL COMMENT '关联房间ID列表',
  `plan_date` date NULL DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'pending' COMMENT '状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE,
  CONSTRAINT `viewing_plans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户看房计划表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of viewing_plans
-- ----------------------------

SET FOREIGN_KEY_CHECKS = 1;
