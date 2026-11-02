import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  ArrowRight, 
  Sparkles, 
  HelpCircle,
  Calendar,
  Layers
} from 'lucide-react';

export default function ResearchView({ 
  onExecuteQuery, 
  loading,
  inputRef,
  onOpenHelp
}) {
  const [query, setQuery] = useState('');
  const [taxYear, setTaxYear] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const sampleTasks = [
    {
      num: '01',
      title: 'Explain a tax provision with supporting sources',
      prompt: 'What are the deduction limits and qualifying investments under Section 80C for an individual assessee?'
    },
    {
      num: '02',
      title: 'Research a question across the knowledge base',
      prompt: 'Explain the tax slab rates and standard deduction under the Section 115BAC New Tax Regime for Assessment Year 2024-25.'
    },
    {
      num: '03',
      title: 'Find relevant passages for a tax issue',
      prompt: 'How is the House Rent Allowance (HRA) exemption calculated under Section 10(13A) and Rule 2A?'
    }
  ];

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!query.trim() || loading) return;
    onExecuteQuery({ query: query.trim(), taxYear });
  };

  const handleSelectSample = (samplePrompt) => {
    setQuery(samplePrompt);
    onExecuteQuery({ query: samplePrompt, taxYear });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-4xl mx-auto w-full relative">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[320px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Sparkle Pill Header */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/50 border border-blue-500/30 text-blue-400 text-xs font-semibold tracking-wider uppercase mb-6 animate-fade-in shadow-sm shadow-blue-500/10">
        <Sparkles className="w-3.5 h-3.5" />
        <span>AI-POWERED TAX RESEARCH</span>
      </div>

      {/* Hero Title matching screenshot */}
      <h1 className="text-4xl md:text-5xl font-bold text-center tracking-tight text-white mb-4 max-w-2xl leading-[1.18]">
        Research Indian tax law <br />
        <span className="text-slate-300 font-medium">with evidence, not guesswork.</span>
      </h1>

      {/* Subtitle */}
      <p className="text-slate-400 text-center text-sm md:text-base max-w-xl mb-10 leading-relaxed font-normal">
        Ask a precise tax question. TaxLens retrieves relevant material from your configured knowledge base and prepares a source-grounded response.
      </p>

      {/* Research Search Card matching screenshot */}
      <div 
        className={`w-full rounded-2xl bg-[#0b101c]/90 border transition-all duration-300 p-2.5 shadow-2xl relative ${
          isFocused 
            ? 'border-blue-500/60 shadow-blue-500/10 glow-blue' 
            : 'border-[#1e293b] hover:border-slate-700'
        }`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Main Input Field */}
          <div className="flex items-start gap-3.5 px-3 py-3">
            <Search className={`w-5 h-5 mt-1 transition-colors ${isFocused ? 'text-blue-400' : 'text-slate-500'}`} />
            <textarea
              ref={inputRef}
              rows={2}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Research a question across the knowledge base..."
              className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-base resize-none focus:outline-none leading-relaxed"
            />
          </div>

          {/* Bottom Controls Bar inside the card */}
          <div className="flex items-center justify-between pt-3 border-t border-[#182338] px-3 pb-1">
            {/* Left status & filters */}
            <div className="flex items-center gap-4 flex-wrap text-xs">
              {/* Knowledge base retrieval indicator */}
              <div className="flex items-center gap-2 text-slate-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>Knowledge base retrieval</span>
              </div>

              {/* Assessment Year Select */}
              <div className="flex items-center gap-1.5 bg-[#101728] px-2.5 py-1 rounded-lg border border-[#212f48] text-slate-400 text-xs hover:border-slate-600 transition-colors">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <select
                  value={taxYear}
                  onChange={(e) => setTaxYear(e.target.value)}
                  className="bg-transparent text-slate-300 focus:outline-none text-xs cursor-pointer"
                >
                  <option value="" className="bg-[#0b101c] text-slate-200">All Tax Years</option>
                  <option value="AY 2024-25" className="bg-[#0b101c] text-slate-200">AY 2024-25</option>
                  <option value="AY 2025-26" className="bg-[#0b101c] text-slate-200">AY 2025-26</option>
                  <option value="FY 2023-24" className="bg-[#0b101c] text-slate-200">FY 2023-24</option>
                </select>
              </div>
            </div>

            {/* Research Action Button */}
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-md ${
                query.trim() && !loading
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-blue-600/40 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>{loading ? 'Researching...' : 'Research'}</span>
              <ArrowRight className={`w-4 h-4 transition-transform ${loading ? 'animate-pulse' : 'group-hover:translate-x-0.5'}`} />
            </button>
          </div>
        </form>
      </div>

      {/* "TRY A RESEARCH TASK" section matching screenshot */}
      <div className="w-full mt-12">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
          TRY A RESEARCH TASK
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {sampleTasks.map((task) => (
            <div
              key={task.num}
              onClick={() => handleSelectSample(task.prompt)}
              className="p-4 rounded-xl bg-[#0c1220]/80 hover:bg-[#11192c] border border-[#1e293b]/80 hover:border-blue-500/40 cursor-pointer transition-all duration-200 flex flex-col justify-between group shadow-sm hover:shadow-blue-500/5 hover:-translate-y-0.5"
            >
              <div className="text-xs font-mono font-medium text-slate-400 mb-2">
                {task.num}
              </div>
              <div className="text-xs font-medium text-slate-200 group-hover:text-blue-300 leading-snug flex items-center justify-between gap-2">
                <span>{task.title}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Help ? Button in Bottom Right */}
      <button
        onClick={onOpenHelp}
        title="Help & Methodology"
        className="fixed bottom-6 right-6 w-9 h-9 rounded-full bg-[#111827] hover:bg-[#1f293d] border border-[#374151] text-slate-300 hover:text-white flex items-center justify-center shadow-xl hover:scale-105 transition-all z-30"
      >
        <span className="text-sm font-semibold">?</span>
      </button>
    </div>
  );
}
