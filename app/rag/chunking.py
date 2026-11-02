import re
from typing import List, Dict, Any
from app.core.config import settings

class TaxChunker:
    """
    Splits page-level tax document text into semantically cohesive chunks
    while preserving page numbers, section references, and tax-year context.
    """

    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text cleanly by sentence boundaries."""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def chunk_document(self, doc_data: Dict[str, Any], source_url: str = "") -> List[Dict[str, Any]]:
        """
        Takes the output of TaxDataLoader.load_pdf and returns an array of chunks
        with granular citation metadata.
        """
        chunks: List[Dict[str, Any]] = []
        doc_id = doc_data["document_id"]
        doc_title = doc_data["title"]
        filename = doc_data["filename"]

        chunk_counter = 0

        for page in doc_data["pages"]:
            page_text = page.text
            if not page_text or len(page_text.strip()) < 20:
                continue

            # If page text fits in one chunk, keep it intact
            if len(page_text) <= self.chunk_size:
                chunk_counter += 1
                chunks.append({
                    "chunk_id": f"{doc_id}_p{page.page_number}_c{chunk_counter}",
                    "document_id": doc_id,
                    "document_title": doc_title,
                    "filename": filename,
                    "source_url": source_url or filename,
                    "page_number": page.page_number,
                    "text": page_text,
                    "detected_sections": ", ".join(page.detected_sections) if page.detected_sections else "General Provision",
                    "detected_tax_years": ", ".join(page.detected_years) if page.detected_years else "Unspecified AY/FY",
                    "char_count": len(page_text)
                })
                continue

            # Otherwise, split by sentences with overlap
            sentences = self._split_into_sentences(page_text)
            current_chunk: List[str] = []
            current_len = 0

            for sent in sentences:
                sent_len = len(sent)
                if current_len + sent_len > self.chunk_size and current_chunk:
                    chunk_text = " ".join(current_chunk)
                    chunk_counter += 1
                    
                    # Section extraction specific to this chunk
                    chunk_sections = [
                        s for s in page.detected_sections
                        if re.search(r'\b' + re.escape(s) + r'\b', chunk_text, re.IGNORECASE)
                    ] or page.detected_sections

                    chunks.append({
                        "chunk_id": f"{doc_id}_p{page.page_number}_c{chunk_counter}",
                        "document_id": doc_id,
                        "document_title": doc_title,
                        "filename": filename,
                        "source_url": source_url or filename,
                        "page_number": page.page_number,
                        "text": chunk_text,
                        "detected_sections": ", ".join(chunk_sections) if chunk_sections else "General Provision",
                        "detected_tax_years": ", ".join(page.detected_years) if page.detected_years else "Unspecified AY/FY",
                        "char_count": len(chunk_text)
                    })

                    # Maintain overlap from end of current chunk
                    overlap_chunk = []
                    overlap_len = 0
                    for s in reversed(current_chunk):
                        if overlap_len + len(s) < self.chunk_overlap:
                            overlap_chunk.insert(0, s)
                            overlap_len += len(s)
                        else:
                            break
                    current_chunk = overlap_chunk
                    current_len = overlap_len

                current_chunk.append(sent)
                current_len += sent_len

            # Residual chunk
            if current_chunk:
                chunk_text = " ".join(current_chunk)
                if len(chunk_text.strip()) >= 30:
                    chunk_counter += 1
                    chunks.append({
                        "chunk_id": f"{doc_id}_p{page.page_number}_c{chunk_counter}",
                        "document_id": doc_id,
                        "document_title": doc_title,
                        "filename": filename,
                        "source_url": source_url or filename,
                        "page_number": page.page_number,
                        "text": chunk_text,
                        "detected_sections": ", ".join(page.detected_sections) if page.detected_sections else "General Provision",
                        "detected_tax_years": ", ".join(page.detected_years) if page.detected_years else "Unspecified AY/FY",
                        "char_count": len(chunk_text)
                    })

        return chunks
