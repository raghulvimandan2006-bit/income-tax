import os
import json
import time
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

from pinecone import Pinecone, ServerlessSpec
from app.core.config import settings
from app.rag.embedding import embedding_manager

logger = logging.getLogger("TaxLens.Pinecone")

class PineconeDBManager:
    """
    Manages cloud Pinecone vector database for Indian Tax statutory documents,
    including serverless index lifecycle, vector upserts, cosine similarity queries,
    metadata filtering, and document registries.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(PineconeDBManager, cls).__new__(cls)
            cls._instance._init_pinecone()
        return cls._instance

    def _init_pinecone(self):
        self.api_key = settings.PINECONE_API_KEY
        if not self.api_key:
            logger.error("PINECONE_API_KEY is not configured in .env!")
            raise ValueError("Pinecone API key is required. Please set PINECONE_API_KEY in your .env file.")

        self.pc = Pinecone(api_key=self.api_key)
        self.index_name = settings.PINECONE_INDEX_NAME
        self.dimension = 384  # Matches SentenceTransformers all-MiniLM-L6-v2
        self.metric = "cosine"

        self._ensure_index_exists()
        self.index = self.pc.Index(self.index_name)

        # Local registries for document details and history
        self.meta_store_path = settings.DATA_DIR / "pinecone_documents_registry.json"
        self.history_store_path = settings.DATA_DIR / "query_history.json"
        self._init_registry()

    def _ensure_index_exists(self):
        """Verify the Pinecone index exists; if not, provision a serverless index."""
        try:
            existing_indexes = [idx.name for idx in self.pc.list_indexes()]
            if self.index_name not in existing_indexes:
                logger.info(f"Creating Pinecone serverless index '{self.index_name}' (dimension={self.dimension}, metric={self.metric})...")
                self.pc.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric=self.metric,
                    spec=ServerlessSpec(cloud="aws", region="us-east-1")
                )
                # Wait for index readiness
                while not self.pc.describe_index(self.index_name).status["ready"]:
                    time.sleep(1)
                logger.info(f"Pinecone index '{self.index_name}' is ready.")
        except Exception as e:
            logger.error(f"Error checking/creating Pinecone index: {e}")

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
        """Check if document is already indexed in registry."""
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
        """Delete document from Pinecone index and local registry."""
        registry = self._load_registry()
        if document_id not in registry:
            return False

        doc_info = registry[document_id]
        chunk_ids = doc_info.get("chunk_ids", [])

        # Delete vectors in Pinecone
        try:
            if chunk_ids:
                # Delete by explicit chunk IDs
                self.index.delete(ids=chunk_ids)
            else:
                # Fallback to metadata filter delete
                self.index.delete(filter={"document_id": {"$eq": document_id}})
        except Exception as e:
            logger.warning(f"Notice during Pinecone vector deletion: {e}")

        # Delete physical PDF file if present
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
        """
        Upsert vector embeddings and associated statutory metadata into Pinecone.
        """
        if not chunks:
            return

        vectors_to_upsert = []
        for i, chunk in enumerate(chunks):
            # Clean and truncate text for metadata safety (max 30KB)
            text_snippet = chunk["text"]
            if len(text_snippet) > 8000:
                text_snippet = text_snippet[:8000]

            vectors_to_upsert.append({
                "id": chunk["chunk_id"],
                "values": embeddings[i],
                "metadata": {
                    "document_id": chunk["document_id"],
                    "document_title": chunk["document_title"],
                    "filename": chunk["filename"],
                    "source_url": chunk.get("source_url", chunk["filename"]),
                    "page_number": int(chunk["page_number"]),
                    "detected_sections": str(chunk["detected_sections"]),
                    "detected_tax_years": str(chunk["detected_tax_years"]),
                    "char_count": int(chunk["char_count"]),
                    "text": text_snippet
                }
            })

        # Batch upsert in sizes of 100
        batch_size = 100
        for i in range(0, len(vectors_to_upsert), batch_size):
            batch = vectors_to_upsert[i:i + batch_size]
            self.index.upsert(vectors=batch)
            logger.info(f"Upserted {len(batch)} vectors to Pinecone index '{self.index_name}'.")

    def query_similar_chunks(
        self,
        query: str,
        top_k: int = None,
        threshold: float = None,
        tax_year_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Embed user query, execute Pinecone vector search, and return top-k matches above threshold.
        """
        k = top_k or settings.TOP_K
        sim_threshold = threshold if threshold is not None else settings.SIMILARITY_THRESHOLD

        query_embedding = embedding_manager.embed_query(query)

        # Query Pinecone
        query_response = self.index.query(
            vector=query_embedding,
            top_k=k * 2,  # Retrieve slightly more for threshold filtering
            include_metadata=True,
            include_values=False
        )

        matched_chunks = []
        for match in query_response.matches:
            similarity = float(match.score) if match.score is not None else 0.0
            if similarity < sim_threshold:
                continue

            meta = match.metadata or {}
            matched_chunks.append({
                "chunk_id": match.id,
                "text": meta.get("text", ""),
                "document_id": meta.get("document_id"),
                "document_title": meta.get("document_title"),
                "filename": meta.get("filename"),
                "source_url": meta.get("source_url"),
                "page_number": int(meta.get("page_number", 1)),
                "detected_sections": meta.get("detected_sections"),
                "detected_tax_years": meta.get("detected_tax_years"),
                "similarity_score": round(similarity, 4),
                "distance": round(1.0 - similarity, 4)
            })

            if len(matched_chunks) >= k:
                break

        return matched_chunks

    def record_query_history(self, record: Dict[str, Any]):
        """Record user questions and evidence-grounded answers into history log."""
        try:
            history = json.loads(self.history_store_path.read_text())
        except Exception:
            history = []

        record["timestamp"] = time.time()
        record["created_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        history.insert(0, record)
        history = history[:100]
        self.history_store_path.write_text(json.dumps(history, indent=2))

    def get_query_history(self) -> List[Dict[str, Any]]:
        try:
            return json.loads(self.history_store_path.read_text())
        except Exception:
            return []

    def get_statistics(self) -> Dict[str, Any]:
        """Fetch real-time statistics from Pinecone and local registry."""
        registry = self._load_registry()
        total_docs = len(registry)
        total_pages = sum(d.get("total_pages", 0) for d in registry.values())
        history = self.get_query_history()

        # Get vector count directly from Pinecone
        total_vectors = 0
        try:
            stats = self.index.describe_index_stats()
            total_vectors = stats.total_vector_count
        except Exception as e:
            logger.warning(f"Could not fetch Pinecone stats: {e}")
            total_vectors = sum(d.get("total_chunks", 0) for d in registry.values())

        return {
            "total_documents": total_docs,
            "total_chunks": total_vectors,
            "total_pages": total_pages,
            "total_queries": len(history),
            "collection_name": self.index_name,
            "database_type": "Pinecone Serverless (AWS us-east-1)",
            "embedding_model": settings.EMBEDDING_MODEL_NAME
        }

pinecone_manager = PineconeDBManager()
