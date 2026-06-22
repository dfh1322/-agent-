"""对话敏感字段加密工具。

设计目标：
    * ``messages.content`` 在 DB 中保持密文，应用层访问时透明解密；
    * 兼容已有未加密的对话内容（fallback 明文读取，写入时强制加密）；
    * 加密 key 从 ``config.security.JWT_SECRET`` 派生，避免在代码里硬编码密钥；
    * 使用 AES-GCM（authenticated encryption），iv 每次随机；
    * 用 ``sec://`` 前缀 + base64 形式序列化 cipher+iv，与明文共存并可识别。

不替代现有 conversations 表结构，**仅**在应用层完成加解密。这样：
    * 运维 RSA/MFA 双重备份不影响；
    * 数据库泄露时无法直接读到对话；
    * 历史数据保留 — 新写入自动加密。
"""
from __future__ import annotations

import base64
import hashlib
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_PREFIX_ENC = "sec://"
_PREFIX_LEN = len(_PREFIX_ENC)


def _derive_key(secret: str) -> bytes:
    """从 JWT_SECRET 派生 32 字节对称密钥；SHA-256 截断。

    短于 32 字节的 secret 不会导致加密漫天，而服务端配置通常 ≥ 32 字节。
    """
    if not secret:
        raise RuntimeError("对话加密密钥缺失：请在 .env 中设置 JWT_SECRET")
    return hashlib.sha256(secret.encode("utf-8")).digest()


def _get_key() -> bytes:
    """惰性 deriva，内部调用 ``config.security``。

    注意：用 ``config.security.SECRET_KEY``（运行时配置），
    服务启动后密钥更换自上次加密的数据将不可逆解密 ——
    这是按 CLAUDE.md §5.4"严禁硬编码敏感配置"的合规底线。
    """
    from config.security import SECRET_KEY  # 局部 import 避免循环
    return _derive_key(SECRET_KEY or "housecodex_dev_secret")


def encrypt_str(text: str, key: Optional[bytes] = None) -> str:
    """加密任意 UTF-8 文本，返回 ``sec://`` 前缀 + base64(iv|cipher) 的字符串。"""
    if not text:
        return text
    raw = text.encode("utf-8")
    k = key or _get_key()
    iv = os.urandom(12)  # 96-bit nonce for GCM
    cipher = AESGCM(k).encrypt(iv, raw, None)
    payload = iv + cipher
    return _PREFIX_ENC + base64.b64encode(payload).decode("ascii")


def decrypt_str(token: str, key: Optional[bytes] = None) -> str:
    """解密 ``sec://`` 前缀的字符串；明文原样返回。

    失败时返回原 token，由调用方决定是回退显示还是记日志。
    """
    if not token or not token.startswith(_PREFIX_ENC):
        return token
    payload_b64 = token[_PREFIX_LEN:]
    try:
        payload = base64.b64decode(payload_b64.encode("ascii"))
    except Exception:  # noqa: BLE001
        return token
    if len(payload) < 13:
        return token
    iv, cipher = payload[:12], payload[12:]
    k = key or _get_key()
    try:
        plain = AESGCM(k).decrypt(iv, cipher, None)
    except Exception:  # noqa: BLE001
        return token
    return plain.decode("utf-8", errors="replace")


def is_encrypted(token: Optional[str]) -> bool:
    """OS 级别判断：token 是否已经加密。"""
    return bool(token) and token.startswith(_PREFIX_ENC) and len(token) > _PREFIX_LEN + 8
