"""
init_districts_seed.py — 全国行政区划 seed。

幂等：已经存在的 (city, district) 跳过；name 与已有同名行冲突时同样跳过。

执行：
    python -m init_districts_seed
"""
from __future__ import annotations

import sys

from config.database import SessionLocal
from models.property import District


# 严格精选：覆盖购房者最常用的城市与每个城市的主城 1-6 个区。
# Province 字典内嵌套 city 字典；每个 city 含若干 district 名。
REGIONS = {
    "北京": {
        "city": "北京",
        "districts": ["东城区", "西城区", "朝阳区", "海淀区", "丰台区", "石景山区", "通州区", "昌平区"],
    },
    "上海": {
        "city": "上海",
        "districts": ["黄浦区", "徐汇区", "长宁区", "静安区", "普陀区", "虹口区", "浦东新区", "闵行区", "宝山区", "松江区"],
    },
    "天津": {
        "city": "天津",
        "districts": ["和平区", "河西区", "南开区", "河北区", "河东区", "滨海新区"],
    },
    "重庆": {
        "city": "重庆",
        "districts": ["渝中区", "江北区", "南岸区", "九龙坡区", "沙坪坝区", "渝北区", "巴南区", "北碚区"],
    },
    "广东": {
        "city": "广州",
        "districts": ["天河区", "越秀区", "海珠区", "荔湾区", "白云区", "黄埔区", "番禺区", "南沙区"],
        "extra_cities": {
            "深圳": ["福田", "罗湖", "南山", "宝安", "龙岗", "龙华", "光明"],
            "佛山": ["禅城", "南海", "顺德"],
            "东莞": ["东城", "南城", "万江"],
        },
    },
    "浙江": {
        "city": "杭州",
        "districts": ["西湖区", "上城区", "拱墅区", "滨江区", "萧山区", "余杭区", "临平区", "钱塘区"],
        "extra_cities": {
            "宁波": ["海曙", "江北", "鄞州", "镇海"],
            "绍兴": ["越城", "柯桥"],
            "温州": ["鹿城", "瓯海"],
            "嘉兴": ["南湖", "秀洲"],
            "金华": ["婺城", "金东"],
        },
    },
    "江苏": {
        "city": "南京",
        "districts": ["鼓楼区", "玄武区", "建邺区", "秦淮区", "栖霞区", "雨花台区", "江宁区", "浦口区"],
        "extra_cities": {
            "苏州": ["姑苏", "工业园区", "高新区", "吴中", "相城"],
            "无锡": ["梁溪", "锡山"],
            "常州": ["天宁", "钟楼"],
            "南通": ["崇川", "通州"],
        },
    },
    "山东": {
        "city": "济南",
        "districts": ["历下区", "市中区", "槐荫区", "天桥区", "高新区", "历城区"],
        "extra_cities": {
            "青岛": ["市南", "市北", "崂山", "李沧", "黄岛"],
            "烟台": ["芝罘", "福山"],
        },
    },
    "福建": {
        "city": "福州",
        "districts": ["鼓楼区", "台江区", "仓山区", "晋安区", "马尾区"],
        "extra_cities": {
            "厦门": ["思明", "湖里", "集美", "海沧"],
            "泉州": ["鲤城", "丰泽"],
        },
    },
    "安徽": {
        "city": "合肥",
        "districts": ["蜀山区", "庐阳区", "包河区", "瑶海区", "高新区"],
        "extra_cities": {"芜湖": ["镜湖", "鸠江"], "蚌埠": ["蚌山", "龙子湖"]},
    },
    "湖北": {
        "city": "武汉",
        "districts": ["江岸区", "江汉区", "硚口区", "汉阳区", "武昌区", "青山区", "洪山区"],
        "extra_cities": {"宜昌": ["西陵", "伍家岗"]},
    },
    "湖南": {
        "city": "长沙",
        "districts": ["芙蓉区", "天心区", "岳麓区", "开福区", "雨花区"],
    },
    "河南": {
        "city": "郑州",
        "districts": ["中原区", "二七区", "管城区", "金水区", "惠济区"],
    },
    "河北": {
        "city": "石家庄",
        "districts": ["长安区", "桥西区", "新华区", "裕华区"],
    },
    "山西": {
        "city": "太原",
        "districts": ["小店区", "迎泽区", "杏花岭区", "万柏林区"],
    },
    "陕西": {
        "city": "西安",
        "districts": ["新城区", "碑林区", "莲湖区", "雁塔区", "未央区", "高新区"],
    },
    "四川": {
        "city": "成都",
        "districts": ["锦江区", "青羊区", "金牛区", "武侯区", "成华区", "高新区"],
        "extra_cities": {"绵阳": ["涪城", "游仙"]},
    },
    "辽宁": {
        "city": "沈阳",
        "districts": ["和平区", "沈河区", "皇姑区", "铁西区", "浑南区"],
    },
    "吉林": {
        "city": "长春",
        "districts": ["南关区", "宽城区", "朝阳区", "二道区", "绿园区"],
    },
    "黑龙江": {
        "city": "哈尔滨",
        "districts": ["道里区", "南岗区", "道外区", "香坊区"],
    },
    "云南": {
        "city": "昆明",
        "districts": ["五华区", "盘龙区", "官渡区", "西山区"],
    },
    "贵州": {
        "city": "贵阳",
        "districts": ["云岩区", "南明区", "观山湖区"],
    },
    "广西": {
        "city": "南宁",
        "districts": ["青秀区", "兴宁区", "江南区", "西乡塘区"],
    },
    "江西": {
        "city": "南昌",
        "districts": ["东湖区", "西湖区", "青云谱区", "青山湖区", "红谷滩区"],
    },
    "海南": {
        "city": "海口",
        "districts": ["秀英区", "龙华区", "琼山区", "美兰区"],
    },
}


def main() -> int:
    """Idempotent seed — 已存在的 ``(city, name)`` 跳过。"""
    db = SessionLocal()
    inserted = 0
    skipped = 0

    try:
        for province, payload in REGIONS.items():
            main_city = payload["city"]
            main_districts = payload["districts"]
            extra_cities = payload.get("extra_cities", {})

            for d_name in main_districts:
                full_path = f"{province}/{main_city}/{d_name}"
                existing = (
                    db.query(District)
                    .filter(District.city == main_city, District.name == d_name)
                    .first()
                )
                if existing:
                    skipped += 1
                    continue
                db.add(District(
                    name=d_name,
                    city=main_city,
                    level=3,
                    full_path=full_path,
                    is_active=True,
                ))
                inserted += 1

            for city, districts in extra_cities.items():
                for d_name in districts:
                    full_path = f"{province}/{city}/{d_name}"
                    existing = (
                        db.query(District)
                        .filter(District.city == city, District.name == d_name)
                        .first()
                    )
                    if existing:
                        skipped += 1
                        continue
                    db.add(District(
                        name=d_name,
                        city=city,
                        level=3,
                        full_path=full_path,
                        is_active=True,
                    ))
                    inserted += 1

        db.commit()
        print(f"[OK] 全国行政区划 seed 完成，新增 {inserted} 条，跳过 {skipped} 条")
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"[ERR] 行政区划 seed 失败：{exc}")
        return 1
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
