"""FastAPI 入口。

启动命令：
    uvicorn main:app --reload --port 8000

启动顺序：
    1. 创建所有 ORM 表（``Base.metadata.create_all``）。
    2. 执行 ``run_migrations``（补齐 created_at / 索引 / 缺失表）。
    3. lifespan 启动：
        a. 默认账号（admin/test/landlord）；
        b. 调用 ``init_configs.init_seed_configs`` 写入 system_configs 默认配置；
        c. 加载内存敏感词缓存；
        d. 初始化 ChromaDB VectorStore（只写元数据）；
        e. 注入 ChatCache / Redis 兜底。
"""
from __future__ import annotations

import json
import os
import sys
from contextlib import asynccontextmanager

# 保证在 IDE / 测试环境下也能加载 .env
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config.config import load_env_file

load_env_file()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── 路由 ──
from routers.auth import router as auth_router
from routers.chat import router as chat_router
from routers.landlord import router as landlord_router
from routers.admin import router as admin_router
from routers.favorites import router as favorites_router
from routers.settings import router as settings_router

# ── 数据库 & 模型 ──
from config.database import engine, Base, SessionLocal
from config.migrate import run_migrations

from models.user import User  # noqa: F401
from models.property import (  # noqa: F401
    Property, HouseType, PropertyImage, PropertyFacility, PropertyRisk,
    PriceHistory, Policy, KnowledgeDoc, FAQ, Conversation, Message,
    Favorite, ViewingPlan, OperationLog, SystemConfig, UserPreference,
)
from models.contact_message import ContactMessage  # noqa: F401


# 一次性建表 + 迁移
Base.metadata.create_all(bind=engine)
run_migrations()


# ── lifespan ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    """服务器生命周期：启动初始化 + 关闭清理。"""
    print("[LIFE] server starting…")

    # 默认账号
    _ensure_default_users()

    # system_configs 默认配置
    try:
        from init_configs import init_seed_configs
        init_seed_configs(verbose=True)
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] init_seed_configs 失败: {e}")

    # 全国行政区划 seed（幂等）。Cascader 三段下拉依赖该表数据。
    try:
        from init_districts_seed import REGIONS as _DIST_REGIONS
        from models.property import District as _District
        from sqlalchemy.orm import Session as _Session
        _seed_db = SessionLocal()
        seeded = 0
        skipped = 0
        try:
            for _prov, payload in _DIST_REGIONS.items():
                main_city = payload["city"]
                for d_name in payload["districts"]:
                    full_path = f"{_prov}/{main_city}/{d_name}"
                    if _seed_db.query(_District).filter(
                        _District.city == main_city, _District.name == d_name,
                    ).first():
                        skipped += 1
                        continue
                    _seed_db.add(_District(
                        name=d_name, city=main_city, level=3,
                        full_path=full_path, is_active=True,
                    ))
                    seeded += 1
                for c, ds in payload.get("extra_cities", {}).items():
                    for d_name in ds:
                        full_path = f"{_prov}/{c}/{d_name}"
                        if _seed_db.query(_District).filter(
                            _District.city == c, _District.name == d_name,
                        ).first():
                            skipped += 1
                            continue
                        _seed_db.add(_District(
                            name=d_name, city=c, level=3,
                            full_path=full_path, is_active=True,
                        ))
                        seeded += 1
            _seed_db.commit()
            print(f"[OK] 全国行政区划 seed 完成：新增 {seeded} 条，跳过 {skipped} 条")
        except Exception as exc:
            _seed_db.rollback()
            print(f"[WARN] 全国区划 seed 失败: {exc}")
        finally:
            _seed_db.close()
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] 启动全国区划 seed 模块失败: {e}")

    # 合规敏感词 → 内存
    try:
        from agents.blacklist import init_sensitive_words_from_db
        init_sensitive_words_from_db(SessionLocal)
        print("[OK] 合规敏感词已加载到内存")
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] 初始化合规敏感词失败: {e}")

    # ChromaDB VectorStore（只写入元数据；不存在则降级）
    try:
        from knowledge.vector_store import get_vector_store
        vs = get_vector_store()
        print(f"[OK] VectorStore 初始化完成: {vs.stats()}")
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] VectorStore 初始化失败: {e}")

    # ChatCache 初始化（Redis → 内存降级）
    try:
        from knowledge.chat_cache import chat_cache
        if chat_cache.client:
            print(f"[OK] Redis 缓存已连接: {os.getenv('REDIS_URL')}")
        else:
            print("[OK] Redis 不可用，聊天缓存使用内存降级")
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] ChatCache 初始化失败: {e}")

    print("[LIFE] server ready.")
    yield
    print("[LIFE] server shutting down…")


def _resolve_seed_password(role: str) -> str:
    """从环境变量获取种子账号密码，禁止源码字面量。

    优先级（高 → 低）：
      1. ``ADMIN_SEED_PASSWORD`` 或 ``LANDLORD_SEED_PASSWORD`` / ``USER_SEED_PASSWORD``；
      2. ``HOUSE_CODEX_ENV=development`` 时回退到 dev 默认值。

    非 dev 模式下若缺少任意 env，则 ``RuntimeError`` 直接阻断启动。
    """
    from config.config import get_env, IS_DEV
    env_key = {
        "admin": "ADMIN_SEED_PASSWORD",
        "landlord": "LANDLORD_SEED_PASSWORD",
        "user": "USER_SEED_PASSWORD",
    }.get(role)
    explicit = get_env(env_key) if env_key else None
    if explicit:
        return explicit
    if IS_DEV:
        print(f"[DEV] {role} 种子账号密码未在 env 中显式提供，使用 dev 默认值（不要用于生产）")
        return "admin123"
    raise RuntimeError(
        f"[FATAL] 缺少必需种子账号密码 {env_key}。"
        f"请在 backend/.env 中显式设置，或导出 HOUSE_CODEX_ENV=development 进入开发模式。"
    )


def _ensure_default_users() -> None:
    """确保默认账号（admin/test/landlord）存在；密码来自环境变量。"""
    from config.security import get_password_hash
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin_pwd = _resolve_seed_password("admin")
            db.add(User(
                username="admin", email="admin@housecodex.com",
                hashed_password=get_password_hash(admin_pwd),
                full_name="系统管理员", is_active=True, is_admin=True, role="admin",
            ))
            db.commit()
            print(f"[OK] 默认管理员账号已创建: admin/<from env>")

        for username, role, full, company in (
            ("test", "user", "测试用户", None),
            ("landlord", "landlord", "张房东", "绿城房产"),
        ):
            if not db.query(User).filter(User.username == username).first():
                pwd = _resolve_seed_password(role)
                params = dict(
                    username=username,
                    email=f"{username}@housecodex.com",
                    hashed_password=get_password_hash(pwd),
                    full_name=full,
                    is_active=True,
                    is_admin=False,
                    role=role,
                )
                if company:
                    params["company_name"] = company
                db.add(User(**params))
                db.commit()
                print(f"[OK] 默认{role}账号已创建: {username}/<from env>")
    except Exception as e:  # noqa: BLE001
        print(f"[WARN] 创建默认账号失败: {e}")
        db.rollback()
    finally:
        db.close()


# ── FastAPI 实例 ──
app = FastAPI(
    title="HouseCodex-Agent 房产智能咨询系统",
    description="基于 LangGraph 多智能体协作的房产咨询平台",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS：开发环境允许所有来源；生产环境应该收敛到具体域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth_router, prefix="/api/auth", tags=["认证"])
app.include_router(chat_router, prefix="/api/chat", tags=["聊天"])
app.include_router(landlord_router, prefix="/api/landlord", tags=["房东"])
app.include_router(admin_router, prefix="/api/admin", tags=["后台管理"])
app.include_router(favorites_router, prefix="/api", tags=["收藏与看房计划"])
app.include_router(settings_router, prefix="/api", tags=["设置与偏好"])


@app.get("/")
async def root():
    return {
        "message": "HouseCodex-Agent 房产智能咨询 API",
        "version": "1.0.0",
        "endpoints": ["/docs", "/health", "/api"],
    }


@app.get("/health")
async def health_check():
    """健康检查。"""
    from sqlalchemy import text
    db_status = "down"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:  # noqa: BLE001
        pass
    return {
        "status": "healthy",
        "components": {"mysql": db_status},
    }


if __name__ == "__main__":
    import uvicorn
    from config.config import get_env
    uvicorn.run(
        "main:app",
        host=get_env("API_HOST", "0.0.0.0") or "0.0.0.0",
        port=int(get_env("API_PORT", "8000") or "8000"),
        reload=True,
    )
