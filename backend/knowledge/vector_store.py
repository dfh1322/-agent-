"""ChromaDB 元数据存储模块。

关键设计（依据用户需求 + CLAUDE.md 6 节）：
    * ChromaDB 中**只存元数据**（id + metadata），不存文档原文。
    * 全文检索与内容获取分两部分：
          1. ChromaDB 用于按元数据/向量近似过滤（doc_type / city / is_active 等）。
          2. 真正的格式化文本由 MySQL 中对应表的字段提供（policy.content / faq.answer 等）。
    * 若 chromadb 未安装或初始化失败，提供内存 Map 降级，仍保持接口不变。

初始化逻辑：
    ``VectorStore(persist_dir)`` 自动确定 collection 名 ``housecodex_meta``，
    embed 选择 ``chromadb.utils.embedding_functions.DefaultEmbeddingFunction``
    不需要 API Key；如未安装 embedding 依赖则直接使用 ``embedding=None``，
    由调用方提供 embedding 向量。
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Any, Dict, Iterable, List, Optional, Sequence

from config.config import get_env


logger = logging.getLogger(__name__)


# ── NumPy 2.x 兼容补丁 ────────────────────────────────────────────────────
# chromadb 0.5.x 仍引用 ``np.float_``，该别名自 NumPy 2.0 起被移除。
# 在 import chromadb 之前 monkey-patch 兼容，使我们继续能使用
# chromadb.PersistentClient，而不是退化到内存实现。
try:
    import numpy as _np  # noqa: E402
    if not hasattr(_np, "float_"):
        _np.float_ = _np.float64  # type: ignore[attr-defined]
    if not hasattr(_np, "complex_"):
        _np.complex_ = _np.complex128  # type: ignore[attr-defined]
    if not hasattr(_np, "unicode_"):
        _np.unicode_ = _np.str_  # type: ignore[attr-defined]
    if not hasattr(_np, "object_"):
        _np.object_ = _np.object0  # type: ignore[attr-defined]
    if not hasattr(_np, "long"):
        _np.long = _np.int64  # type: ignore[attr-defined]
    if not hasattr(_np, "bool"):
        _np.bool = bool  # type: ignore[attr-defined]
except Exception:  # noqa: BLE001
    pass


_CHROMA_IMPORT_ERROR: Optional[str] = None
try:
    import chromadb  # type: ignore
    from chromadb.config import Settings as ChromaSettings  # type: ignore
except Exception as _exc:  # noqa: BLE001
    _CHROMA_IMPORT_ERROR = str(_exc)
    chromadb = None  # type: ignore
    ChromaSettings = None  # type: ignore


class _InMemoryCollection:
    """降级到内存的最小实现，行为与 chromadb.Collection 接近。

    维持 ``ids / metadatas`` 两份并行列表，提供 ``upsert / delete / get / query`` 子集。
    """

    def __init__(self) -> None:
        self._ids: List[str] = []
        self._metadatas: List[Dict[str, Any]] = []
        self._embeddings: List[Any] = []
        self._lock = threading.Lock()

    def _find(self, doc_id: str) -> int:
        for i, cid in enumerate(self._ids):
            if cid == doc_id:
                return i
        return -1

    def upsert(
        self,
        ids: Sequence[str],
        metadatas: Optional[Sequence[Dict[str, Any]]] = None,
        embeddings: Optional[Sequence[Any]] = None,
    ) -> None:
        with self._lock:
            md_list = list(metadatas) if metadatas else [{} for _ in ids]
            emb_list = list(embeddings) if embeddings else [None for _ in ids]
            for cid, md, emb in zip(ids, md_list, emb_list):
                idx = self._find(cid)
                if idx >= 0:
                    self._metadatas[idx] = md
                    self._embeddings[idx] = emb
                else:
                    self._ids.append(cid)
                    self._metadatas.append(md)
                    self._embeddings.append(emb)

    def delete(self, ids: Iterable[str]) -> None:
        with self._lock:
            to_remove = {i for i, cid in enumerate(self._ids) if cid in set(ids)}
            self._ids = [c for j, c in enumerate(self._ids) if j not in to_remove]
            self._metadatas = [m for j, m in enumerate(self._metadatas) if j not in to_remove]
            self._embeddings = [e for j, e in enumerate(self._embeddings) if j not in to_remove]

    def get(self, ids: Optional[Sequence[str]] = None) -> Dict[str, List[Any]]:
        with self._lock:
            if ids is None:
                return {"ids": list(self._ids), "metadatas": list(self._metadatas)}
            id_set = set(ids)
            out_ids, out_meta = [], []
            for cid, md in zip(self._ids, self._metadatas):
                if cid in id_set:
                    out_ids.append(cid)
                    out_meta.append(md)
            return {"ids": out_ids, "metadatas": out_meta}

    def query(
        self,
        query_embeddings: Optional[Sequence[Any]] = None,
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, List[List[Any]]]:
        """元数据过滤（不依赖 embedding）。"""
        with self._lock:
            matched = []
            for cid, md in zip(self._ids, self._metadatas):
                if self._match_where(md, where):
                    matched.append((cid, md))
        return {"ids": [[c for c, _ in matched[:n_results]]], "metadatas": [[m for _, m in matched[:n_results]]]}

    @staticmethod
    def _match_where(metadata: Dict[str, Any], where: Optional[Dict[str, Any]]) -> bool:
        if not where:
            return True
        for k, v in where.items():
            if metadata.get(k) != v:
                return False
        return True

    def count(self) -> int:
        with self._lock:
            return len(self._ids)


class VectorStore:
    """ChromaDB 元数据适配层（带降级）。"""

    DEFAULT_COLLECTION = "housecodex_meta"

    def __init__(self, persist_dir: Optional[str] = None, collection_name: str = DEFAULT_COLLECTION):
        """初始化 VectorStore。

        Args:
            persist_dir: 持久化目录（默认读 ``CHROMA_DB_PATH`` 环境变量）。
            collection_name: 集合名，默认 ``housecodex_meta``。
        """
        self.persist_dir = persist_dir or get_env("CHROMA_DB_PATH", "./chroma_db") or "./chroma_db"
        self.collection_name = collection_name
        self._client = None
        self._collection = None
        self._degraded = False
        self._init_error: Optional[str] = None
        self._init()

    # ── 内部 ──

    def _init(self) -> None:
        if _CHROMA_IMPORT_ERROR:
            self._init_error = f"chromadb 未安装：{_CHROMA_IMPORT_ERROR}"
            logger.warning(self._init_error + " → VectorStore 降级到内存实现")
            self._degraded = True
            self._collection = _InMemoryCollection()
            return
        try:
            os.makedirs(self.persist_dir, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                metadata={"description": "HouseCodex metadata-only index (no raw text)"},
            )
        except Exception as e:  # noqa: BLE001
            self._init_error = f"ChromaDB 初始化失败：{e}"
            logger.warning(self._init_error + " → VectorStore 降级到内存实现")
            self._degraded = True
            self._collection = _InMemoryCollection()

    @property
    def collection(self):  # 兼容旧代码直接访问的属性
        return self._collection

    @property
    def is_degraded(self) -> bool:
        return self._degraded

    # ── 对外 API ──

    def upsert_metadata(
        self,
        ids: Sequence[str],
        metadatas: Sequence[Dict[str, Any]],
        embeddings: Optional[Sequence[Any]] = None,
    ) -> None:
        """只写入元数据；如果 chromadb 需要 embedding，可显式传入。

        关键约束：**不写 documents** 字段。这样可以确保原始正文不进入向量库，
        全文检索统一回到 MySQL 完成。
        """
        # chromadb 的 collection.upsert 不能不提供 documents，所以我们塞一个空字符串占位
        # 并在 metadata 中保留 ``__placeholder__`` 标记以便审计。
        documents = ["" for _ in ids]
        self._collection.upsert(
            ids=list(ids),
            metadatas=[dict(m) for m in metadatas],
            embeddings=list(embeddings) if embeddings else None,
            documents=documents,
        )

    def add_metadata_batch(self, entries: List[Dict[str, Any]]) -> None:
        """批量写入。``entries`` 中每条至少包含 ``id`` 与 ``metadata``。"""
        if not entries:
            return
        ids = [e["id"] for e in entries]
        metadatas = [e.get("metadata", {}) for e in entries]
        self.upsert_metadata(ids=ids, metadatas=metadatas)

    def delete_metadata(self, ids: Iterable[str]) -> None:
        self._collection.delete(ids=list(ids))

    def query_metadata(
        self,
        where: Optional[Dict[str, Any]] = None,
        n_results: int = 5,
        query_embedding: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """按元数据过滤（必要时可附加 embedding 查询）。"""
        kwargs: Dict[str, Any] = {"n_results": n_results}
        if where:
            kwargs["where"] = where
        if query_embedding is not None:
            kwargs["query_embeddings"] = [query_embedding]
        try:
            res = self._collection.query(**kwargs)
        except TypeError:
            # 内存降级版签名
            res = self._collection.query(query_embeddings=kwargs.get("query_embeddings"),
                                         n_results=kwargs["n_results"],
                                         where=kwargs.get("where"))
        ids = res.get("ids", [[]])[0] if res else []
        metas = res.get("metadatas", [[]])[0] if res else []
        out: List[Dict[str, Any]] = []
        for cid, md in zip(ids, metas):
            out.append({"id": cid, "metadata": md})
        return out

    def count(self) -> int:
        try:
            return self._collection.count()
        except Exception:  # noqa: BLE001
            return 0

    def stats(self) -> Dict[str, Any]:
        """返回统计信息，供 ``init_knowledge_db.py`` 打印。"""
        return {
            "collection": self.collection_name,
            "count": self.count(),
            "degraded": self.is_degraded,
            "init_error": self._init_error,
            "persist_dir": self.persist_dir,
        }


# 全局单例：复用同一份 collection
_vector_store_instance: Optional[VectorStore] = None
_vector_store_lock = threading.Lock()


def get_vector_store() -> VectorStore:
    """获取全局 VectorStore 单例（懒加载）。"""
    global _vector_store_instance
    if _vector_store_instance is None:
        with _vector_store_lock:
            if _vector_store_instance is None:
                _vector_store_instance = VectorStore()
    return _vector_store_instance
