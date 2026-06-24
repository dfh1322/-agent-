"""Initialize ChromaDB knowledge base with policies and FAQs from database."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import SessionLocal
from models.property import Policy, FAQ, KnowledgeDoc
from knowledge.vector_store import VectorStore


def index_knowledge_docs():
    """Index all active policies and FAQs into ChromaDB."""
    db = SessionLocal()
    try:
        vector_store = VectorStore()

        # 1. Index policies
        policies = db.query(Policy).filter(Policy.is_active == True).all()
        policy_docs = []
        for p in policies:
            doc_id = f"policy_{p.id}"
            doc_entry = {
                "id": doc_id,
                "content": f"{p.title}\n类型：{p.policy_type}\n内容：{p.content}\n来源：{p.source or '官方'}\n生效日期：{p.effective_date}",
                "metadata": {
                    "doc_type": "policy",
                    "policy_type": p.policy_type,
                    "source": p.source or "官方",
                    "city": p.city or "杭州",
                    "is_active": True,
                    "policy_id": p.id,
                },
            }
            policy_docs.append(doc_entry)

        if policy_docs:
            vector_store.add_documents(policy_docs)
            print(f"✅ Indexed {len(policy_docs)} policies into ChromaDB")

        # 2. Index FAQs
        faqs = db.query(FAQ).filter(FAQ.is_active == True).all()
        faq_docs = []
        for f in faqs:
            doc_id = f"faq_{f.id}"
            doc_entry = {
                "id": doc_id,
                "content": f"问题：{f.question}\n回答：{f.answer}\n分类：{f.category or '通用'}",
                "metadata": {
                    "doc_type": "faq",
                    "category": f.category or "通用",
                    "is_active": True,
                    "faq_id": f.id,
                },
            }
            faq_docs.append(doc_entry)

        if faq_docs:
            vector_store.add_documents(faq_docs)
            print(f"✅ Indexed {len(faq_docs)} FAQs into ChromaDB")

        # 3. Index KnowledgeDocs
        kdocs = db.query(KnowledgeDoc).filter(
            KnowledgeDoc.is_active == True,
            KnowledgeDoc.content.isnot(None),
        ).all()
        kdoc_entries = []
        for kd in kdocs:
            doc_entry = {
                "id": f"kdoc_{kd.id}",
                "content": kd.content,
                "metadata": {
                    "doc_type": kd.doc_type,
                    "source": kd.source or "自定义",
                    "is_active": True,
                    "kdoc_id": kd.id,
                },
            }
            kdoc_entries.append(doc_entry)

        if kdoc_entries:
            vector_store.add_documents(kdoc_entries)
            print(f"✅ Indexed {len(kdoc_entries)} KnowledgeDocs into ChromaDB")

        stats = vector_store.get_stats()
        print(f"\n📊 ChromaDB stats: {stats}")

        # 4. Update vector_id in KnowledgeDoc table
        for kd in kdocs:
            if not kd.vector_id:
                kd.vector_id = f"kdoc_{kd.id}"
        db.commit()

        print("\n🎉 Knowledge base indexing complete!")

    except Exception as e:
        print(f"❌ Error indexing knowledge base: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Initializing Knowledge Base (ChromaDB)")
    print("=" * 60)
    index_knowledge_docs()
