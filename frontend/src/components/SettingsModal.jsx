import React, { useState } from 'react';
import { X, Settings as SettingsIcon, Sliders, Database, Cpu, Check } from 'lucide-react';

export default function SettingsModal({ 
  settings, 
  onSaveSettings, 
  onClose,
  healthStatus 
}) {
  const [topK, setTopK] = useState(settings?.topK || 4);
  const [threshold, setThreshold] = useState(settings?.threshold || 0.20);
  const [defaultYear, setDefaultYear] = useState(settings?.defaultYear || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSaveSettings({
      topK: Number(topK),
      threshold: Number(threshold),
      defaultYear
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div 
        className="w-full max-w-lg bg-[#0b101c] border border-[#1e293b] rounded-2xl p-6 shadow-2xl relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#182338]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                System & RAG Configuration
              </h3>
              <p className="text-[11px] text-slate-400">
                Adjust retrieval sensitivity and model behavior
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

        {/* Form Body */}
        <div className="py-5 space-y-4 text-xs text-slate-300">
          {/* Top-K passages */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                Top-K Retrieved Passages ({topK})
              </label>
              <span className="text-[11px] font-mono text-slate-400">{topK} chunks</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              value={topK}
              onChange={(e) => setTopK(e.target.value)}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Number of official statutory passages passed as evidence to the LLM.
            </p>
          </div>

          {/* Similarity Threshold */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-white">
                Relevance Similarity Threshold ({threshold})
              </label>
              <span className="text-[11px] font-mono text-slate-400">{Math.round(threshold * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.50"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Minimum cosine similarity required to accept a statutory excerpt.
            </p>
          </div>

          {/* Default Assessment Year */}
          <div className="space-y-1.5 pt-2">
            <label className="font-semibold text-white">
              Default Assessment Year Context
            </label>
            <select
              value={defaultYear}
              onChange={(e) => setDefaultYear(e.target.value)}
              className="w-full bg-[#0d1424] border border-[#1e293b] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
            >
              <option value="">Auto-Detect / All Tax Years</option>
              <option value="AY 2024-25">AY 2024-25 (Current Filing Cycle)</option>
              <option value="AY 2025-26">AY 2025-26 (Finance Act 2024)</option>
              <option value="FY 2023-24">FY 2023-24 (Previous Year)</option>
            </select>
          </div>

          {/* Active Model & Engine Information */}
          <div className="p-3 rounded-xl bg-[#070b14] border border-[#1e293b] space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                Active Model:
              </span>
              <span className="text-white">{healthStatus?.active_model || 'Gemini 3.5 Flash'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Vector Database:
              </span>
              <span className="text-white">ChromaDB (Persistent)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#182338] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#0e1626] hover:bg-[#162035] text-slate-300 text-xs font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{saved ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
