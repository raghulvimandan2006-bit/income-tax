from typing import List
import numpy as np
from sentence_transformers import SentenceTransformer
from app.core.config import settings

class EmbeddingManager:
    """
    Manages local Sentence Transformers embeddings for ChromaDB ingestion and query retrieval.
    """
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EmbeddingManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if self._model is None:
            # Load SentenceTransformer model (defaults to all-MiniLM-L6-v2)
            self._model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a list of text chunks.
        """
        if not texts:
            return []
        embeddings = self._model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return embeddings.tolist()

    def embed_query(self, query: str) -> List[float]:
        """
        Embed a single user question.
        """
        embedding = self._model.encode(query, convert_to_numpy=True)
        return embedding.tolist()

embedding_manager = EmbeddingManager()
