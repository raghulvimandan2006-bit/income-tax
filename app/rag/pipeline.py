import os
import time
import fitz
from pathlib import Path
from typing import Dict, Any, List, Optional

from app.core.config import settings
from app.rag.dataloader import TaxDataLoader
from app.rag.chunking import TaxChunker
from app.rag.embedding import embedding_manager
from app.db.pinecone_db import pinecone_manager
from app.Ai.llm import llm_service, TaxResearchAnswer

class RAGPipeline:
    """
    End-to-end RAG orchestrator for document ingestion, semantic search, and tax research generation
    powered by Pinecone vector database.
    """

    def __init__(self):
        self.chunker = TaxChunker()

    def ingest_pdf(self, file_path: Path, title: Optional[str] = None, source_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Full ingestion pipeline from PDF to Pinecone vector store.
        """
        # Step 1-4: Load PDF & extract page-level text
        doc_data = TaxDataLoader.load_pdf(file_path, title=title)
        doc_id = doc_data["document_id"]

        # Prevent duplicate document ingestion
        if pinecone_manager.is_document_ingested(doc_id):
            existing = pinecone_manager.get_document(doc_id)
            return {
                "success": True,
                "already_exists": True,
                "message": f"Document '{doc_data['title']}' has already been processed and indexed in Pinecone.",
                "document": existing
            }

        # Step 5-8: Chunk text and assign metadata
        chunks = self.chunker.chunk_document(doc_data, source_url=source_url or file_path.name)
        if not chunks:
            return {
                "success": False,
                "already_exists": False,
                "message": "No extractable text found in this PDF (may be completely scanned or empty).",
                "document_id": doc_id
            }

        # Step 9: Generate embeddings using SentenceTransformers
        chunk_texts = [c["text"] for c in chunks]
        embeddings = embedding_manager.embed_texts(chunk_texts)

        # Step 10: Store in Pinecone
        pinecone_manager.add_chunks(chunks, embeddings)

        chunk_ids = [c["chunk_id"] for c in chunks]

        # Register document metadata in registry
        doc_metadata = {
            "document_id": doc_id,
            "title": doc_data["title"],
            "filename": doc_data["filename"],
            "file_size": doc_data["file_size"],
            "file_path": str(file_path),
            "total_pages": doc_data["total_pages"],
            "total_chunks": len(chunks),
            "chunk_ids": chunk_ids,
            "scanned_pages_count": doc_data["scanned_pages_count"],
            "ocr_required": doc_data["ocr_required"],
            "detected_sections": doc_data["detected_sections"],
            "detected_tax_years": doc_data["detected_tax_years"],
            "ingested_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "source_url": source_url or doc_data["filename"],
            "status": "Indexed in Pinecone"
        }
        pinecone_manager.register_document(doc_metadata)

        return {
            "success": True,
            "already_exists": False,
            "message": f"Successfully ingested {doc_data['total_pages']} pages and {len(chunks)} chunks into Pinecone vector database.",
            "document": doc_metadata
        }

    def research_question(
        self,
        query: str,
        tax_year: Optional[str] = None,
        top_k: Optional[int] = None,
        threshold: Optional[float] = None
    ) -> TaxResearchAnswer:
        """
        Execute RAG search and answer generation:
        Query -> Pinecone Vector Search -> Context Assembly -> Gemini Grounded Generation -> History Logging.
        """
        # Step 1: Semantic search in Pinecone
        relevant_chunks = pinecone_manager.query_similar_chunks(
            query=query,
            top_k=top_k or settings.TOP_K,
            threshold=threshold if threshold is not None else settings.SIMILARITY_THRESHOLD,
            tax_year_filter=tax_year
        )

        # Step 2: Generate evidence-grounded answer via LLM
        answer_result = llm_service.generate_grounded_answer(
            query=query,
            contexts=relevant_chunks,
            tax_year=tax_year
        )

        # Step 3: Record query in history
        history_entry = {
            "query": query,
            "tax_year": tax_year or "General / Unspecified",
            "answer": answer_result.answer,
            "citations": [c.model_dump() for c in answer_result.citations],
            "confidence_level": answer_result.confidence_level,
            "model_name": answer_result.model_name,
            "chunks_count": len(relevant_chunks)
        }
        pinecone_manager.record_query_history(history_entry)

        return answer_result

    def seed_official_tax_data(self) -> Dict[str, Any]:
        """
        Creates and ingests official sample Indian Tax PDFs for testing and academic demonstrations
        covering Income Tax Act 1961 provisions (Sec 80C, Sec 115BAC, Sec 10(13A), Sec 24b, Sec 112A).
        """
        official_docs = [
            {
                "filename": "Income_Tax_Act_1961_Key_Provisions.pdf",
                "title": "Income Tax Act, 1961 — Key Statutory Provisions & Deductions",
                "pages": [
                    (
                        "INCOME TAX ACT, 1961\nCHAPTER VI-A: DEDUCTIONS IN RESPECT OF CERTAIN PAYMENTS\n\n"
                        "Section 80C. Deduction in respect of life insurance premia, deferred annuity, contributions to provident fund, subscription to certain equity shares or debentures, etc.\n\n"
                        "(1) In computing the total income of an assessee, being an individual or a Hindu undivided family, there shall be deducted, in accordance with and subject to the provisions of this section, the whole of the amount paid or deposited in the previous year, being the aggregate of the sums specified in sub-section (2), as does not exceed one lakh and fifty thousand rupees.\n\n"
                        "(2) The sums referred to in sub-section (1) shall be any sums paid or deposited in the previous year by the assessee:\n"
                        "(i) to effect or to keep in force an insurance on the life of persons specified in sub-section (4);\n"
                        "(ii) to effect or to keep in force a contract for a deferred annuity;\n"
                        "(iii) by way of contribution to any provident fund to which the Provident Funds Act, 1925 applies, or Public Provident Fund (PPF);\n"
                        "(iv) as tuition fees (excluding any payment towards development fees or donation) to any university, college, school or other educational institution situated within India for full-time education of any two children of such individual;\n"
                        "(v) as principal repayment of any loan borrowed by the assessee for purchase or construction of residential house property.\n\n"
                        "Note: Maximum deduction limit under Section 80C together with Section 80CCC and 80CCD(1) is restricted to Rs. 1,50,000 per financial year for eligible assessees under the Old Tax Regime."
                    ),
                    (
                        "INCOME TAX ACT, 1961\nCHAPTER IV: COMPUTATION OF TOTAL INCOME - SALARIES & HOUSE PROPERTY\n\n"
                        "Section 10(13A). House Rent Allowance (HRA) Exemption.\n"
                        "Any special allowance specifically granted to an assessee by his employer to meet expenditure actually incurred on payment of rent in respect of residential accommodation occupied by the assessee, is exempt from income tax to the extent prescribed under Rule 2A of Income Tax Rules, 1962.\n\n"
                        "The least of the following amounts is exempt from tax:\n"
                        "1. Actual HRA received from the employer during the relevant period;\n"
                        "2. Actual rent paid minus 10% of salary for the relevant period;\n"
                        "3. 50% of salary if the accommodation is situated in Mumbai, Kolkata, Delhi, or Chennai (Metro cities), or 40% of salary if situated in any other city.\n"
                        "For this purpose, 'salary' includes basic pay, dearness allowance (if entering into retirement benefits), and commission based on fixed percentage of turnover.\n\n"
                        "Section 24(b). Deduction from Income from House Property for Interest on Borrowed Capital.\n"
                        "Where the property has been acquired, constructed, repaired, renewed or reconstructed with borrowed capital, the amount of any interest payable on such capital shall be allowed as a deduction.\n"
                        "In case of a self-occupied residential property, the deduction for interest payable on capital borrowed on or after 1st April 1999 for acquisition or construction shall not exceed Rs. 2,00,000 in any previous year, provided the acquisition or construction is completed within 5 years from the end of the financial year in which capital was borrowed."
                    )
                ]
            },
            {
                "filename": "Finance_Act_2023_2024_Tax_Regimes.pdf",
                "title": "Finance Act Provisions — Section 115BAC Concessional Tax Regime & Slabs",
                "pages": [
                    (
                        "FINANCE ACT & CENTRAL BOARD OF DIRECT TAXES (CBDT)\nTAX RATES & STATUTORY CONCESSIONAL REGIMES\n\n"
                        "Section 115BAC. Tax on income of individuals and Hindu undivided family (New Tax Regime).\n"
                        "(1) Notwithstanding anything contained in this Act, but subject to the provisions of this Chapter, the income-tax payable in respect of the total income of a person, being an individual or Hindu undivided family, for any previous year relevant to the Assessment Year 2024-25 and subsequent assessment years, shall be computed at the following concessional slab rates:\n\n"
                        "New Tax Regime Tax Slabs (Applicable for AY 2024-25 / FY 2023-24):\n"
                        "- Total Income up to Rs. 3,00,000: NIL (0%)\n"
                        "- From Rs. 3,00,001 to Rs. 6,00,000: 5%\n"
                        "- From Rs. 6,00,001 to Rs. 9,00,000: 10%\n"
                        "- From Rs. 9,00,001 to Rs. 12,00,000: 15%\n"
                        "- From Rs. 12,00,001 to Rs. 15,00,000: 20%\n"
                        "- Above Rs. 15,00,000: 30%\n\n"
                        "Key Features:\n"
                        "1. Default Regime: Section 115BAC is the default tax regime from Assessment Year 2024-25 onwards. Assessees wishing to opt for the Old Tax Regime must exercise an explicit option under Section 115BAC(6).\n"
                        "2. Standard Deduction: Standard deduction under Section 16(ia) of Rs. 50,000 is allowed to salaried individuals and pensioners under Section 115BAC (increased to Rs. 75,000 for AY 2025-26 under Finance Act 2024).\n"
                        "3. Rebate under Section 87A: Resident individuals with total income not exceeding Rs. 7,00,000 under the New Tax Regime are entitled to a full tax rebate of up to Rs. 25,000, resulting in zero net income tax liability."
                    ),
                    (
                        "FINANCE ACT & INCOME TAX ACT, 1961\nCAPITAL GAINS TAX PROVISIONS (SECTIONS 111A & 112A)\n\n"
                        "Section 111A. Tax on short-term capital gains in respect of equity shares and units of equity-oriented fund.\n"
                        "Where total income includes short-term capital gains arising from the transfer of a capital asset being equity shares in a company or units of an equity-oriented fund liable to Securities Transaction Tax (STT), the tax payable shall be 15% (revised to 20% for transfers on or after 23rd July 2024 under Finance Act 2024).\n\n"
                        "Section 112A. Tax on long-term capital gains in certain cases.\n"
                        "Long-term capital gains arising from transfer of an equity share in a company or a unit of an equity-oriented mutual fund where STT has been paid shall be taxed at 10% on gains exceeding Rs. 1,00,000 in a financial year (exemption threshold enhanced to Rs. 1,25,000 and rate revised to 12.5% for transfers made on or after 23rd July 2024).\n"
                        "No indexation benefit under the second proviso to Section 48 is available for capital gains calculated under Section 112A.\n\n"
                        "Financial Year vs Assessment Year Reference:\n"
                        "- Financial Year (FY): The 12-month period beginning 1st April and ending 31st March in which income is earned.\n"
                        "- Assessment Year (AY): The 12-month period immediately following the Financial Year in which the earned income is evaluated, reported, and taxed by the Income Tax Department."
                    )
                ]
            }
        ]

        results = []
        for doc_info in official_docs:
            pdf_path = settings.DOCUMENTS_DIR / doc_info["filename"]
            # Generate the PDF file physically using PyMuPDF fitz
            doc = fitz.open()
            for page_text in doc_info["pages"]:
                page = doc.new_page(width=595, height=842)  # Standard A4
                rect = fitz.Rect(50, 50, 545, 792)
                page.insert_textbox(rect, page_text, fontsize=10, fontname="helv", color=(0.1, 0.1, 0.1))
            doc.save(str(pdf_path))
            doc.close()

            # Now ingest through the standard pipeline
            res = self.ingest_pdf(pdf_path, title=doc_info["title"], source_url="https://incometaxindia.gov.in/acts")
            results.append(res)

        return {
            "seeded_count": len(results),
            "results": results
        }

rag_pipeline = RAGPipeline()
