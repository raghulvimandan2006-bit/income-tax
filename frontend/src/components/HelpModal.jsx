import React from 'react';
import { X, HelpCircle, ShieldAlert, Cpu, BookOpen, Layers } from 'lucide-react';

export default function HelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-[#0b101c] border border-[#1e293b] rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#182338]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                TaxLens Methodology & Architecture
              </h3>
              <p className="text-[11px] text-slate-400">
                AI-Powered Indian Tax Research Assistant Using Retrieval-Augmented Generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#0e1626] hover:bg-[#162035] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto py-5 space-y-5 text-xs text-slate-300 leading-relaxed">
          {/* Objective */}
          <div>
            <h4 className="font-semibold text-white text-sm mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-400" />
              1. Project Objective & Core Principle
            </h4>
            <p className="text-slate-400">
              TaxLens is a dedicated legal-tech research platform designed for Chartered Accountants, tax attorneys, researchers, and finance students. Unlike general-purpose conversational LLMs, TaxLens enforces **strict retrieval grounding**: answers are generated exclusively from verified, indexed official documents (Income Tax Act 1961, Finance Acts, CBDT circulars) and accompanied by page-level verifiable citations.
            </p>
          </div>

          {/* RAG Pipeline Diagram */}
          <div className="p-4 rounded-xl bg-[#070b14] border border-[#1e293b] space-y-2">
            <h4 className="font-semibold text-white text-xs flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-400" />
              2. System Architecture (RAG Pipeline)
            </h4>
            <div className="font-mono text-[11px] text-blue-300/90 bg-[#0d1424] p-3 rounded-lg border border-[#182338] space-y-1">
              <div>User Question → Question Embedding (SentenceTransformers)</div>
              <div>&nbsp;&nbsp;↓</div>
              <div>ChromaDB Vector Retrieval (Cosine Similarity & Threshold Filter)</div>
              <div>&nbsp;&nbsp;↓</div>
              <div>Context Assembly + Official Metadata Injection</div>
              <div>&nbsp;&nbsp;↓</div>
              <div>LLM Generation (Gemini 3.5 Flash / Fallback Synthesizer)</div>
              <div>&nbsp;&nbsp;↓</div>
              <div>Evidence-Grounded Response with Verifiable Citations [1], [2]</div>
            </div>
          </div>

          {/* FY vs AY Definition */}
          <div className="p-4 rounded-xl bg-[#091122] border border-blue-500/20 space-y-2">
            <h4 className="font-semibold text-white text-xs">
              3. Critical Concept: Financial Year (FY) vs Assessment Year (AY)
            </h4>
            <p className="text-slate-300">
              • <strong className="text-white">Financial Year (FY):</strong> The 12-month period (1 April to 31 March) in which an individual or corporate assessee earns income.<br />
              • <strong className="text-white">Assessment Year (AY):</strong> The succeeding 12-month period in which income earned in the previous FY is assessed and taxed by the Income Tax Department. For example, income earned in <span className="font-mono text-blue-300">FY 2023-24</span> is evaluated and filed under <span className="font-mono text-blue-300">AY 2024-25</span>.
            </p>
          </div>

          {/* Technology Stack */}
          <div>
            <h4 className="font-semibold text-white text-sm mb-1.5 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-400" />
              4. Technology Stack
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-[#0d1424] border border-[#1e293b]">Backend: Python, FastAPI, Pydantic</div>
              <div className="p-2 rounded bg-[#0d1424] border border-[#1e293b]">Doc Processing: PyMuPDF (fitz)</div>
              <div className="p-2 rounded bg-[#0d1424] border border-[#1e293b]">Vector Store: ChromaDB (Persistent)</div>
              <div className="p-2 rounded bg-[#0d1424] border border-[#1e293b]">Embeddings: all-MiniLM-L6-v2</div>
              <div className="p-2 rounded bg-[#0d1424] border border-[#1e293b]">AI: Google Gemini 3.5 Flash</div>
              <div className="p-2 rounded bg-[#0d1424] border border-[#1e293b]">Frontend: React, Vite, Tailwind CSS</div>
            </div>
          </div>

          {/* Academic Disclaimer */}
          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200/90 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Academic & Research Disclaimer:</strong> This application is intended for academic research, legal education, and professional study. Taxpayers should consult official Income Tax Department notifications and qualified Chartered Accountants before filing statutory tax returns.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#182338] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
