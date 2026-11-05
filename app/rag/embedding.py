from typing import List
from fastembed import TextEmbedding
from app.core.config import settings

class EmbeddingManager:
    """
    Manages lightweight fastembed (ONNX) embeddings for Pinecone vector ingestion and query retrieval.
    Consumes ~70% less memory than PyTorch to run reliably within Render's 512MB free tier limit.
    Produces identical 384-dimensional embeddings for sentence-transformers/all-MiniLM-L6-v2.
    """
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EmbeddingManager, cls).__new__(cls)
        return cls._instance

    @property
    def model(self):
        """Lazy model loader so server binds to port immediately on startup without memory spike."""
        if self._model is None:
            model_name = settings.EMBEDDING_MODEL_NAME
            if not model_name.startswith("sentence-transformers/"):
                model_name = f"sentence-transformers/{model_name}"
            self._model = TextEmbedding(model_name=model_name)
        return self._model

    def embed_texts(self, texts: List[str], batch_size: int = None) -> List[List[float]]:
        """
        Embed a list of text chunks in batches.
        """
        if not texts:
            return []
        effective_batch_size = batch_size or settings.BATCH_CHUNK_EMBED_SIZE
        embeddings = list(self.model.embed(texts, batch_size=effective_batch_size))
        return [e.tolist() for e in embeddings]

    def embed_query(self, query: str) -> List[float]:
        """
        Embed a single user question.
        """
        embeddings = list(self.model.embed([query]))
        return embeddings[0].tolist()

embedding_manager = EmbeddingManager()
