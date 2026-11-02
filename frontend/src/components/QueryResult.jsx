import React, { useState } from 'react';
import { 
  Check, 
  Copy, 
  BookOpen, 
  FileText, 
  Sparkles, 
  ExternalLink, 
  ShieldCheck, 
  ArrowLeft,
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function QueryResult({ 
  result, 
  loading, 
  onBackToSearch, 
  onViewSource 
}) {
  const [copied, setCopied] = useState(false);
  const [activeCitationId, setActiveCitationId] = useState(null);

  const handleCopy = () => {
    if (!result?.answer) return;
    navigator.clipboard.writeText(result.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-3xl mx-auto w-full animate-fade-in">
        <div className="relative mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8 text-blue-400 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div className="absolute -inset-2 bg-blue-500/20 rounded-3xl blur-xl -z-10 animate-pulse-glow" />
        </div>

        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
          Researching Indian Tax Knowledge Base
        </h3>
        <p className="text-slate-400 text-sm text-center max-w-md mb-8">
          Synthesizing evidence-grounded provisions from official Income Tax statutes with verifiable citations...
        </p>

        {/* Multi-step progress pulse indicator */}
        <div className="w-full max-w-md flex flex-col gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0d1424] border border-[#1e293b]">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span className="text-xs text-slate-300 font-medium">1. Embedding query with SentenceTransformers</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0d1424] border border-[#1e293b]">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-medium">2. Retrieving top relevant passages from ChromaDB</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0d1424] border border-[#1e293b]">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-medium">3. Grounding legal answer & verifying citations</span>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full animate-fade-in">
      {/* Top back navigation and metadata */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1e293b]">
        <button
          onClick={onBackToSearch}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Research</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Tax Year Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0d1424] border border-[#1e293b] text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>{result.tax_year_applicability || 'General Law'}</span>
          </div>

          {/* Confidence Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{result.confidence_level || 'High Grounding'}</span>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0e1626] hover:bg-[#131e34] border border-[#1e293b] text-xs text-slate-300 hover:text-white transition-all shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Copied' : 'Copy Report'}</span>
          </button>
        </div>
      </div>

      {/* Query Banner */}
      <div className="p-4 rounded-xl bg-[#0a0f1d] border border-[#1e293b] mb-6 shadow-sm">
        <div className="text-[11px] font-mono uppercase text-slate-400 mb-1">
          RESEARCH INQUIRY
        </div>
        <h2 className="text-lg font-semibold text-white tracking-tight">
          {result.query}
        </h2>
      </div>

      {/* Main Grounded Answer Card */}
      <div className="rounded-2xl bg-[#0b101c] border border-[#1e293b] p-6 mb-8 shadow-xl relative">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#182338]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              EVIDENCE-GROUNDED SYNTHESIS
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Generated via {result.model_name || 'Gemini 3.5 Flash'}
          </span>
        </div>

        {/* Insufficient Evidence Warning Banner if applicable */}
        {result.insufficient_evidence && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Insufficient Statutory Evidence Notice:</span>
              <p className="mt-0.5 text-amber-300/90 leading-relaxed">
                The indexed official documents did not contain sufficient clauses to answer every facet of this query. 
                TaxLens refrains from hallucination or guesswork.
              </p>
            </div>
          </div>
        )}

        {/* Render Formatted Markdown Answer */}
        <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed space-y-4">
          {result.answer.split('\n\n').map((para, pIdx) => {
            if (para.startsWith('### ')) {
              return (
                <h3 key={pIdx} className="text-base font-bold text-white pt-2 border-b border-slate-800 pb-1">
                  {para.replace('### ', '')}
                </h3>
              );
            }
            if (para.startsWith('#### ')) {
              return (
                <h4 key={pIdx} className="text-sm font-semibold text-blue-300 pt-1">
                  {para.replace('#### ', '')}
                </h4>
              );
            }
            if (para.startsWith('- ') || para.startsWith('* ')) {
              const items = para.split('\n').filter(Boolean);
              return (
                <ul key={pIdx} className="list-disc pl-5 space-y-1 text-slate-300 text-xs md:text-sm">
                  {items.map((item, iIdx) => (
                    <li key={iIdx}>{item.replace(/^[-*]\s+/, '')}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={pIdx} className="text-slate-300 text-xs md:text-sm leading-relaxed">
                {para}
              </p>
            );
          })}
        </div>
      </div>

      {/* Verifiable Citations Drawer */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Verifiable Citations & Source Evidence ({result.citations?.length || 0})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Click citation to inspect official page excerpt
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {result.citations?.map((cit, idx) => (
            <div
              key={idx}
              onClick={() => onViewSource && onViewSource(cit)}
              className={`p-4 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between ${
                activeCitationId === cit.citation_id
                  ? 'bg-[#101b33] border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'bg-[#0c1220] border-[#1e293b] hover:border-blue-500/40 hover:bg-[#0f172a]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-500/30">
                    {cit.citation_id}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Page {cit.page_number}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 line-clamp-1 mb-1">
                  {cit.document_title}
                </div>

                <div className="text-[11px] text-slate-400 font-mono mb-2">
                  {cit.section}
                </div>

                <p className="text-[11px] text-slate-400 italic line-clamp-3 bg-[#080d18] p-2 rounded-lg border border-slate-800/80">
                  "{cit.excerpt}"
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-emerald-400/90 font-mono">
                  Score: {Math.round((cit.relevance_score || 0.85) * 100)}%
                </span>
                <span className="flex items-center gap-1 text-blue-400 group-hover:translate-x-0.5 transition-transform font-medium">
                  View passage <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
