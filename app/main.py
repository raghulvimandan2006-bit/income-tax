import os
import shutil
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.security import validate_pdf_upload, sanitize_user_query, mask_api_key
from app.db.pinecone_db import pinecone_manager
from app.rag.pipeline import rag_pipeline
from app.Ai.llm import TaxResearchAnswer

# Logging setup
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("TaxLens.API")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for local frontend development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Request / Response Models -----------------

class ResearchRequest(BaseModel):
    query: str = Field(..., description="Indian Income Tax question to research")
    tax_year: Optional[str] = Field(None, description="Optional Assessment Year (e.g. 'AY 2024-25') or Financial Year")
    top_k: Optional[int] = Field(4, ge=1, le=10, description="Number of source passages to retrieve")
    threshold: Optional[float] = Field(0.20, ge=0.0, le=1.0, description="Minimum relevance similarity threshold")

class SearchOnlyRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    threshold: Optional[float] = 0.20

# ----------------- Lifecycle & Startup -----------------

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing TaxLens application with Pinecone Vector Database...")
    settings.init_directories()
    # Check if knowledge base is empty; if so, automatically seed essential official tax documents
    docs = pinecone_manager.list_documents()
    if len(docs) == 0:
        logger.info("No documents found in knowledge base. Seeding official sample Indian tax documents into Pinecone...")
        try:
            rag_pipeline.seed_official_tax_data()
            logger.info("Initial official tax documents successfully seeded into Pinecone.")
        except Exception as e:
            logger.error(f"Error during auto-seeding tax documents into Pinecone: {e}")

# ----------------- Health & Statistics Endpoints -----------------

@app.get("/api/health", tags=["System"])
def health_check():
    stats = pinecone_manager.get_statistics()
    return {
        "status": "healthy",
        "app_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "active_model": settings.DEFAULT_LLM_MODEL,
        "database": "Pinecone Serverless (AWS)",
        "pinecone_index": settings.PINECONE_INDEX_NAME,
        "gemini_api_configured": bool(settings.GEMINI_API_KEY),
        "gemini_key_masked": mask_api_key(settings.GEMINI_API_KEY),
        "total_documents": stats["total_documents"],
        "total_chunks": stats["total_chunks"]
    }

@app.get("/api/stats", tags=["System"])
def get_system_stats():
    return pinecone_manager.get_statistics()

# ----------------- Research & Generation Endpoints -----------------

@app.post("/api/research/ask", response_model=TaxResearchAnswer, tags=["Research"])
def ask_tax_question(request: ResearchRequest):
    """
    Primary RAG research endpoint. Accepts a tax question, performs semantic search in Pinecone,
    grounds the answer with Gemini / Fallback Synthesizer, and returns verifiable citations.
    """
    clean_query = sanitize_user_query(request.query)
    try:
        result = rag_pipeline.research_question(
            query=clean_query,
            tax_year=request.tax_year,
            top_k=request.top_k,
            threshold=request.threshold
        )
        return result
    except Exception as e:
        logger.error(f"Error processing research query '{clean_query}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while researching the query: {str(e)}"
        )

@app.post("/api/research/search", tags=["Research"])
def search_passages_only(request: SearchOnlyRequest):
    """
    Retrieve matching official passages from Pinecone without calling the LLM.
    Useful for quick passage verification and inspection.
    """
    clean_query = sanitize_user_query(request.query)
    results = pinecone_manager.query_similar_chunks(
        query=clean_query,
        top_k=request.top_k or 5,
        threshold=request.threshold
    )
    return {
        "query": clean_query,
        "results_count": len(results),
        "passages": results
    }

@app.get("/api/research/history", tags=["Research"])
def get_research_history():
    """Retrieve historical queries and synthesized answers."""
    return pinecone_manager.get_query_history()

# ----------------- Document Management Endpoints -----------------

@app.get("/api/documents", tags=["Documents"])
def list_documents():
    """List all ingested tax documents with metadata and page counts."""
    return pinecone_manager.list_documents()

@app.post("/api/documents/upload", tags=["Documents"])
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    source_url: Optional[str] = Form(None)
):
    """
    Upload official Indian tax PDF, validate headers & size,
    extract pages, generate chunks & embeddings, and index into Pinecone.
    """
    content = await file.read()
    validate_pdf_upload(file, content)

    # Save physical file to documents directory
    safe_filename = file.filename or "uploaded_tax_doc.pdf"
    file_path = settings.DOCUMENTS_DIR / safe_filename
    
    with open(file_path, "wb") as f:
        f.write(content)

    doc_title = title or file_path.stem.replace("_", " ").title()

    try:
        ingestion_result = rag_pipeline.ingest_pdf(
            file_path=file_path,
            title=doc_title,
            source_url=source_url or safe_filename
        )
        return ingestion_result
    except Exception as e:
        logger.error(f"Failed to ingest PDF '{safe_filename}' into Pinecone: {e}", exc_info=True)
        # Clean up file on failure
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest document into Pinecone: {str(e)}"
        )

@app.get("/api/documents/{document_id}", tags=["Documents"])
def get_document(document_id: str):
    """Get metadata for a specific document."""
    doc = pinecone_manager.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc

@app.delete("/api/documents/{document_id}", tags=["Documents"])
def delete_document(document_id: str):
    """Delete a document and all its indexed chunks from Pinecone."""
    deleted = pinecone_manager.delete_document(document_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return {"success": True, "message": f"Document {document_id} and associated vectors deleted from Pinecone."}

@app.post("/api/documents/{document_id}/process", tags=["Documents"])
def reprocess_document(document_id: str):
    """Reprocess an existing document into Pinecone."""
    doc = pinecone_manager.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    file_path = Path(doc["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original physical PDF not found on disk")
    
    # Delete old chunks and re-ingest
    pinecone_manager.delete_document(document_id)
    res = rag_pipeline.ingest_pdf(file_path=file_path, title=doc["title"], source_url=doc.get("source_url"))
    return res

@app.get("/api/documents/{document_id}/file", tags=["Documents"])
def download_document_file(document_id: str):
    """Download/view the original PDF file."""
    doc = pinecone_manager.get_document(document_id)
    if not doc or "file_path" not in doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    
    file_path = Path(doc["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Physical PDF file missing")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=doc["filename"]
    )

@app.post("/api/documents/seed-defaults", tags=["Documents"])
def seed_default_documents():
    """Seed official sample Indian Tax documents into Pinecone."""
    return rag_pipeline.seed_official_tax_data()
