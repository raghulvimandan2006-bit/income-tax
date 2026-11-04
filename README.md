# TaxLens — AI-Powered Indian Tax Research Assistant Using RAG

An academic and professional financial research platform that retrieves provisions from official Indian income tax documents (Income Tax Act 1961, Finance Acts, and CBDT circulars) to generate evidence-grounded answers with verifiable citations.

---

## 1. System Architecture

```
User Tax Question
       │
       ▼
Query Embedding (Sentence Transformers: all-MiniLM-L6-v2)
       │
       ▼
Pinecone Serverless Vector Search (AWS us-east-1, Cosine Similarity & Threshold Filter)
       │
       ▼
Retrieved Official Tax Statutory Chunks (Page-Level Citations & Metadata)
       │
       ▼
Strictly Grounded Prompt Assembly (FY vs AY Awareness, Anti-Hallucination)
       │
       ▼
LLM Generation Engine (Google Gemini with Waterfall Fallback & Retries)
       │
       ▼
Evidence-Grounded Legal Synthesis + Verifiable Citations [1], [2]
```

---

## 2. Technology Stack

- **Frontend**: React (Vite), Tailwind CSS, Lucide Icons, Glassmorphic UI design matching TaxLens dark SaaS aesthetic.
- **Backend API**: Python, FastAPI, Pydantic v2.
- **Document Processing**: PyMuPDF (`fitz`) with page-level preservation, scanned page detection, and statutory regex extractors.
- **Embeddings**: Sentence Transformers (`all-MiniLM-L6-v2`, 384-dimensional dense vectors).
- **Vector Database**: Pinecone Serverless (`tax-knowledge-base` on AWS us-east-1).
- **AI/LLM Generation**: Google Gemini API (`gemini-3.5-flash`, `gemini-3.8-flash`) with exponential backoff and deterministic offline extractive fallback.
- **Version Control**: Git.

---

## 3. Key Functional Capabilities

1. **Document Management & Ingestion**:
   - Upload official Indian Income Tax PDFs (validation of magic bytes `%PDF`, max 50MB, filename sanitization).
   - Page-by-page extraction preserving exact page numbers and statutory clauses.
   - Automatic detection of sections (`Section 80C`, `Section 115BAC`, `Section 10(13A)`, `Section 24(b)`, etc.) and tax years (`AY 2024-25`, `FY 2023-24`).
   - Duplicate prevention using SHA-256 document hashing.
   - Scanned page detection with OCR advisory warnings.

2. **Semantic Search & Vector Retrieval**:
   - Natural language query embedding via Sentence Transformers.
   - Top-K retrieval with configurable similarity score thresholding.
   - Granular citation metadata attached to every chunk (`document_title`, `page_number`, `section`, `source_url`).

3. **Evidence-Grounded Answer Generation**:
   - Strict system prompt mandating that answers must be derived *only* from retrieved evidence.
   - Explicit distinction between Financial Year (FY) and Assessment Year (AY).
   - Clear disclosure when evidence is insufficient rather than fabricating tax rates.
   - Interactive citations linking claims directly to original document pages.

4. **Offline Resilience & Fallback**:
   - Built-in exponential backoff retry handler for rate limits (HTTP 429) or high demand spikes (503).
   - Model cascade across Gemini models.
   - Deterministic offline extractive synthesizer ensuring zero downtime during evaluations.

---

## 4. Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### Backend Setup
1. Activate virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirement.txt
   ```
2. Verify `.env` configuration:
   ```ini
   GEMINI_API_KEY=your_gemini_api_key_here
   PINECONE_API_KEY=your_pinecone_api_key_here
   PINECONE_INDEX_NAME=tax-knowledge-base
   UPLOAD_DIR=./data/documents
   CHUNK_SIZE=600
   CHUNK_OVERLAP=100
   TOP_K=4
   ```
3. Run the FastAPI backend:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   Interactive Swagger documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend Setup
1. Navigate to the `frontend` folder and install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open `http://127.0.0.1:5173` in your browser.

---

## 5. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/research/ask` | Primary RAG endpoint: accepts question, retrieves evidence, generates grounded response |
| `POST` | `/api/research/search` | Semantic search endpoint: retrieves matching statutory chunks without LLM synthesis |
| `POST` | `/api/research/batch-ask` | Batch research queries: analyzes multiple tax questions concurrently |
| `GET` | `/api/research/history` | Retrieves chronological inquiry history with attached citations |
| `GET` | `/api/documents` | Lists all indexed tax documents, page counts, and metadata |
| `POST` | `/api/documents/upload` | Validates and ingests official tax PDF into Pinecone |
| `POST` | `/api/documents/batch-upload` | Batch processor: ingests multiple tax PDFs concurrently with detailed status tracking |
| `POST` | `/api/documents/batch-process-directory` | Batch processor: scans and ingests all PDFs in a directory |
| `GET` | `/api/documents/batch-jobs` | Lists active and historical batch ingestion jobs |
| `GET` | `/api/documents/batch-jobs/{id}` | Status and itemized progress of a specific batch job |
| `GET` | `/api/documents/{id}/file` | Serves original PDF document |
| `DELETE` | `/api/documents/{id}` | Deletes document and its vector chunks from Pinecone |
| `POST` | `/api/documents/seed-defaults` | Pre-populates essential official tax provisions (Sec 80C, Sec 115BAC, etc.) |
| `GET` | `/api/stats` | Returns database statistics (documents, chunks, queries) |
| `GET` | `/api/health` | System health check and model connectivity status |

---

## 6. Academic & Legal Disclaimer
TaxLens is built for academic research and educational reference. While answers are grounded strictly in official documents, users must consult official gazette notifications and qualified Chartered Accountants for statutory tax filings.
# income-tax
# income-tax
# income-tax
