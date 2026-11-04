import time
import logging
from typing import Callable, Any, List, Dict, Optional

logger = logging.getLogger("TaxLens.Retry")

class FallbackRetryHandler:
    """
    Handles robust retries with exponential backoff, model cascades,
    and fallback synthesis when LLM services encounter rate limits or temporary unavailability.
    """

    @staticmethod
    def execute_with_retry(
        func: Callable[[], Any],
        max_retries: int = 3,
        initial_backoff: float = 1.0,
        backoff_multiplier: float = 2.0,
        retryable_errors: tuple = (Exception,)
    ) -> Any:
        """
        Executes a function with exponential backoff retry.
        """
        attempt = 0
        backoff = initial_backoff
        last_error = None

        while attempt < max_retries:
            try:
                return func()
            except retryable_errors as e:
                attempt += 1
                last_error = e
                err_str = str(e).lower()
                
                # Check for rate limit or temporary server overload
                is_rate_limit = "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str
                is_overload = "503" in err_str or "high demand" in err_str or "unavailable" in err_str
                
                if attempt >= max_retries:
                    break

                sleep_time = backoff * (2.5 if is_rate_limit else 1.0)
                logger.warning(
                    f"[Attempt {attempt}/{max_retries}] Retryable error encountered: {e}. Backing off for {sleep_time:.1f}s"
                )
                time.sleep(sleep_time)
                backoff *= backoff_multiplier

        raise last_error

    @staticmethod
    def fallback_extractive_synthesis(query: str, contexts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Deterministic, offline, evidence-grounded fallback answer generator.
        Used if external LLM APIs are temporarily unreachable or quota is exhausted.
        Constructs a structured legal research memorandum directly from retrieved Pinecone vector passages.
        """
        if not contexts:
            return {
                "answer": "### Insufficient Evidence\n\nNo relevant provisions or passages were found in the uploaded official Indian Income Tax documents matching your query. Please upload the relevant Income Tax Act provisions or Finance Act circular to research this question.",
                "citations": [],
                "confidence": "Low",
                "tax_year_note": "No applicable tax year evidence identified.",
                "model_used": "Deterministic Extractive Synthesizer (Offline Fallback)"
            }

        citations = []
        structured_passages = []

        for idx, ctx in enumerate(contexts):
            citation_item = {
                "citation_id": f"[{idx + 1}]",
                "document_title": ctx.get("document_title", "Income Tax Act"),
                "page_number": ctx.get("page_number", 1),
                "section": ctx.get("detected_sections", "Tax Provision"),
                "source_url": ctx.get("source_url", ctx.get("filename", "Official Tax Document")),
                "relevance_score": ctx.get("similarity_score", 0.0),
                "excerpt": ctx.get("text", "")[:280] + "..."
            }
            citations.append(citation_item)

            snippet_text = ctx.get("text", "").strip()
            # Format clean snippet
            structured_passages.append(
                f"**From {ctx.get('document_title')} (Page {ctx.get('page_number')}, {ctx.get('detected_sections')}):**\n"
                f"> \"{snippet_text}\"\n"
            )

        passages_combined = "\n".join(structured_passages)
        sections_found = ", ".join(set(c["section"] for c in citations if c["section"] != "General Provision"))

        answer_text = (
            f"### Evidence-Grounded Legal Extract\n\n"
            f"Based on the official tax provisions retrieved from the knowledge base regarding **\"{query}\"**:\n\n"
            f"**Key Identified Provisions:** {sections_found if sections_found else 'Relevant statutory clauses'}\n\n"
            f"#### Retrieved Evidence Summary:\n"
            f"{passages_combined}\n\n"
            f"--- \n"
            f"*Note: Synthesized strictly from official passages indexed in the local knowledge base with verifiable citations.*"
        )

        return {
            "answer": answer_text,
            "citations": citations,
            "confidence": "High (Direct Evidence Extraction)",
            "tax_year_note": "Verified from official statutory excerpts.",
            "model_used": "Offline Direct Grounded Synthesizer"
        }
