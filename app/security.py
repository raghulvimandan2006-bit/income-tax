import re
import os
from pathlib import Path
from typing import Tuple
from fastapi import HTTPException, UploadFile, status

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
PDF_MAGIC_BYTES = b"%PDF"

def sanitize_filename(filename: str) -> str:
    """
    Remove path traversal sequences and unsafe characters from filenames.
    """
    basename = os.path.basename(filename)
    clean_name = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', basename)
    return clean_name.strip()

def validate_pdf_upload(file: UploadFile, content: bytes) -> Tuple[bool, str]:
    """
    Validate uploaded file format, magic bytes, and size.
    """
    filename = file.filename or "unknown.pdf"
    
    # 1. Extension check
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Only PDF documents (.pdf) are allowed. Got '{filename}'."
        )

    # 2. Size check
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of 50MB. (Uploaded: {len(content) / (1024*1024):.2f}MB)"
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    # 3. Magic bytes check
    if not content.startswith(PDF_MAGIC_BYTES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match a valid PDF signature (%PDF)."
        )

    return True, sanitize_filename(filename)

def sanitize_user_query(query: str, max_length: int = 1000) -> str:
    """
    Clean and sanitize incoming user questions.
    """
    if not query or not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question query cannot be empty."
        )
    
    cleaned = query.strip()
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned

def mask_api_key(key: str) -> str:
    """
    Mask API keys for safe logging (e.g. AIzaSy...1Hi8).
    """
    if not key or len(key) < 8:
        return "****"
    return f"{key[:6]}...{key[-4:]}"
