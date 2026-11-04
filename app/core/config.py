import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Base Directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

class Settings:
    PROJECT_NAME: str = "TaxLens"
    PROJECT_DESCRIPTION: str = "AI-Powered Indian Tax Research Assistant Using RAG"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # API Keys & Providers
    # Support multiple key alias formats from .env
    GEMINI_API_KEY: str = (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("Gemini api key")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    )
    PINECONE_API_KEY: str = (
        os.getenv("PINECONE_API_KEY")
        or os.getenv("Pinecone api key")
        or ""
    )
    PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "tax-knowledge-base")

    # Models & Fallback Cascade
    DEFAULT_LLM_MODEL: str = os.getenv("DEFAULT_LLM_MODEL", "gemini-3.5-flash")
    FALLBACK_MODELS: List[str] = [
        "gemini-3.5-flash",
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
        "gemini-pro-latest"
    ]
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")

    # Storage Paths
    DATA_DIR: Path = BASE_DIR / "data"
    DOCUMENTS_DIR: Path = BASE_DIR / "data" / "documents"

    # Chunking & Retrieval Parameters
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "600"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "100"))
    TOP_K: int = int(os.getenv("TOP_K", "4"))
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.25"))

    # Batch Processing Parameters
    BATCH_CHUNK_EMBED_SIZE: int = int(os.getenv("BATCH_CHUNK_EMBED_SIZE", "32"))
    BATCH_PINECONE_UPSERT_SIZE: int = int(os.getenv("BATCH_PINECONE_UPSERT_SIZE", "100"))
    MAX_BATCH_FILES: int = int(os.getenv("MAX_BATCH_FILES", "20"))
    BATCH_WORKERS: int = int(os.getenv("BATCH_WORKERS", "4"))

    # Security & Upload Constraints
    MAX_FILE_SIZE_MB: int = 100
    ALLOWED_EXTENSIONS: List[str] = [".pdf"]
    ALLOWED_MIME_TYPES: List[str] = ["application/pdf"]

    def init_directories(self):
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.init_directories()
