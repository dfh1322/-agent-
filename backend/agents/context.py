"""实时环境上下文：时间、天气等，供 AI 聊天与楼盘匹配使用。

该模块负责：
    1. 调用 Open-Meteo 免费天气 API 获取实时天气数据。
    2. 将天气/时间信息转换为自然语言描述，注入到 LLM 的系统提示中。
    3. 根据天气条件对楼盘列表做轻量级排序（雨天优先近地铁、炎热优先高绿化率等）。
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from models.property import Property

# 中国标准时区 (UTC+8)
CN_TZ = timezone(timedelta(hours=8))

# 国内主要城市的经纬度坐标，用于天气 API 查询
CITY_COORDS = {
    "杭州": (30.25, 120.17),
    "北京": (39.90, 116.40),
    "上海": (31.23, 121.47),
    "深圳": (22.55, 114.05),
    "广州": (23.13, 113.26),
}

# WMO 世界气象组织天气代码 → 中文描述映射
WMO_DESC = {
    0: "晴", 1: "大部晴朗", 2: "局部多云", 3: "多云",
    45: "雾", 48: "雾凇",
    51: "小毛毛雨", 53: "毛毛雨", 55: "大毛毛雨",
    61: "小雨", 63: "中雨", 65: "大雨",
    71: "小雪", 73: "中雪", 75: "大雪",
    80: "小阵雨", 81: "阵雨", 82: "大阵雨",
    95: "雷暴",
}


def _describe_weather(code: Optional[int]) -> str:
    """根据 WMO 天气代码返回中文描述。

    Args:
        code: WMO 天气代码（如 0=晴, 61=小雨）。None 表示获取失败。

    Returns:
        中文天气描述，未知代码返回 "多变"。
    """
    if code is None:
        return "未知"
    return WMO_DESC.get(code, "多变")


def _is_rainy(code: Optional[int]) -> bool:
    """判断天气代码是否代表降雨。

    覆盖毛毛雨 (51-55)、小雨到中雨 (61-65)、阵雨 (80-82) 和雷暴 (95)。

    Args:
        code: WMO 天气代码。

    Returns:
        是否正在下雨。
    """
    if code is None:
        return False
    return code in range(51, 68) or code in (80, 81, 82, 95)


def _is_hot(temp: Optional[float]) -> bool:
    """判断气温是否炎热（>= 30°C）。"""
    return temp is not None and temp >= 30


def _is_cold(temp: Optional[float]) -> bool:
    """判断气温是否寒冷（<= 5°C）。"""
    return temp is not None and temp <= 5


async def fetch_weather(city: str = "杭州") -> Dict[str, Any]:
    """从 Open-Meteo 获取指定城市的实时天气数据。

    使用免费的 Open-Meteo API，无需 API Key。请求当前时刻的温度、
    天气代码、风力及昼夜状态。

    Args:
        city: 城市名，默认为 "杭州"。若传入未知城市则回退到杭州坐标。

    Returns:
        包含以下字段的字典：
            - city: 城市名
            - temp_c: 温度（摄氏度）
            - weather_code: WMO 天气代码
            - weather_desc: 中文天气描述
            - is_day: 是否为白天
            - wind_kmh: 风速（km/h）
            - is_rainy: 是否降雨
            - is_hot: 是否炎热
            - is_cold: 是否寒冷

        若请求异常则返回降级结果（所有数值为 None/False，描述为 "暂不可用"）。
    """
    lat, lon = CITY_COORDS.get(city, CITY_COORDS["杭州"])
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,weather_code,is_day,wind_speed_10m"
        "&timezone=Asia%2FShanghai"
    )
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            current = resp.json().get("current", {})
            code = current.get("weather_code")
            temp = current.get("temperature_2m")
            return {
                "city": city,
                "temp_c": temp,
                "weather_code": code,
                "weather_desc": _describe_weather(code),
                "is_day": current.get("is_day") == 1,
                "wind_kmh": current.get("wind_speed_10m"),
                "is_rainy": _is_rainy(code),
                "is_hot": _is_hot(temp),
                "is_cold": _is_cold(temp),
            }
    except Exception:
        return {
            "city": city,
            "temp_c": None,
            "weather_desc": "暂不可用",
            "is_rainy": False,
            "is_hot": False,
            "is_cold": False,
        }


async def get_environment_context(city: str = "杭州") -> Dict[str, Any]:
    """汇总当前时间与天气信息，生成 LLM 可读的自然语言上下文。

    该函数将天气数据转化为带"匹配建议"的自然语言段落，例如：
        - 雨天 → 建议推荐近地铁、配套完善的楼盘。
        - 炎热 → 建议推荐绿化率高、通风采光好的房源。
        - 寒冷 → 建议推荐有供暖、南向户型的房源。

    Args:
        city: 城市名，默认为 "杭州"。

    Returns:
        包含以下字段的字典：
            - text: 组装好的自然语言描述字符串，可直接插入系统提示。
            - weather: 原始天气数据字典（来自 ``fetch_weather``）。
            - datetime: 当前中国标准时间 ``datetime`` 对象。
    """
    now = datetime.now(CN_TZ)
    weather = await fetch_weather(city)

    weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    time_text = now.strftime(f"%Y年%m月%d日 {weekday_names[now.weekday()]} %H:%M")

    tips = []
    if weather.get("is_rainy"):
        tips.append("雨天出行不便，可优先推荐近地铁、配套完善的楼盘")
    if weather.get("is_hot"):
        tips.append("天气炎热，可关注绿化率高、通风采光好的房源")
    if weather.get("is_cold"):
        tips.append("天气寒冷，可关注供暖、南向户型与室内配套")

    text = f"""【实时环境信息】
当前时间：{time_text}
城市：{weather.get('city', city)}
天气：{weather.get('weather_desc', '未知')}，气温 {weather.get('temp_c', '—')}°C
时段：{'白天' if weather.get('is_day') else '夜间'}"""
    if tips:
        text += "\n匹配建议：" + "；".join(tips)

    return {"text": text, "weather": weather, "datetime": now}


def rank_properties_by_context(
    properties: List[Property],
    env: Dict[str, Any],
) -> List[Property]:
    """结合天气对楼盘列表做轻量排序，优先展示更契合当前环境的房源。

    评分规则（分数越高越靠前）：
        - 雨天且距地铁 <= 800m: +3 分
        - 炎热且绿化率 >= 35%: +2 分
        - 寒冷且装修状态含 "精装": +1 分
        - 楼盘为精选房源: +1 分

    Args:
        properties: 待排序的楼盘列表。
        env: 环境上下文字典，需包含 ``weather`` 子字典（来自 ``get_environment_context``）。

    Returns:
        按综合评分降序排列的新列表。
    """
    weather = env.get("weather", {})

    def score(prop: Property) -> int:
        s = 0
        if weather.get("is_rainy") and prop.metro_distance and prop.metro_distance <= 800:
            s += 3
        if weather.get("is_hot") and prop.green_rate and float(prop.green_rate) >= 35:
            s += 2
        if weather.get("is_cold") and prop.decoration_status and "精装" in prop.decoration_status:
            s += 1
        if prop.is_featured:
            s += 1
        return s

    return sorted(properties, key=score, reverse=True)
