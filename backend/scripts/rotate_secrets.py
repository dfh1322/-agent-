"""rotate_secrets.py — 后端凭据轮换辅助脚本。

目的：协助从旧的真实凭据迁移到新的随机值。本脚本只生成新的
32+ 字节 SECRET_KEY 并打印，本地凭据变更依然需要在控制台手动操作（参见
README 的"安全 - 轮换提醒"段落）。

用法：
    python scripts/rotate_secrets.py           # 仅打印新随机 SECRET_KEY
    python scripts/rotate_secrets.py --write   # 同步写入 backend/.env（本机）
"""
from __future__ import annotations

import argparse
import os
import secrets
import sys
from pathlib import Path


BACKEND_ENV = Path(__file__).resolve().parent.parent / ".env"


def generate_secret_key() -> str:
    """生成 64 字节 URL-safe 随机字符串作为新 JWT 密钥。"""
    return secrets.token_urlsafe(64)


def render_env_block(secret_key: str) -> str:
    """返回更新后的 SECRET_KEY 行（仅此一行）。"""
    return f"SECRET_KEY={secret_key}\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="轮换 HouseCodex-Agent 后端密钥")
    parser.add_argument(
        "--write",
        action="store_true",
        help="将新 SECRET_KEY 同步写入 backend/.env（仅当文件已存在时）",
    )
    args = parser.parse_args()

    new_key = generate_secret_key()
    print("=" * 72)
    print("新 SECRET_KEY（请妥善保管）:")
    print(new_key)
    print("=" * 72)

    if not args.write:
        print("\n[skip] 未传 --write，仅显示。请手动更新 backend/.env。")
        print("其它必轮换项：")
        print("  * SILICONFLOW_API_KEY —— 在 https://cloud.siliconflow.cn/account/ak 重新创建")
        print("  * RONGLIAN_ACCOUNT_SID / AUTH_TOKEN / APP_ID —— 联系容联云商务")
        print("  * MYSQL_PASSWORD —— 见 docker-compose.yml 注释")
        return 0

    if not BACKEND_ENV.exists():
        print(f"[error] {BACKEND_ENV} 不存在；先 cp .env.example .env 再轮换。")
        return 1

    new_content_lines: list[str] = []
    replaced = False
    with BACKEND_ENV.open("r", encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip("\n")
            if line.strip().startswith("SECRET_KEY="):
                new_content_lines.append(render_env_block(new_key).rstrip("\n"))
                replaced = True
            else:
                new_content_lines.append(line)
    if not replaced:
        new_content_lines.append(render_env_block(new_key).rstrip("\n"))
    BACKEND_ENV.write_text("\n".join(new_content_lines) + "\n", encoding="utf-8")
    print(f"[ok] {BACKEND_ENV} 已更新，请重启后端服务。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
