"""应用集中式环境配置模块。

提供从 ``.env`` 文件加载环境变量、路径解析和值规范化功能。
项目根目录自动通过 ``__file__`` 向上推导，无需硬编码路径。
"""
from pathlib import Path
import os
from typing import Optional

from dotenv import load_dotenv


# 项目根目录：本文件位于 ``backend/config/config.py``，
# 向上两层得到 ``backend/``，再上一层为项目仓库根 ``housecodex-agent/``。
# ``.env`` 文件按照现有部署位于 ``backend/.env``。
PROJECT_ROOT_BACKEND = Path(__file__).resolve().parent.parent
PROJECT_ROOT = PROJECT_ROOT_BACKEND.parent
ENV_FILE = PROJECT_ROOT_BACKEND / ".env"

# 是否已调用过 load_env_file（避免重复执行）
_LOADED = False


def load_env_file() -> None:
    """在模块加载即可生效的全局 .env 加载入口（惰性、单次）。"""
    global _LOADED
    if _LOADED:
        return
    load_dotenv(ENV_FILE, override=False)
    _LOADED = True


# 默认加载一次；用户也可以显式调用 load_env_file() 让其他模块先 setup。
load_env_file()


# ──────────────────────────────────────────────────────────────────────────
# 运行模式（development 用于本地开发，允许占位凭据；production 硬要求所有
# 密钥必须由环境提供，缺失则启动失败）。
# ──────────────────────────────────────────────────────────────────────────
ENV = (os.getenv("HOUSE_CODEX_ENV") or "production").strip().lower()
IS_DEV = ENV == "development"


def require_env(key: str) -> str:
    """读取必填环境变量；dev 模式退到 ``None`` 之外抛清晰错误。

    非 dev 模式下若变量缺失或为空字符串，立即 ``RuntimeError``。
    """
    value = get_env(key)
    if value:
        return value
    if IS_DEV:
        return ""
    raise RuntimeError(
        f"[FATAL] 缺少必需环境变量 {key}。"
        f"请在 backend/.env 中设置，或显式 HOUSE_CODEX_ENV=development 进入开发模式。"
    )


def get_env(key: str, default: Optional[str] = None) -> Optional[str]:
    """读取并规范化一个环境变量的值。

    处理步骤：
      1. 从系统环境读取原始值；
      2. 去除首尾空白；
      3. 空字符串视为 None；
      4. 去掉外层包裹的单/双引号。

    Args:
        key: 环境变量名称。
        default: 当变量不存在或为空时的默认值。

    Returns:
        规范化后的字符串值。
    """
    value = os.getenv(key, default)
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        value = value[1:-1].strip()
    return value or None

