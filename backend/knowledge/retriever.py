"""
RAG 检索器 (AgentRetriever)。

混合向量检索 + SQL 查询, 为 Agent 提供知识库上下文。
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models.property import Policy, FAQ, KnowledgeDoc


def _lexical_similarity(query: str, text: str) -> float:
    """极简的字符级 Jaccard 相似度（0~1）。

    ChromaDB 当前只接受 metadata 写入（见 ``vector_store.py``），不能返回
    cosine similarity。我们用一阶启发式把"查询关键片段与文档共有多少字符"
    转化为 [0,1] 区间的伪相似度。本值仅给 FactChecker 提供一个"低相似度
    应拒绝"的触发信号，不替代真正的向量检索。
    """
    if not query or not text:
        return 0.0
    qset = set(query[:200])
    tset = set(text[:400])
    inter = qset & tset
    union = qset | tset
    if not union:
        return 0.0
    return min(1.0, len(inter) / max(1, len(union)))


class AgentRetriever:
    """
    Agent 知识库检索器。

    功能:
        1. 从 Policy 表检索相关政策
        2. 从 FAQ 表检索常见问题
        3. 从 KnowledgeDoc 表检索向量知识库文档
        4. 综合返回格式化上下文
    """

    def retrieve_all(
        self,
        db: Session,
        query: str,
        top_k: int = 5,
    ) -> Optional[str]:
        """
        综合检索所有知识库来源。

        Args:
            db: 数据库会话。
            query: 用户查询文本。
            top_k: 每个来源最多返回的结果数。

        Returns:
            格式化的知识库上下文字符串, 无结果时返回 None。
        """
        parts = []
        max_similarity = 0.0

        # 1. 政策检索
        policy_result, policy_max = self._search_policies(db, query, top_k, with_score=True)
        if policy_result is not None:
            parts.append(f"【相关政策】\n{policy_result}")
            max_similarity = max(max_similarity, policy_max)

        # 2. FAQ 检索
        faq_result, faq_max = self._search_faqs(db, query, top_k, with_score=True)
        if faq_result is not None:
            parts.append(f"【常见问题】\n{faq_result}")
            max_similarity = max(max_similarity, faq_max)

        # 3. 知识库文档检索
        doc_result, doc_max = self._search_knowledge_docs(db, query, top_k, with_score=True)
        if doc_result is not None:
            parts.append(f"【知识库文档】\n{doc_result}")
            max_similarity = max(max_similarity, doc_max)

        if not parts:
            return None

        # 把 max_similarity 编码进字符串尾部供调用方解析；这是为了在不破坏原有
        # str 接口的同时向 FactChecker 透出"本轮检索最高相似度"。
        encoded = f"<!--max_similarity={max_similarity:.4f}-->\n" + "\n\n".join(parts)
        return encoded

    def _search_policies(self, db: Session, query: str, top_k: int,
                         with_score: bool = False):
        """
        搜索相关政策。
        """
        sim_max = 0.0
        policies = (
            db.query(Policy)
            .filter(Policy.is_active == True)
            .filter(
                Policy.content.contains(query[:10])
                | Policy.title.contains(query[:10])
            )
            .limit(top_k)
            .all()
        )

        if not policies:
            keywords = ["贷款", "限购", "首付", "利率", "公积金", "契税"]
            for kw in keywords:
                if kw in query:
                    policies = (
                        db.query(Policy)
                        .filter(Policy.is_active == True)
                        .filter(Policy.content.contains(kw))
                        .limit(top_k)
                        .all()
                    )
                    if policies:
                        break

        if not policies:
            return (None, 0.0) if with_score else None

        lines = []
        for p in policies:
            snippet = (p.content or "")[:300]
            sim_max = max(sim_max, _lexical_similarity(query, f"{p.title or ''}{snippet}"))
            lines.append(f"- {p.title}: {p.content}")

        text = "\n".join(lines)
        return (text, sim_max) if with_score else text

    def _search_faqs(self, db: Session, query: str, top_k: int,
                      with_score: bool = False):
        search_term = query[:20]
        sim_max = 0.0
        faqs = (
            db.query(FAQ)
            .filter(FAQ.is_active == True)
            .filter(FAQ.question.contains(search_term))
            .limit(top_k)
            .all()
        )

        if not faqs:
            return (None, 0.0) if with_score else None

        lines = []
        for f in faqs:
            sim_max = max(sim_max, _lexical_similarity(query, f"{f.question or ''}{f.answer or ''}"))
            lines.append(f"Q: {f.question}\nA: {f.answer}")
        text = "\n\n".join(lines)
        return (text, sim_max) if with_score else text

    def _search_knowledge_docs(
        self,
        db: Session,
        query: str,
        top_k: int,
        with_score: bool = False,
    ):
        sim_max = 0.0
        docs = (
            db.query(KnowledgeDoc)
            .filter(KnowledgeDoc.is_active == True)
            .filter(
                KnowledgeDoc.title.contains(query[:10])
                | KnowledgeDoc.content.contains(query[:10])
            )
            .limit(top_k)
            .all()
        )

        if not docs:
            return (None, 0.0) if with_score else None

        lines = []
        for doc in docs:
            sim_max = max(sim_max, _lexical_similarity(query, doc.title or ""))
            lines.append(f"【{doc.title}】\n{doc.content[:500]}")
        text = "\n\n".join(lines)
        return (text, sim_max) if with_score else text
