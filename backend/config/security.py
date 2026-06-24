"""安全相关工具模块：JWT 令牌签发/验证、密码哈希与校验。

本模块封装了 PyJWT 和 bcrypt 的核心操作，为认证流程提供统一的入口。
密钥、算法和过期时间均从环境变量读取，生产环境务必替换默认值。

主要改进：
    * ``decode_token`` 区分 ``token_expired`` 与 ``token_invalid``，
      前端可以基于此判断是"刷新 token"还是"重新登录"。
"""
from datetime import datetime, timedelta
from typing import Any, Optional, Tuple

from jose import ExpiredSignatureError, JWTError, jwt
import bcrypt

from config.config import get_env, load_env_file, require_env, IS_DEV


# 确保 .env 已加载
load_env_file()


# SECRET_KEY 必须在 production 模式显式提供；dev 模式允许一个本地占位，
# 但要求用户启用 HOUSE_CODEX_ENV=development，避免误部署到生产。
if IS_DEV:
    SECRET_KEY = get_env("SECRET_KEY") or "dev-only-secret-key-do-not-use-in-production"
else:
    SECRET_KEY = require_env("SECRET_KEY")

ALGORITHM = get_env("ALGORITHM", "HS256") or "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(get_env("ACCESS_TOKEN_EXPIRE_MINUTES", "30") or "30")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """使用 bcrypt 校验明文密码与哈希值是否匹配。"""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8'),
    )


def get_password_hash(password: str) -> str:
    """对明文密码进行 bcrypt 哈希（自动生成随机盐）。"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """签发一个 JWT Access Token，包含 ``exp`` 过期时间声明。"""
    to_encode: dict[str, Any] = dict(data)
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Tuple[Optional[dict], Optional[str]]:
    """解码并验证 JWT 令牌。

    Returns:
        (``payload``, ``error_code``)：
            - ``(payload, None)``：解码成功；
            - ``(None, 'token_expired')``：签名合法但已过期；
            - ``(None, 'token_invalid')``：签名错误或格式非法；
            - ``(None, 'token_blacklisted')``：命中 Redis 黑名单。
            - ``(None, None)``：空 token。
    """
    if not token:
        return None, None

    # 检查 Redis 黑名单
    try:
        import redis  # type: ignore
        from config.config import get_env as _get_env
        url = _get_env("REDIS_URL", "redis://localhost:6379/0") or "redis://localhost:6379/0"
        # 强制 RESP2 协议兼容老版本 Redis
        r = redis.from_url(url, decode_responses=True, protocol=2)
        r.ping()
        if r.exists(f"auth:blacklist:{token}"):
            return None, "token_blacklisted"
    except Exception:
        # Redis 不可用时跳过黑名单检查，避免影响主流程
        pass

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload, None
    except ExpiredSignatureError:
        return None, "token_expired"
    except JWTError:
        return None, "token_invalid"
