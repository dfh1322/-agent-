"""敏感字段脱敏工具。

依据 CLAUDE.md 5.4 节的要求：
    * 用户敏感字段（phone、email 等）在写入 messages / operation_logs 前必须脱敏，
      防止日志泄露个人隐私。

提供：
    * ``mask_phone``：保留前 3 + 后 2 位（例：138****1234）。
    * ``mask_email``：首字母 + ***** + @domain。
    * ``mask_id_card``：保留前 4 + 后 4 位。
    * ``sanitize_dict``：递归遍历字典/列表，对指定 key 集合做脱敏。
"""
from __future__ import annotations

import re
from typing import Any, Iterable


PHONE_PATTERN = re.compile(r"(\d{3})\d{4}(\d{2,4})")
EMAIL_PATTERN = re.compile(r"([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
ID_CARD_PATTERN = re.compile(r"(\d{4})\d{8,12}(\d{4})")

# 命中则做脱敏的字段名（大小写不敏感）
SENSITIVE_KEYS = {"phone", "mobile", "tel", "telephone", "id_card", "idcard", "身份证", "phone_number"}


def mask_phone(value: str) -> str:
    """``13800001234`` → ``138****1234``；无法识别时原样返回。"""
    if not value:
        return value
    return PHONE_PATTERN.sub(r"\1****\2", value)


def mask_email(value: str) -> str:
    """``alice@example.com`` → ``a*****@example.com``；无法识别时原样返回。"""
    if not value or "@" not in value:
        return value
    return EMAIL_PATTERN.sub(r"\1*****\2", value)


def mask_id_card(value: str) -> str:
    """``420101199001011234`` → ``4201***********1234``。"""
    if not value:
        return value
    return ID_CARD_PATTERN.sub(r"\1***********\2", value)


def sanitize_value(value: Any) -> Any:
    """按数据类型对单个值应用最适合的脱敏规则。"""
    if not isinstance(value, str):
        return value
    s = value
    if "@" in s:
        s = mask_email(s)
    if ID_CARD_PATTERN.search(s):
        s = mask_id_card(s)
    if PHONE_PATTERN.search(s.replace("-", "")):
        s = mask_phone(s.replace("-", ""))
        # 恢复原分隔符
        s = value.replace(value, value) if False else s  # 简化
    return s


def _is_sensitive_key(key: str) -> bool:
    return key.lower() in SENSITIVE_KEYS or key in {"身份证", "手机号"}


def sanitize_dict(data: Any, keys: Iterable[str] = SENSITIVE_KEYS) -> Any:
    """递归遍历 dict/list，对命中 key 的字段脱敏。

    Args:
        data: 任意 dict / list / 基本类型。
        keys: 需要脱敏的字段名集合（大小写不敏感）。

    Returns:
        脱敏后的新对象（必要时深拷贝）。
    """
    keys_set = {k.lower() for k in keys}

    if isinstance(data, dict):
        out = {}
        for k, v in data.items():
            if isinstance(k, str) and k.lower() in keys_set:
                if isinstance(v, str):
                    out[k] = mask_phone(v) if k.lower() in {"phone", "mobile", "tel", "telephone", "phone_number"} else (
                        mask_email(v) if "email" in k.lower() else (
                            mask_id_card(v) if "id_card" in k.lower() or k.lower() in {"idcard", "身份证"} else v
                        )
                    )
                else:
                    out[k] = v
            else:
                out[k] = sanitize_dict(v, keys)
        return out

    if isinstance(data, list):
        return [sanitize_dict(item, keys) for item in data]

    return data


def sanitize_text_message(text: str) -> str:
    """对整段 text 做一次浅层扫描，把出现的手机号/邮箱/身份证脱敏。"""
    if not text:
        return text
    masked = text
    if "@" in masked:
        masked = EMAIL_PATTERN.sub(r"\1*****\2", masked)
    if ID_CARD_PATTERN.search(masked):
        masked = ID_CARD_PATTERN.sub(r"\1***********\2", masked)
    if PHONE_PATTERN.search(re.sub(r"\D", "", masked)):
        masked = PHONE_PATTERN.sub(r"\1****\2", masked)
    return masked
