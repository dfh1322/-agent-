"""数据库连接与会话管理模块。

基于 SQLAlchemy 创建 MySQL 引擎、会话工厂与声明式基类，供 FastAPI 依赖注入使用。
连接串从 ``DATABASE_URL`` 读取，引擎启用了 ``pool_pre_ping`` 与 ``pool_recycle``，
保障长连接场景下的稳定性。
"""
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.engine import Engine

from config.config import get_env, load_env_file


# 在模块加载时确保 .env 文件已被解析
load_env_file()
DATABASE_URL = get_env("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL 未配置，请在 .env 文件中设置 MySQL 连接字符串")

# 创建 SQLAlchemy 引擎
engine: Engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,    # 自动检测并重建失效连接
    pool_recycle=3600,     # MySQL 连接回收时间（秒），防止超时断开
    pool_size=10,          # 连接池基础大小
    max_overflow=20,       # 超出 pool_size 后允许的额外连接数
)

# 会话工厂：每个请求创建独立 Session，无需自动提交/自动 flush
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# 声明式基类：所有 ORM 模型都应继承此类
Base = declarative_base()


def get_db() -> Generator:
    """FastAPI 依赖注入函数：为每个请求提供独立的数据库会话。

    Yields:
        ``sqlalchemy.orm.Session`` 实例。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_simple() -> "SessionLocal":  # pragma: no cover
    """生成一个立即可用的数据库 Session（用于 lifespan / init 脚本）。

    与 ``get_db`` 不同的是，使用方需要自行 ``close()``。
    """
    return SessionLocal()
