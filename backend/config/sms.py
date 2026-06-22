"""短信验证码与容联云发送模块。

改进点（相对旧版）：
    1. 凭证改为从环境变量读取，缺失时使用 mock，避免硬编码（CLAUDE.md 5.4）。
    2. 验证码存储使用 Redis，降级到进程内存，确保分布式部署下也能正确限频。
    3. 增加 ``check_sms_rate_limit``，限制同一手机号的发送频率（防滥用）。
    4. 发送频率阈值由 ``system_configs`` 中的 ``sms_rate_limit_per_hour`` 动态控制。
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import sys
import time
from datetime import datetime
from typing import Dict, Optional

import httpx

from config.config import get_env, load_env_file


# 确保 .env 已加载（其他模块引用前先 setup）
load_env_file()


# 容联云配置（全部从环境变量读取；缺失或为空时一律走 mock，绝不在源码兜底）
ACCOUNT_SID: Optional[str] = os.getenv("RONGLIAN_ACCOUNT_SID") or None
AUTH_TOKEN: Optional[str] = os.getenv("RONGLIAN_AUTH_TOKEN") or None
APP_ID: Optional[str] = os.getenv("RONGLIAN_APP_ID") or None
BASE_URL = os.getenv("RONGLIAN_BASE_URL", "https://app.cloopen.com:8883")
TEMPLATE_ID = os.getenv("RONGLIAN_TEMPLATE_ID", "1")


def _has_real_credentials() -> bool:
    """判定是否配置了真实的容联云凭证。空串 / None 一律视为未配置。"""
    return bool(ACCOUNT_SID) and bool(AUTH_TOKEN) and bool(APP_ID)


def _ensure_ronglian_config() -> None:
    """开发体验保留：未配置凭证时给出明确提示，但不会硬编码兜底凭据。"""
    if not _has_real_credentials():
        _safe_print(
            "[WARN] 容联云凭证未配置（RONGLIAN_ACCOUNT_SID/AUTH_TOKEN/APP_ID），"
            "将自动降级为 mock 模式（仅打印验证码到日志）。"
        )

# 进程内存降级存储（当 Redis 不可用时作为兜底）
_verification_codes: Dict[str, Dict[str, object]] = {}
_sms_rate_counters: Dict[str, list[float]] = {}


def _safe_print(msg: str) -> None:
    """安全打印：过滤 GBK 终端无法编码的字符。"""
    try:
        print(msg)
    except UnicodeEncodeError:
        cleaned = "".join(c for c in msg if ord(c) < 65536)
        sys.stderr.buffer.write((cleaned + "\n").encode("utf-8"))


def _get_redis_client():
    """懒加载 Redis 连接，失败时返回 None；强制 RESP2 协议兼容老版本。"""
    try:
        import redis  # type: ignore
        redis_url = get_env("REDIS_URL", "redis://localhost:6379/0") or "redis://localhost:6379/0"
        client = redis.from_url(redis_url, decode_responses=True, protocol=2)
        client.ping()
        return client
    except Exception as e:  # noqa: BLE001
        _safe_print(f"[WARN] Redis 连接失败，短信模块降级到内存: {e}")
        return None


_REDIS = None


def _redis():
    """获取全局 Redis 客户端（首次调用时建立）。"""
    global _REDIS
    if _REDIS is None:
        _REDIS = _get_redis_client()
    return _REDIS


class SmsRateLimitExceeded(Exception):
    """当手机号发送短信频率超限时抛出。"""

    def __init__(self, phone: str, limit: int, window_seconds: int):
        self.phone = phone
        self.limit = limit
        self.window_seconds = window_seconds
        super().__init__(f"手机号 {phone} 在 {window_seconds} 秒内发送短信超限（上限 {limit} 次）")


# ── 频率限制 ───────────────────────────────────────────────────────────

def _read_rate_limit() -> int:
    """从 ``system_configs.notification.sms_rate_limit_per_hour`` 读取阈值。

    配置缺失或解析失败时，回退到环境变量 ``SMS_RATE_LIMIT_PER_HOUR``，
    再回退到默认 5。该函数不强制连接数据库失败，按安全默认值返回即可。
    """
    # 优先数据库
    try:
        from sqlalchemy import text
        from config.database import engine
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    "SELECT config_value FROM system_configs "
                    "WHERE config_key='sms_rate_limit_per_hour' LIMIT 1"
                )
            ).fetchone()
            if row and row[0]:
                return max(1, int(row[0]))
    except Exception:
        pass
    # 环境变量
    env_val = get_env("SMS_RATE_LIMIT_PER_HOUR")
    if env_val:
        try:
            return max(1, int(env_val))
        except ValueError:
            pass
    return 5


def check_sms_rate_limit(phone: str, window_seconds: int = 3600) -> None:
    """判定该手机号是否触发短信发送频率限制。

    Args:
        phone: 手机号。
        window_seconds: 滑动窗口大小（默认 3600 秒 = 1 小时）。

    Raises:
        SmsRateLimitExceeded: 当窗口内发送次数超限时。
    """
    limit = _read_rate_limit()
    now = time.time()
    client = _redis()
    key = f"sms:rate:{phone}"

    if client is not None:
        try:
            history = client.lrange(key, 0, -1)
            current = [float(x) for x in history if x]
            recent = [t for t in current if now - t <= window_seconds]
            if len(recent) >= limit:
                raise SmsRateLimitExceeded(phone, limit, window_seconds)
            # 记录本次发送
            client.rpush(key, str(now))
            client.expire(key, window_seconds)
            return
        except SmsRateLimitExceeded:
            raise
        except Exception as e:  # noqa: BLE001
            _safe_print(f"[WARN] Redis 频率限制失败，降级到内存: {e}")

    # 内存降级
    counters = _sms_rate_counters.setdefault(phone, [])
    counters[:] = [t for t in counters if now - t <= window_seconds]
    if len(counters) >= limit:
        raise SmsRateLimitExceeded(phone, limit, window_seconds)
    counters.append(now)


# ── 验证码生成 / 存储 / 校验 ─────────────────────────────────────────────

def generate_verification_code(length: int = 4) -> str:
    """生成指定位数的随机数字验证码。"""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


def _ttl() -> int:
    """获取验证码 TTL（秒），默认 300s。"""
    try:
        from sqlalchemy import text
        from config.database import engine
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    "SELECT config_value FROM system_configs "
                    "WHERE config_key='verification_code_ttl' LIMIT 1"
                )
            ).fetchone()
            if row and row[0]:
                return max(60, int(row[0]))
    except Exception:
        pass
    env_val = get_env("VERIFICATION_CODE_TTL")
    if env_val:
        try:
            return max(60, int(env_val))
        except ValueError:
            pass
    return 300


def store_verification_code(phone: str, code: str, ttl: Optional[int] = None) -> None:
    """存储某手机号的验证码，TTL 到期或验证成功后失效。

    优先 Redis，失败降级到进程内存。
    """
    expiry_ts = time.time() + (ttl or _ttl())
    payload = json.dumps({"code": code, "expires_at": expiry_ts}) if False else None  # placeholder

    client = _redis()
    if client is not None:
        try:
            client.setex(f"sms:code:{phone}", ttl or _ttl(), code)
            return
        except Exception as e:  # noqa: BLE001
            _safe_print(f"[WARN] Redis 验证码存储失败，降级到内存: {e}")

    _verification_codes[phone] = {
        "code": code,
        "expires_at": datetime.now().timestamp() + (ttl or _ttl()),
    }


def verify_code(phone: str, code: str) -> bool:
    """校验验证码正确且未过期；校验成功后一次性失效。"""
    client = _redis()
    if client is not None:
        try:
            key = f"sms:code:{phone}"
            stored = client.get(key)
            if stored is None:
                return False
            if stored != code:
                return False
            client.delete(key)
            return True
        except Exception as e:  # noqa: BLE001
            _safe_print(f"[WARN] Redis 校验失败，降级到内存: {e}")

    stored = _verification_codes.get(phone)
    if not stored:
        return False
    if datetime.now().timestamp() > stored["expires_at"]:
        _verification_codes.pop(phone, None)
        return False
    if stored["code"] != code:
        return False
    _verification_codes.pop(phone, None)
    return True


# ── 容联云签名 / 发送 / Mock ────────────────────────────────────────────

def get_timestamp() -> str:
    """返回 14 位时间戳字符串。"""
    return datetime.now().strftime('%Y%m%d%H%M%S')


def get_sig(timestamp: str) -> str:
    """生成容联云请求签名：MD5(SID + AUTH_TOKEN + timestamp)。"""
    if not AUTH_TOKEN:
        # mock 模式，避免使用空凭证算 MD5
        return "MOCK"
    sig_str = f"{ACCOUNT_SID}{AUTH_TOKEN}{timestamp}"
    return hashlib.md5(sig_str.encode('utf-8')).hexdigest().upper()


async def send_sms(phone: str, code: str) -> bool:
    """调用容联云 API 发送模板短信（真实集成路径）。"""
    if not _has_real_credentials():
        _safe_print(f"[MOCK-SMS] 容联云未配置凭证，回落到 mock → {phone} -> {code}")
        return True

    timestamp = get_timestamp()
    sig = get_sig(timestamp)
    # 容联云要求双重鉴权：URL sig + Authorization header
    from base64 import b64encode
    auth_raw = f"{ACCOUNT_SID}:{timestamp}"
    auth_b64 = b64encode(auth_raw.encode('utf-8')).decode('ascii')
    url = f"{BASE_URL}/2013-12-26/Accounts/{ACCOUNT_SID}/SMS/TemplateSMS?sig={sig}"
    headers = {
        'Content-Type': 'application/json;charset=utf-8',
        'Accept': 'application/json',
        'Authorization': auth_b64,
    }
    data = {
        "to": phone,
        "appId": APP_ID,
        "templateId": TEMPLATE_ID,
        "datas": [code, "5"],
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=data)
            result = response.json()
            _safe_print(f"短信发送结果: {result}")
            return result.get('statusCode') == '000000'
    except Exception as e:  # noqa: BLE001
        _safe_print(f"发送短信失败: {e}")
        return False


async def send_mock_sms(phone: str, code: str) -> bool:
    """Mock 发送：直接打印验证码到日志。"""
    _safe_print(f"[MOCK-SMS] → {phone}: {code}")
    return True


async def send_verification_sms(phone: str, code: str) -> bool:
    """统一的发送入口：优先调用真实网关，失败时返回 False。"""
    return await send_sms(phone, code)
