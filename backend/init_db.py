# -*- coding: utf-8 -*-
"""初始化 MySQL 数据库种子数据。

用法: python init_db.py
前提:
  1. MySQL 已运行 housecodex 数据库（通过导入 housecodex.sql 创建）
  2. DATABASE_URL 已在 .env 中配置为 MySQL
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from config.database import SessionLocal, engine
from models.user import User
from models.property import Community, Building, HouseType, District, Policy, FAQ, KnowledgeDoc
from config.security import get_password_hash
from datetime import datetime, date


def init_seed_data():
    """插入种子数据（幂等：已存在则跳过）。"""
    db = SessionLocal()
    try:
        # 1. 检查是否已有数据（避免重复初始化）
        if db.query(User).count() > 0:
            print("⚠️ 数据库中已有数据，跳过初始化。如需重新初始化请手动清空相关表。")
            db.close()
            return

        # 创建默认管理员
        admin = User(
            username="admin",
            email="admin@housecodex.com",
            hashed_password=get_password_hash("admin123"),
            full_name="系统管理员",
            is_active=True,
            is_admin=True,
            role="admin",
        )
        db.add(admin)

        # 创建测试用户
        test_user = User(
            username="test",
            email="test@housecodex.com",
            hashed_password=get_password_hash("admin123"),
            full_name="测试用户",
            is_active=True,
            is_admin=False,
            role="user",
        )
        db.add(test_user)

        # 创建房东用户
        landlord = User(
            username="landlord",
            email="landlord@housecodex.com",
            hashed_password=get_password_hash("admin123"),
            full_name="张房东",
            is_active=True,
            is_admin=False,
            role="landlord",
            company_name="绿城房产",
        )
        db.add(landlord)

        db.flush()

        # 创建区域数据
        districts = [
            District(name="西湖区", city="杭州", description="杭州市核心区域，风景优美"),
            District(name="滨江区", city="杭州", description="高新区，互联网产业发达"),
            District(name="上城区", city="杭州", description="老城区，配套成熟"),
            District(name="拱墅区", city="杭州", description="北部区域，发展迅速"),
            District(name="萧山区", city="杭州", description="亚运新城，未来可期"),
            District(name="余杭区", city="杭州", description="未来科技城所在地"),
        ]

        for district in districts:
            db.add(district)

        db.flush()

        # 创建小区数据
        communities = [
            Community(
                name="翡翠华庭",
                district_id=districts[0].id,
                address="西湖区文三路123号",
                developer="绿城集团",
                property_type="住宅",
                price_per_sqm=45000,
                total_price_min=380,
                total_price_max=680,
                area_min=89,
                area_max=140,
                green_rate=35,
                decoration_status="精装修",
                school_district="文三街小学",
                metro_distance=500,
                metro_line="2号线",
                description="位于西湖区核心地段，周边配套齐全，交通便利。小区绿化率高，环境优美，适合改善型购房者。",
                tags=["地铁房", "学区房", "精装修"],
                is_featured=True,
            ),
            Community(
                name="金色阳光",
                district_id=districts[1].id,
                address="滨江区江南大道456号",
                developer="万科地产",
                property_type="住宅",
                price_per_sqm=42000,
                total_price_min=320,
                total_price_max=550,
                area_min=78,
                area_max=128,
                green_rate=30,
                decoration_status="毛坯",
                metro_distance=800,
                metro_line="6号线",
                description="滨江高新区核心位置，毗邻阿里巴巴、网易等互联网巨头。性价比高，适合年轻人首次置业。",
                tags=["地铁房", "刚需盘"],
                is_featured=True,
            ),
            Community(
                name="紫云山庄",
                district_id=districts[2].id,
                address="上城区解放路789号",
                developer="融创中国",
                property_type="住宅",
                price_per_sqm=52000,
                total_price_min=500,
                total_price_max=850,
                area_min=110,
                area_max=180,
                green_rate=40,
                decoration_status="精装修",
                school_district="胜利小学",
                metro_distance=300,
                metro_line="1号线",
                description="上城区高端楼盘，地理位置优越，配套成熟。大户型为主，适合改善型家庭。",
                tags=["地铁房", "学区房", "高端盘"],
                is_featured=True,
            ),
            Community(
                name="锦绣江南",
                district_id=districts[4].id,
                address="萧山区市心北路321号",
                developer="碧桂园",
                property_type="住宅",
                price_per_sqm=32000,
                total_price_min=250,
                total_price_max=450,
                area_min=85,
                area_max=135,
                green_rate=38,
                decoration_status="精装修",
                metro_distance=1200,
                metro_line="5号线",
                description="亚运村板块，未来发展潜力大。价格亲民，适合刚需购房者。",
                tags=["亚运村", "刚需盘"],
                is_featured=False,
            ),
            Community(
                name="湖光山色",
                district_id=districts[3].id,
                address="拱墅区莫干山路654号",
                developer="龙湖地产",
                property_type="住宅",
                price_per_sqm=38000,
                total_price_min=300,
                total_price_max=520,
                area_min=95,
                area_max=138,
                green_rate=42,
                decoration_status="精装修",
                school_district="卖鱼桥小学",
                metro_distance=600,
                metro_line="10号线",
                description="拱墅区优质楼盘，环境优美，周边配套完善。学区优势明显。",
                tags=["地铁房", "学区房"],
                is_featured=False,
            ),
        ]

        for comm in communities:
            db.add(comm)

        db.flush()

        # 为每个小区创建一个楼栋（floor_min/floor_max 从原 Property 迁移到 Building）
        buildings_data = [
            # 翡翠华庭: floor_min=8, floor_max=22
            {"community": communities[0], "name": "1幢", "floor_min": 8, "floor_max": 22,
             "decoration_status": "精装修", "metro_distance": 500},
            # 金色阳光: floor_min=10, floor_max=20
            {"community": communities[1], "name": "1幢", "floor_min": 10, "floor_max": 20,
             "decoration_status": "毛坯", "metro_distance": 800},
            # 紫云山庄: floor_min=15, floor_max=30
            {"community": communities[2], "name": "1幢", "floor_min": 15, "floor_max": 30,
             "decoration_status": "精装修", "metro_distance": 300},
            # 锦绣江南: floor_min=5, floor_max=18
            {"community": communities[3], "name": "1幢", "floor_min": 5, "floor_max": 18,
             "decoration_status": "精装修", "metro_distance": 1200},
            # 湖光山色: floor_min=12, floor_max=28
            {"community": communities[4], "name": "1幢", "floor_min": 12, "floor_max": 28,
             "decoration_status": "精装修", "metro_distance": 600},
        ]

        buildings = []
        for bd in buildings_data:
            building = Building(
                community_id=bd["community"].id,
                name=bd["name"],
                floor_min=bd["floor_min"],
                floor_max=bd["floor_max"],
                decoration_status=bd["decoration_status"],
                metro_distance=bd["metro_distance"],
            )
            db.add(building)
            buildings.append(building)

        db.flush()

        # 创建户型数据（使用 building_id 替代原来的 property_id）
        house_types = [
            HouseType(building_id=buildings[0].id, name="3室2厅2卫", bedrooms=3, living_rooms=2, bathrooms=2, area=89, total_price=380, orientation="南"),
            HouseType(building_id=buildings[0].id, name="4室2厅2卫", bedrooms=4, living_rooms=2, bathrooms=2, area=120, total_price=520, orientation="南"),
            HouseType(building_id=buildings[0].id, name="4室2厅3卫", bedrooms=4, living_rooms=2, bathrooms=3, area=140, total_price=680, orientation="南北"),
            HouseType(building_id=buildings[1].id, name="2室2厅1卫", bedrooms=2, living_rooms=2, bathrooms=1, area=78, total_price=320, orientation="南"),
            HouseType(building_id=buildings[1].id, name="3室2厅2卫", bedrooms=3, living_rooms=2, bathrooms=2, area=98, total_price=420, orientation="南"),
            HouseType(building_id=buildings[1].id, name="3室2厅2卫", bedrooms=3, living_rooms=2, bathrooms=2, area=128, total_price=550, orientation="南北"),
            HouseType(building_id=buildings[2].id, name="3室2厅2卫", bedrooms=3, living_rooms=2, bathrooms=2, area=110, total_price=500, orientation="南"),
            HouseType(building_id=buildings[2].id, name="4室2厅3卫", bedrooms=4, living_rooms=2, bathrooms=3, area=140, total_price=680, orientation="南北"),
            HouseType(building_id=buildings[2].id, name="5室2厅4卫", bedrooms=5, living_rooms=2, bathrooms=4, area=180, total_price=850, orientation="南北"),
            HouseType(building_id=buildings[3].id, name="3室2厅2卫", bedrooms=3, living_rooms=2, bathrooms=2, area=85, total_price=250, orientation="南"),
            HouseType(building_id=buildings[3].id, name="3室2厅2卫", bedrooms=3, living_rooms=2, bathrooms=2, area=108, total_price=340, orientation="南"),
            HouseType(building_id=buildings[3].id, name="4室2厅2卫", bedrooms=4, living_rooms=2, bathrooms=2, area=135, total_price=450, orientation="南北"),
            HouseType(building_id=buildings[4].id, name="3室2厅2卫", bedrooms=3, living_rooms=2, bathrooms=2, area=95, total_price=300, orientation="南"),
            HouseType(building_id=buildings[4].id, name="4室2厅2卫", bedrooms=4, living_rooms=2, bathrooms=2, area=118, total_price=420, orientation="南"),
            HouseType(building_id=buildings[4].id, name="4室2厅3卫", bedrooms=4, living_rooms=2, bathrooms=3, area=138, total_price=520, orientation="南北"),
        ]

        for ht in house_types:
            db.add(ht)

        # 创建政策数据
        policies = [
            Policy(
                title="杭州市住房公积金贷款政策",
                policy_type="公积金",
                content="一、贷款额度\n1. 职工个人最高可贷额度为50万元；\n2. 职工及其配偶均缴存住房公积金的，最高可贷额度为80万元；\n3. 贷款额度不超过购房款总额的80%（二手房为70%）。\n\n二、贷款期限\n1. 最长贷款期限为30年；\n2. 贷款期限可延长至法定退休年龄后5年。\n\n三、贷款利率\n1. 首套房公积金贷款利率：5年以下（含5年）为2.6%，5年以上为3.1%；\n2. 二套房公积金贷款利率：5年以下（含5年）为3.025%，5年以上为3.575%。\n\n四、申请条件\n1. 连续缴存公积金6个月以上；\n2. 具有完全民事行为能力；\n3. 有稳定的经济收入和偿还贷款的能力；\n4. 信用良好。",
                source="杭州市住房公积金管理中心",
                effective_date=date(2024, 1, 1),
                city="杭州",
            ),
            Policy(
                title="杭州市商业性个人住房贷款政策",
                policy_type="商业贷款",
                content="一、首付比例\n1. 首套房：首付比例不低于30%；\n2. 二套房：首付比例不低于40%；\n3. 三套房及以上：暂停发放贷款。\n\n二、贷款利率\n1. 首套房：LPR基点；\n2. 二套房：LPR+60个基点；\n3. 具体利率以银行审批为准。\n\n三、认定标准\n1. 认房又认贷；\n2. 以家庭为单位计算住房套数。\n\n四、贷款期限\n最长贷款期限为30年，且不超过借款人法定退休年龄后5年。",
                source="中国人民银行杭州中心支行",
                effective_date=date(2024, 1, 1),
                city="杭州",
            ),
            Policy(
                title="杭州市住房限购政策",
                policy_type="限购",
                content="一、限购范围\n1. 上城区、下城区、江干区、拱墅区、西湖区、滨江区、钱塘区；\n2. 萧山区、余杭区、临平区、富阳区、临安区部分区域。\n\n二、限购套数\n1. 本市户籍：限购2套；\n2. 非本市户籍：限购1套（需提供连续缴纳社保或个税证明）。\n\n三、购房资格\n1. 本市户籍：提供身份证、户口本；\n2. 非本市户籍：提供连续缴纳社保或个税满12个月证明。\n\n四、限售政策\n新房取得不动产权证后满5年方可交易。",
                source="杭州市住房保障和房产管理局",
                effective_date=date(2024, 1, 1),
                city="杭州",
            ),
            Policy(
                title="杭州市房产交易税费政策",
                policy_type="税费",
                content="一、契税\n1. 首套房：90㎡及以下1%，90㎡以上1.5%；\n2. 二套房：90㎡及以下1%，90㎡以上2%；\n3. 三套房及以上：3%。\n\n二、增值税\n1. 满2年：免征；\n2. 未满2年：全额5.6%。\n\n三、个人所得税\n1. 满5年且唯一：免征；\n2. 其他情况：差额的20%或全额的1%。\n\n四、印花税\n免征。\n\n五、维修基金\n多层住宅：50元/㎡；\n高层住宅：80元/㎡。",
                source="国家税务总局杭州市税务局",
                effective_date=date(2024, 1, 1),
                city="杭州",
            ),
        ]

        for policy in policies:
            db.add(policy)

        # 创建常见问题
        faqs = [
            FAQ(
                question="杭州买房需要什么条件？",
                answer="杭州买房条件如下：\n1. 本市户籍：限购2套；\n2. 非本市户籍：需提供连续缴纳社保或个税满12个月证明，限购1套；\n3. 符合人才政策的可享受特殊购房政策。",
                category="购房政策",
                sort_order=1,
            ),
            FAQ(
                question="公积金贷款和商业贷款可以组合吗？",
                answer="可以的，组合贷款是指同时申请公积金贷款和商业贷款。\n优点：可以享受公积金的低利率，同时贷款额度更高；\n缺点：审批流程相对复杂，办理时间较长。",
                category="贷款",
                sort_order=2,
            ),
            FAQ(
                question="二手房交易需要交哪些税费？",
                answer="二手房交易主要税费：\n1. 契税：买方承担；\n2. 增值税：卖方承担（满2年免征）；\n3. 个人所得税：卖方承担（满5年唯一免征）；\n4. 中介费：买卖双方协商承担。",
                category="税费",
                sort_order=3,
            ),
            FAQ(
                question="什么是认房又认贷？",
                answer="认房又认贷是银行审批贷款时的政策：\n1. 认房：查看借款人家庭在本地的住房套数；\n2. 认贷：查看借款人家庭全国范围内的住房贷款记录；\n3. 只要有房或有贷款记录，都会影响贷款首付比例和利率。",
                category="贷款",
                sort_order=4,
            ),
            FAQ(
                question="杭州的学区房是怎么划分的？",
                answer="杭州学区房划分注意事项：\n1. 每年学区划分可能有调整，请关注教育局最新公告；\n2. 部分学校要求落户年限；\n3. 学区房以房产证为准，与户口相关；\n4. 建议提前1-2年购买学区房。",
                category="学区",
                sort_order=5,
            ),
        ]

        for faq in faqs:
            db.add(faq)

        db.commit()
        print("[OK] 种子数据初始化完成！")
        print("   - 3 个用户 (admin/test/landlord, 密码: admin123)")
        print("   - 6 个区域")
        print("   - 5 个小区")
        print("   - 5 个楼栋")
        print("   - 15 个户型")
        print("   - 4 条政策")
        print("   - 5 条FAQ")

    except Exception as e:
        print(f"[ERROR] 初始化数据库失败: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    init_seed_data()
