import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings
from app.rag.embedding import embedding_manager

class ChromaDBManager:
    """
    Manages persistent ChromaDB vector store for Indian Tax documents,
    including deduplication, metadata filtering, chunk retrieval, and document lifecycle.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ChromaDBManager, cls).__new__(cls)
            cls._instance._init_db()
        return cls._instance

    def _init_db(self):
        persist_dir = str(settings.CHROMA_PERSIST_DIR)
        self.client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        self.collection_name = "tax_knowledge_base"
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"description": "Official Indian Income Tax Knowledge Base"}
        )
        self.meta_store_path = settings.DATA_DIR / "documents_registry.json"
        self.history_store_path = settings.DATA_DIR / "query_history.json"
        self._init_registry()

    def _init_registry(self):
        if not self.meta_store_path.exists():
            self.meta_store_path.write_text(json.dumps({}, indent=2))
        if not self.history_store_path.exists():
            self.history_store_path.write_text(json.dumps([], indent=2))

    def _load_registry(self) -> Dict[str, Any]:
        try:
            return json.loads(self.meta_store_path.read_text())
        except Exception:
            return {}

    def _save_registry(self, data: Dict[str, Any]):
        self.meta_store_path.write_text(json.dumps(data, indent=2))

    def is_document_ingested(self, document_id: str) -> bool:
        """Check if document already exists to avoid duplicate processing."""
        registry = self._load_registry()
        return document_id in registry

    def register_document(self, doc_meta: Dict[str, Any]):
        registry = self._load_registry()
        registry[doc_meta["document_id"]] = doc_meta
        self._save_registry(registry)

    def list_documents(self) -> List[Dict[str, Any]]:
        registry = self._load_registry()
        return list(registry.values())

    def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        registry = self._load_registry()
        return registry.get(document_id)

    def delete_document(self, document_id: str) -> bool:
        """Delete document from ChromaDB and registry."""
        registry = self._load_registry()
        if document_id not in registry:
            return False

        # Delete chunks from ChromaDB
        try:
            self.collection.delete(where={"document_id": document_id})
        except Exception as e:
            print(f"Notice during ChromaDB chunk deletion: {e}")

        # Delete saved physical PDF if present
        doc_info = registry[document_id]
        if "file_path" in doc_info:
            pdf_path = Path(doc_info["file_path"])
            if pdf_path.exists():
                try:
                    pdf_path.unlink()
                except Exception:
                    pass

        del registry[document_id]
        self._save_registry(registry)
        return True

    def add_chunks(self, chunks: List[Dict[str, Any]], embeddings: List[List[float]]):
        """Add chunks and embeddings into ChromaDB collection."""
        if not chunks:
            return

        ids = [c["chunk_id"] for c in chunks]
        documents = [c["text"] for c in chunks]
        metadatas = [
            {
                "document_id": c["document_id"],
                "document_title": c["document_title"],
                "filename": c["filename"],
                "source_url": c["source_url"],
                "page_number": int(c["page_number"]),
                "detected_sections": str(c["detected_sections"]),
                "detected_tax_years": str(c["detected_tax_years"]),
                "char_count": int(c["char_count"])
            }
            for c in chunks
        ]

        # Chroma batch insertion
        batch_size = 200
        for i in range(0, len(ids), batch_size):
            end = i + batch_size
            self.collection.upsert(
                ids=ids[i:end],
                embeddings=embeddings[i:end],
                documents=documents[i:end],
                metadatas=metadatas[i:end]
            )

    def query_similar_chunks(
        self,
        query: str,
        top_k: int = None,
        threshold: float = None,
        tax_year_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Query ChromaDB by semantic similarity, compute cosine similarity,
        and filter results by relevance score.
        """
        k = top_k or settings.TOP_K
        sim_threshold = threshold if threshold is not None else settings.SIMILARITY_THRESHOLD

        count = self.collection.count()
        if count == 0:
            return []

        query_embedding = embedding_manager.embed_query(query)

        # Retrieve extra candidates to allow post-filtering
        n_results = min(k * 2, count)
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"]
        )

        matched_chunks = []
        if not results or not results["ids"] or not results["ids"][0]:
            return []

        doc_texts = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0]
        chunk_ids = results["ids"][0]

        for i in range(len(chunk_ids)):
            dist = distances[i]
            # ChromaDB default metric is L2 or cosine distance; similarity = 1 - (dist / 2) for cosine or 1 / (1 + dist)
            # For cosine distance (range 0 to 2), similarity is (1 - dist) or normalized
            similarity = max(0.0, 1.0 - (dist / 2.0)) if dist <= 2.0 else max(0.0, 1.0 / (1.0 + dist))

            if similarity < sim_threshold:
                continue

            meta = metas[i]
            matched_chunks.append({
                "chunk_id": chunk_ids[i],
                "text": doc_texts[i],
                "document_id": meta.get("document_id"),
                "document_title": meta.get("document_title"),
                "filename": meta.get("filename"),
                "source_url": meta.get("source_url"),
                "page_number": meta.get("page_number"),
                "detected_sections": meta.get("detected_sections"),
                "detected_tax_years": meta.get("detected_tax_years"),
                "similarity_score": round(similarity, 4),
                "distance": round(dist, 4)
            })

            if len(matched_chunks) >= k:
                break

        return matched_chunks

    def record_query_history(self, record: Dict[str, Any]):
        """Save user question and evidence-grounded answer to history."""
        try:
            history = json.loads(self.history_store_path.read_text())
        except Exception:
            history = []
        
        record["timestamp"] = time.time()
        record["created_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        history.insert(0, record)
        # Keep latest 100 queries
        history = history[:100]
        self.history_store_path.write_text(json.dumps(history, indent=2))

    def get_query_history(self) -> List[Dict[str, Any]]:
        try:
            return json.loads(self.history_store_path.read_text())
        except Exception:
            return []

    def get_statistics(self) -> Dict[str, Any]:
        """Return system statistics for dashboard."""
        registry = self._load_registry()
        total_docs = len(registry)
        total_chunks = self.collection.count()
        total_pages = sum(d.get("total_pages", 0) for d in registry.values())
        history = self.get_query_history()
        return {
            "total_documents": total_docs,
            "total_chunks": total_chunks,
            "total_pages": total_pages,
            "total_queries": len(history),
            "collection_name": self.collection_name,
            "embedding_model": settings.EMBEDDING_MODEL_NAME
        }

chroma_manager = ChromaDBManager()
