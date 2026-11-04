import os
import time
import uuid
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from pydantic import BaseModel, Field

from app.core.config import settings
from app.rag.pipeline import rag_pipeline
from app.Ai.llm import TaxResearchAnswer

logger = logging.getLogger("TaxLens.BatchProcessor")

class BatchDocumentResult(BaseModel):
    filename: str
    title: str
    status: str  # "success", "skipped_duplicate", "failed"
    message: str
    document_id: Optional[str] = None
    pages: int = 0
    chunks: int = 0
    error: Optional[str] = None

class BatchJobStatus(BaseModel):
    batch_id: str
    status: str  # "pending", "in_progress", "completed", "failed", "partial_success"
    created_at: str
    completed_at: Optional[str] = None
    duration_seconds: float = 0.0
    total_files: int = 0
    processed_files: int = 0
    successful_files: int = 0
    skipped_duplicates: int = 0
    failed_files: int = 0
    total_pages_ingested: int = 0
    total_chunks_indexed: int = 0
    results: List[BatchDocumentResult] = []

class BatchQueryItem(BaseModel):
    query: str
    tax_year: Optional[str] = None

class BatchQueryResponse(BaseModel):
    batch_id: str
    total_queries: int
    successful_queries: int
    duration_seconds: float
    results: List[Dict[str, Any]]

class BatchProcessor:
    """
    Enterprise batch processing engine for TaxLens.
    Manages high-throughput ingestion of multi-document PDF batches,
    isolated error handling, progress monitoring, and concurrent batch RAG inquiries.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(BatchProcessor, cls).__new__(cls)
            cls._instance._init_store()
        return cls._instance

    def _init_store(self):
        self.jobs_store_path = settings.DATA_DIR / "batch_jobs.json"
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._load_jobs()

    def _load_jobs(self):
        if self.jobs_store_path.exists():
            try:
                self._jobs = json.loads(self.jobs_store_path.read_text())
            except Exception as e:
                logger.warning(f"Failed to load batch jobs registry: {e}")
                self._jobs = {}
        else:
            self._save_jobs()

    def _save_jobs(self):
        try:
            # Keep the most recent 100 jobs
            trimmed = dict(list(self._jobs.items())[-100:])
            self.jobs_store_path.write_text(json.dumps(trimmed, indent=2))
        except Exception as e:
            logger.error(f"Error persisting batch jobs: {e}")

    def create_batch_job(self, total_files: int) -> str:
        batch_id = f"batch_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        now = time.strftime("%Y-%m-%d %H:%M:%S")
        self._jobs[batch_id] = {
            "batch_id": batch_id,
            "status": "pending",
            "created_at": now,
            "completed_at": None,
            "duration_seconds": 0.0,
            "total_files": total_files,
            "processed_files": 0,
            "successful_files": 0,
            "skipped_duplicates": 0,
            "failed_files": 0,
            "total_pages_ingested": 0,
            "total_chunks_indexed": 0,
            "results": []
        }
        self._save_jobs()
        return batch_id

    def get_job_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        return self._jobs.get(batch_id)

    def list_jobs(self, limit: int = 20) -> List[Dict[str, Any]]:
        return list(reversed(list(self._jobs.values())))[:limit]

    def process_files_batch(
        self,
        files_data: List[Dict[str, Any]],  # List of {"file_path": Path, "title": str, "source_url": str}
        batch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process multiple tax PDF files in batch with isolated error handling and progress metrics.
        """
        if not files_data:
            return {"error": "No files provided for batch processing"}

        if not batch_id:
            batch_id = self.create_batch_job(len(files_data))

        job = self._jobs[batch_id]
        job["status"] = "in_progress"
        start_time = time.time()

        logger.info(f"Starting batch job {batch_id} with {len(files_data)} documents...")

        # Process each document sequentially with error isolation to prevent embedding memory pressure
        for item in files_data:
            file_path: Path = item["file_path"]
            title: str = item.get("title") or file_path.stem.replace("_", " ").title()
            source_url: str = item.get("source_url") or file_path.name
            filename = file_path.name

            try:
                ingest_res = rag_pipeline.ingest_pdf(
                    file_path=file_path,
                    title=title,
                    source_url=source_url
                )

                if ingest_res.get("already_exists"):
                    doc_info = ingest_res.get("document", {})
                    doc_res = {
                        "filename": filename,
                        "title": title,
                        "status": "skipped_duplicate",
                        "message": ingest_res.get("message", "Document already indexed"),
                        "document_id": doc_info.get("document_id"),
                        "pages": doc_info.get("total_pages", 0),
                        "chunks": doc_info.get("total_chunks", 0),
                        "error": None
                    }
                    job["skipped_duplicates"] += 1
                elif ingest_res.get("success"):
                    doc_meta = ingest_res.get("document", {})
                    pages = doc_meta.get("total_pages", 0)
                    chunks = doc_meta.get("total_chunks", 0)
                    doc_res = {
                        "filename": filename,
                        "title": title,
                        "status": "success",
                        "message": ingest_res.get("message", "Successfully indexed into Pinecone"),
                        "document_id": doc_meta.get("document_id"),
                        "pages": pages,
                        "chunks": chunks,
                        "error": None
                    }
                    job["successful_files"] += 1
                    job["total_pages_ingested"] += pages
                    job["total_chunks_indexed"] += chunks
                else:
                    doc_res = {
                        "filename": filename,
                        "title": title,
                        "status": "failed",
                        "message": ingest_res.get("message", "Processing failed"),
                        "document_id": None,
                        "pages": 0,
                        "chunks": 0,
                        "error": ingest_res.get("message")
                    }
                    job["failed_files"] += 1

            except Exception as e:
                logger.error(f"Error processing file '{filename}' in batch {batch_id}: {e}", exc_info=True)
                doc_res = {
                    "filename": filename,
                    "title": title,
                    "status": "failed",
                    "message": f"Processing exception: {str(e)}",
                    "document_id": None,
                    "pages": 0,
                    "chunks": 0,
                    "error": str(e)
                }
                job["failed_files"] += 1

            job["results"].append(doc_res)
            job["processed_files"] += 1
            # Periodically update persistence
            self._save_jobs()

        elapsed = round(time.time() - start_time, 2)
        job["duration_seconds"] = elapsed
        job["completed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")

        # Determine overall status
        if job["failed_files"] == 0:
            job["status"] = "completed"
        elif job["successful_files"] > 0 or job["skipped_duplicates"] > 0:
            job["status"] = "partial_success"
        else:
            job["status"] = "failed"

        self._save_jobs()
        logger.info(
            f"Batch {batch_id} finished in {elapsed}s: "
            f"{job['successful_files']} succeeded, {job['skipped_duplicates']} skipped, {job['failed_files']} failed."
        )
        return job

    def process_directory_batch(self, directory_path: Path, recursive: bool = False) -> Dict[str, Any]:
        """
        Scan a directory on disk, discover all PDF files, and execute batch ingestion.
        """
        if not directory_path.exists() or not directory_path.is_dir():
            raise FileNotFoundError(f"Directory not found: {directory_path}")

        pattern = "**/*.pdf" if recursive else "*.pdf"
        pdf_paths = sorted(list(directory_path.glob(pattern)))

        if not pdf_paths:
            return {
                "message": f"No PDF documents found in {directory_path}",
                "total_files": 0,
                "batch_id": None
            }

        files_data = [
            {
                "file_path": p,
                "title": p.stem.replace("_", " ").title(),
                "source_url": p.name
            }
            for p in pdf_paths
        ]

        batch_id = self.create_batch_job(len(files_data))
        return self.process_files_batch(files_data, batch_id=batch_id)

    def batch_research_questions(
        self,
        queries: List[str],
        tax_year: Optional[str] = None,
        top_k: Optional[int] = None,
        threshold: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Execute RAG research across an automated batch of tax queries (e.g., audit checklists).
        """
        batch_id = f"batch_query_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        start_time = time.time()
        results = []
        successful = 0

        for q in queries:
            q_clean = q.strip()
            if not q_clean:
                continue
            try:
                ans: TaxResearchAnswer = rag_pipeline.research_question(
                    query=q_clean,
                    tax_year=tax_year,
                    top_k=top_k,
                    threshold=threshold
                )
                results.append({
                    "query": q_clean,
                    "answer": ans.answer,
                    "citations": [c.model_dump() for c in ans.citations],
                    "confidence_level": ans.confidence_level,
                    "model_name": ans.model_name,
                    "success": True
                })
                successful += 1
            except Exception as e:
                logger.error(f"Error researching batch query '{q_clean}': {e}")
                results.append({
                    "query": q_clean,
                    "answer": f"Error researching query: {str(e)}",
                    "citations": [],
                    "confidence_level": "None",
                    "model_name": "Error",
                    "success": False
                })

        duration = round(time.time() - start_time, 2)
        return {
            "batch_id": batch_id,
            "total_queries": len(queries),
            "successful_queries": successful,
            "duration_seconds": duration,
            "results": results
        }

batch_processor = BatchProcessor()
