import os
import re
import hashlib
from typing import Dict, List, Any, Optional
from pathlib import Path
import fitz  # PyMuPDF

class DocumentPage:
    def __init__(self, page_number: int, text: str, is_scanned: bool = False, detected_sections: List[str] = None, detected_years: List[str] = None):
        self.page_number = page_number
        self.text = text
        self.is_scanned = is_scanned
        self.detected_sections = detected_sections or []
        self.detected_years = detected_years or []

class TaxDataLoader:
    """
    Extracts text, metadata, and tax provisions page-by-page from Indian tax PDFs using PyMuPDF.
    """
    
    # Common Indian Income Tax Section & Year patterns
    SECTION_REGEX = re.compile(
        r'\b(?:Section|Sec\.?|u/s|under section)\s+([0-9]{1,3}[A-Z]*(?:\([0-9a-zA-Z]+\))*)\b',
        re.IGNORECASE
    )
    YEAR_REGEX = re.compile(
        r'\b(?:A\.?Y\.?|Assessment Year|F\.?Y\.?|Financial Year)\s*[:\-]?\s*([0-9]{4}\s*[-–]\s*[0-9]{2,4})\b',
        re.IGNORECASE
    )

    @staticmethod
    def calculate_file_hash(file_bytes: bytes) -> str:
        """Generate SHA-256 hash to prevent duplicate document ingestion."""
        return hashlib.sha256(file_bytes).hexdigest()

    @staticmethod
    def clean_text(raw_text: str) -> str:
        """
        Normalize whitespace, fix broken hyphenations at line wraps,
        and remove noise from PDF extraction.
        """
        if not raw_text:
            return ""
        
        # Join words split across lines with hyphens (e.g., "infor-\nmation" -> "information")
        text = re.sub(r'(\w+)-\n(\w+)', r'\1\2', raw_text)
        
        # Replace multiple newlines or tabs with a single space or standard newline
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Remove unusual control characters
        text = "".join(ch for ch in text if ch.isprintable() or ch in ('\n', '\t'))
        return text.strip()

    @classmethod
    def extract_tax_metadata(cls, text: str) -> Dict[str, List[str]]:
        """Identify referenced Sections and Assessment/Financial Years."""
        sections = list(set(cls.SECTION_REGEX.findall(text)))
        years = list(set(cls.YEAR_REGEX.findall(text)))
        return {
            "sections": [f"Section {s}" for s in sections[:10]],
            "tax_years": years[:5]
        }

    @classmethod
    def load_pdf(cls, file_path: Path, title: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract text page-by-page using PyMuPDF and detect scanned/empty pages.
        """
        if not file_path.exists():
            raise FileNotFoundError(f"PDF file not found at {file_path}")

        file_bytes = file_path.read_bytes()
        doc_id = cls.calculate_file_hash(file_bytes)[:16]
        doc_title = title or file_path.stem.replace("_", " ").title()

        doc = fitz.open(file_path)
        total_pages = len(doc)
        pages_data: List[DocumentPage] = []
        scanned_pages_count = 0
        all_detected_sections = set()
        all_detected_years = set()

        for page_idx in range(total_pages):
            page_num = page_idx + 1
            page = doc[page_idx]
            raw_text = page.get_text("text")
            cleaned = cls.clean_text(raw_text)

            # A page is likely scanned/image-only if it has less than 40 characters
            is_scanned = len(cleaned) < 40 and len(page.get_images()) > 0
            if is_scanned:
                scanned_pages_count += 1

            meta = cls.extract_tax_metadata(cleaned)
            all_detected_sections.update(meta["sections"])
            all_detected_years.update(meta["tax_years"])

            pages_data.append(DocumentPage(
                page_number=page_num,
                text=cleaned,
                is_scanned=is_scanned,
                detected_sections=meta["sections"],
                detected_years=meta["tax_years"]
            ))

        doc.close()

        ocr_required = scanned_pages_count > (total_pages * 0.4)

        return {
            "document_id": doc_id,
            "title": doc_title,
            "filename": file_path.name,
            "file_size": len(file_bytes),
            "total_pages": total_pages,
            "scanned_pages_count": scanned_pages_count,
            "ocr_required": ocr_required,
            "pages": pages_data,
            "detected_sections": sorted(list(all_detected_sections)),
            "detected_tax_years": sorted(list(all_detected_years)),
            "status": "ready_for_chunking" if not ocr_required else "ocr_required_warning"
        }
