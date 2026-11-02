import re
import json
import logging
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from pydantic import BaseModel, Field

from app.core.config import settings
from app.Ai.fallRetry import FallbackRetryHandler

logger = logging.getLogger("TaxLens.LLM")

class CitationModel(BaseModel):
    citation_id: str = Field(description="Citation tag like [1], [2]")
    document_title: str
    page_number: int
    section: Optional[str] = "General Provision"
    source_url: Optional[str] = ""
    relevance_score: Optional[float] = 0.0
    excerpt: Optional[str] = ""

class TaxResearchAnswer(BaseModel):
    query: str
    answer: str
    citations: List[CitationModel]
    confidence_level: str = "High"
    tax_year_applicability: str = "Unspecified / General"
    model_name: str
    insufficient_evidence: bool = False

class LLMService:
    """
    RAG Generation Engine for Indian Tax Law with Gemini API and controlled prompt engineering.
    """

    def __init__(self):
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
        self.preferred_models = [settings.DEFAULT_LLM_MODEL] + [
            m for m in settings.FALLBACK_MODELS if m != settings.DEFAULT_LLM_MODEL
        ]

    def _build_tax_system_prompt(self) -> str:
        return (
            "You are TaxLens, a Senior Indian Tax Law Research Assistant and Senior Chartered Accountant Advisor.\n"
            "Your objective is to provide precise, professional, evidence-grounded answers to Indian Income Tax questions.\n\n"
            "STRICT OPERATING RULES:\n"
            "1. GROUNDING ONLY: Answer exclusively based on the provided Retrieved Official Evidence. Do NOT invent, assume, or extrapolate sections, dates, or provisions not found in the evidence.\n"
            "2. VERIFIABLE CITATIONS: Every factual assertion must be cited with inline markers like [1], [2] referencing the corresponding evidence snippet.\n"
            "3. FY vs AY DISTINCTION: Clearly distinguish Financial Year (FY: year income is earned) and Assessment Year (AY: year income is taxed). Never confuse them.\n"
            "4. INSUFFICIENT EVIDENCE: If the retrieved evidence does not contain sufficient details to answer the question, state: 'Based on the provided official tax documents in the knowledge base, there is insufficient evidence to determine [specific issue].' and explain what specific provision is missing.\n"
            "5. NO HALLUCINATION: Never fabricate citations, circular numbers, notifications, or tax rate slabs.\n"
            "6. FORMATTING: Structure your response with clean Markdown: an Executive Summary, Applicable Provisions & Analysis, Key Tax-Year Applicability, and Summary Table if relevant."
        )

    def _format_context_prompt(self, query: str, contexts: List[Dict[str, Any]], specified_year: Optional[str] = None) -> str:
        prompt_parts = [
            f"USER TAX QUESTION: {query}\n",
        ]
        if specified_year:
            prompt_parts.append(f"SPECIFIED TAX YEAR CONTEXT: {specified_year}\n")

        prompt_parts.append("\n--- RETRIEVED OFFICIAL EVIDENCE ---")
        if not contexts:
            prompt_parts.append("No matching documents or passages retrieved from the knowledge base.\n")
        else:
            for idx, ctx in enumerate(contexts):
                doc_title = ctx.get("document_title", "Income Tax Document")
                page_num = ctx.get("page_number", "Unknown")
                sec = ctx.get("detected_sections", "Unspecified Section")
                text = ctx.get("text", "").strip()
                prompt_parts.append(
                    f"\n[Evidence {idx + 1}]:\n"
                    f"Document: {doc_title}\n"
                    f"Page: {page_num}\n"
                    f"Identified Section/Provision: {sec}\n"
                    f"Excerpt Content: {text}\n"
                )

        prompt_parts.append(
            "\n--- INSTRUCTIONS ---\n"
            "Provide your comprehensive legal response adhering to the strict grounding rules. "
            "Cite each passage using [1], [2], etc."
        )
        return "\n".join(prompt_parts)

    def generate_grounded_answer(
        self,
        query: str,
        contexts: List[Dict[str, Any]],
        tax_year: Optional[str] = None
    ) -> TaxResearchAnswer:
        """
        Generates an evidence-grounded answer using Gemini API with retry and fallback.
        """
        # If no contexts retrieved at all
        if not contexts:
            return TaxResearchAnswer(
                query=query,
                answer=(
                    "### Insufficient Evidence in Knowledge Base\n\n"
                    "No relevant passages were found in the uploaded Indian income tax documents for this query. "
                    "To receive an evidence-backed answer, please upload the relevant official documents "
                    "(e.g., Income Tax Act, Finance Act, or CBDT circulars) in the **Source Library**."
                ),
                citations=[],
                confidence_level="Low",
                tax_year_applicability="Not determinable from available records",
                model_name="N/A",
                insufficient_evidence=True
            )

        system_instruction = self._build_tax_system_prompt()
        prompt_content = self._format_context_prompt(query, contexts, tax_year)

        # Prepare Citation list
        citations: List[CitationModel] = []
        for idx, ctx in enumerate(contexts):
            citations.append(CitationModel(
                citation_id=f"[{idx + 1}]",
                document_title=ctx.get("document_title", "Official Tax Document"),
                page_number=ctx.get("page_number", 1),
                section=ctx.get("detected_sections", "General Provision"),
                source_url=ctx.get("source_url", ctx.get("filename", "")),
                relevance_score=ctx.get("similarity_score", 0.0),
                excerpt=(ctx.get("text", "")[:280] + "...") if len(ctx.get("text", "")) > 280 else ctx.get("text", "")
            ))

        # Attempt generation across model cascade with retries
        last_exception = None
        for model_name in self.preferred_models:
            try:
                def call_gemini():
                    model = genai.GenerativeModel(
                        model_name=model_name,
                        system_instruction=system_instruction
                    )
                    return model.generate_content(prompt_content)

                response = FallbackRetryHandler.execute_with_retry(
                    call_gemini,
                    max_retries=2,
                    initial_backoff=1.0
                )

                if response and response.text:
                    answer_text = response.text.strip()
                    insufficient = "insufficient evidence" in answer_text.lower()
                    
                    return TaxResearchAnswer(
                        query=query,
                        answer=answer_text,
                        citations=citations,
                        confidence_level="High" if not insufficient else "Low",
                        tax_year_applicability=tax_year or "As stated in retrieved statutory evidence",
                        model_name=model_name,
                        insufficient_evidence=insufficient
                    )
            except Exception as e:
                logger.warning(f"Model {model_name} failed: {e}. Trying next fallback...")
                last_exception = e

        # If all API calls fail (e.g., quota exceeded / network issue), use offline grounded synthesizer
        logger.error(f"All LLM API calls failed: {last_exception}. Invoking deterministic offline fallback.")
        fallback_res = FallbackRetryHandler.fallback_extractive_synthesis(query, contexts)

        return TaxResearchAnswer(
            query=query,
            answer=fallback_res["answer"],
            citations=citations,
            confidence_level="High (Direct Statutory Extraction)",
            tax_year_applicability=tax_year or "Verified from official statutory excerpts",
            model_name=fallback_res["model_used"],
            insufficient_evidence=False
        )

llm_service = LLMService()
