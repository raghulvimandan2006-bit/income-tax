import React from 'react';
import { X, ExternalLink, FileText, BookOpen, ShieldCheck } from 'lucide-react';

export default function SourceViewerModal({ citation, onClose }) {
  if (!citation) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-[#0b101c] border border-[#1e293b] rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#182338]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-500/30">
                  {citation.citation_id}
                </span>
                <span className="text-sm font-semibold text-white">
                  Source Evidence Viewer
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Page {citation.page_number} • {citation.section}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#0e1626] hover:bg-[#162035] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto py-5 space-y-4">
          {/* Document metadata block */}
          <div className="p-3.5 rounded-xl bg-[#0d1424] border border-[#1e293b] text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 font-mono">Document Title:</span>
              <span className="font-semibold text-white text-right">{citation.document_title}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 font-mono">Relevant Provision:</span>
              <span className="font-mono text-blue-400">{citation.section}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 font-mono">Page Reference:</span>
              <span className="font-mono text-slate-200">Page {citation.page_number}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 font-mono">Relevance Grounding:</span>
              <span className="font-mono text-emerald-400">
                {Math.round((citation.relevance_score || 0.85) * 100)}% Match
              </span>
            </div>
          </div>

          {/* Full passage text */}
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400 mb-2 flex items-center justify-between">
              <span>Retrieved Official Statutory Passage</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="p-4 rounded-xl bg-[#070b14] border border-[#1e293b] text-slate-200 text-xs md:text-sm font-sans leading-relaxed whitespace-pre-wrap select-text">
              {citation.excerpt}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#182338] flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Source-grounded via ChromaDB vector index
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}
