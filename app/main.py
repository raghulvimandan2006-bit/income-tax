import os
import json
import shutil
import logging
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field, model_validator

from app.core.config import settings
from app.security import validate_pdf_upload, sanitize_user_query, mask_api_key
from app.db.pinecone_db import pinecone_manager
from app.rag.pipeline import rag_pipeline
from app.rag.batch_processor import batch_processor
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

    @model_validator(mode="before")
    @classmethod
    def handle_raw_string(cls, data: Any):
        if isinstance(data, str):
            return {"query": data}
        return data

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "What deductions are available under Section 80C of the Indian Income Tax Act, and what is the maximum deduction limit?",
                "tax_year": "AY 2024-25",
                "top_k": 4,
                "threshold": 0.20
            }
        }
    }

class SearchOnlyRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    threshold: Optional[float] = 0.20

    @model_validator(mode="before")
    @classmethod
    def handle_raw_string(cls, data: Any):
        if isinstance(data, str):
            return {"query": data}
        return data

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "Short title and commencement of Income-tax Rules 2026",
                "top_k": 3,
                "threshold": 0.20
            }
        }
    }

class BatchResearchRequest(BaseModel):
    queries: List[str] = Field(..., min_items=1, max_items=20, description="List of Indian Tax questions")
    tax_year: Optional[str] = Field(None, description="Optional Assessment Year")
    top_k: Optional[int] = Field(4, ge=1, le=10)
    threshold: Optional[float] = Field(0.20, ge=0.0, le=1.0)

    model_config = {
        "json_schema_extra": {
            "example": {
                "queries": [
                    "What is the maximum deduction limit under Section 80C?",
                    "When do the Income-tax Rules 2026 come into force?"
                ],
                "tax_year": "AY 2024-25",
                "top_k": 2,
                "threshold": 0.20
            }
        }
    }

class BatchDirectoryRequest(BaseModel):
    directory: Optional[str] = None
    recursive: bool = False

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
@app.get("/health", tags=["System"])
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

async def parse_research_input(request: Request) -> Tuple[str, Optional[str], int, float]:
    """
    Robust universal parser that accepts:
    1. Standard JSON object: {"query": "...", "tax_year": "...", "top_k": 4, "threshold": 0.20}
    2. Raw unquoted plain text string: What deductions are available... (typed in Swagger UI)
    3. JSON quoted string: "What deductions are available..."
    4. Query parameters: ?query=...
    """
    body_bytes = await request.body()
    raw_text = body_bytes.decode("utf-8").strip() if body_bytes else ""

    query = ""
    tax_year = None
    top_k = settings.TOP_K
    threshold = settings.SIMILARITY_THRESHOLD

    if raw_text:
        try:
            data = json.loads(raw_text)
            if isinstance(data, dict):
                query = str(data.get("query") or "")
                tax_year = data.get("tax_year")
                if "top_k" in data and data["top_k"]:
                    top_k = int(data["top_k"])
                if "threshold" in data and data["threshold"] is not None:
                    threshold = float(data["threshold"])
            elif isinstance(data, str):
                query = data
        except Exception:
            # User typed raw unquoted plain text directly in Swagger UI
            query = raw_text.strip('\"\'')

    # Fallback to query params if not found in body
    if not query:
        query = request.query_params.get("query", "")
        if "tax_year" in request.query_params:
            tax_year = request.query_params.get("tax_year")
        if "top_k" in request.query_params:
            top_k = int(request.query_params.get("top_k", top_k))
        if "threshold" in request.query_params:
            threshold = float(request.query_params.get("threshold", threshold))

    if not query or not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question query cannot be empty. Please enter your tax question."
        )

    return query.strip(), tax_year, top_k, threshold

@app.post(
    "/api/research/ask",
    response_model=TaxResearchAnswer,
    tags=["Research"],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Indian Income Tax question to research",
                                "example": "What deductions are available under Section 80C of the Indian Income Tax Act, and what is the maximum deduction limit?"
                            },
                            "tax_year": {
                                "type": "string",
                                "description": "Optional Assessment Year or Financial Year",
                                "example": "AY 2024-25"
                            },
                            "top_k": {"type": "integer", "default": 4, "example": 4},
                            "threshold": {"type": "number", "default": 0.20, "example": 0.20}
                        },
                        "required": ["query"]
                    },
                    "example": {
                        "query": "What deductions are available under Section 80C of the Indian Income Tax Act, and what is the maximum deduction limit?",
                        "tax_year": "AY 2024-25",
                        "top_k": 4,
                        "threshold": 0.20
                    }
                },
                "text/plain": {
                    "schema": {"type": "string"},
                    "example": "What deductions are available under Section 80C of the Indian Income Tax Act, and what is the maximum deduction limit?"
                }
            }
        }
    }
)
async def ask_tax_question(request: Request):
    """
    Primary RAG research endpoint. Accepts a tax question as JSON object or plain text,
    searches indexed official Indian tax documents (Income-tax Rules 2026, Income Tax Act 1961),
    grounds the answer with Gemini, and returns verifiable citations.
    """
    query, tax_year, top_k, threshold = await parse_research_input(request)
    clean_query = sanitize_user_query(query)
    try:
        result = rag_pipeline.research_question(
            query=clean_query,
            tax_year=tax_year,
            top_k=top_k,
            threshold=threshold
        )
        return result
    except Exception as e:
        logger.error(f"Error processing research query '{clean_query}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while researching the query: {str(e)}"
        )

@app.post(
    "/api/research/search",
    tags=["Research"],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query for Indian tax provisions",
                                "example": "Short title and commencement of Income-tax Rules 2026"
                            },
                            "top_k": {"type": "integer", "default": 5, "example": 5},
                            "threshold": {"type": "number", "default": 0.20, "example": 0.20}
                        },
                        "required": ["query"]
                    },
                    "example": {
                        "query": "Short title and commencement of Income-tax Rules 2026",
                        "top_k": 5,
                        "threshold": 0.20
                    }
                },
                "text/plain": {
                    "schema": {"type": "string"},
                    "example": "Short title and commencement of Income-tax Rules 2026"
                }
            }
        }
    }
)
async def search_passages_only(request: Request):
    """
    Retrieve matching official passages from Pinecone without calling the LLM.
    Useful for quick passage verification and inspection.
    """
    query, _, top_k, threshold = await parse_research_input(request)
    clean_query = sanitize_user_query(query)
    results = pinecone_manager.query_similar_chunks(
        query=clean_query,
        top_k=top_k or 5,
        threshold=threshold
    )
    return {
        "query": clean_query,
        "results_count": len(results),
        "passages": results
    }

@app.post("/api/research/batch-ask", tags=["Research"])
def batch_ask_tax_questions(request: BatchResearchRequest):
    """
    Execute batch research across multiple Indian Tax questions.
    Useful for audit checklists, scenario analysis, and compliance verification.
    """
    try:
        sanitized_queries = [sanitize_user_query(q) for q in request.queries if q.strip()]
        result = batch_processor.batch_research_questions(
            queries=sanitized_queries,
            tax_year=request.tax_year,
            top_k=request.top_k,
            threshold=request.threshold
        )
        return result
    except Exception as e:
        logger.error(f"Error executing batch queries: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch query processing failed: {str(e)}"
        )

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

# ----------------- Batch Processing Endpoints -----------------

@app.post("/api/documents/batch-upload", tags=["Batch Processor"])
async def batch_upload_documents(
    files: List[UploadFile] = File(...),
):
    """
    Enterprise batch ingestion endpoint.
    Accepts multiple official Indian tax PDFs, validates formats & sizes,
    stores physical files, extracts text, generates chunk embeddings,
    and indexes all vectors into Pinecone with full error isolation and progress reporting.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided for batch upload."
        )

    if len(files) > settings.MAX_BATCH_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch size limit exceeded. Maximum {settings.MAX_BATCH_FILES} files allowed per batch."
        )

    files_data = []
    saved_files = []

    try:
        for f in files:
            content = await f.read()
            validate_pdf_upload(f, content)

            safe_filename = f.filename or f"doc_{int(time.time())}.pdf"
            file_path = settings.DOCUMENTS_DIR / safe_filename
            
            with open(file_path, "wb") as out_f:
                out_f.write(content)

            saved_files.append(file_path)
            doc_title = file_path.stem.replace("_", " ").title()

            files_data.append({
                "file_path": file_path,
                "title": doc_title,
                "source_url": safe_filename
            })

        batch_summary = batch_processor.process_files_batch(files_data)
        return batch_summary

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fatal error during batch upload: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch upload failed: {str(e)}"
        )

@app.post("/api/documents/batch-process-directory", tags=["Batch Processor"])
def batch_process_directory(request: BatchDirectoryRequest):
    """
    Scan a server directory for PDF documents and ingest them in batch into Pinecone.
    """
    target_dir = Path(request.directory) if request.directory else settings.DOCUMENTS_DIR
    try:
        result = batch_processor.process_directory_batch(
            directory_path=target_dir,
            recursive=request.recursive
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Directory batch processing failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch directory processing error: {str(e)}"
        )

@app.get("/api/documents/batch-jobs", tags=["Batch Processor"])
def list_batch_jobs(limit: int = 20):
    """
    Retrieve historical and active batch ingestion jobs with metrics.
    """
    return batch_processor.list_jobs(limit=limit)

@app.get("/api/documents/batch-jobs/{batch_id}", tags=["Batch Processor"])
def get_batch_job_status(batch_id: str):
    """
    Fetch the execution status, progress, and document breakdown for a specific batch job.
    """
    job = batch_processor.get_job_status(batch_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch job '{batch_id}' not found.")
    return job

@app.post("/api/documents/seed-defaults", tags=["Documents"])
def seed_default_documents():
    """Seed official sample Indian Tax documents into Pinecone."""
    return rag_pipeline.seed_official_tax_data()

# ----------------- Specific Document Endpoints -----------------

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


