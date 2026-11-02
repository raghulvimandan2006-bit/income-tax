import React, { useState, useEffect } from 'react';
import { Clock, Search, ArrowRight, BookOpen, ShieldCheck, FileText } from 'lucide-react';
import { getResearchHistory } from '../api';

export default function QueryHistory({ onSelectHistoryItem }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        const data = await getResearchHistory();
        setHistory(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  const filteredHistory = history.filter(item =>
    (item.query || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.answer || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#1e293b]">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-blue-500" />
            Research Query History
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Chronological log of Indian Income Tax research inquiries, generated answers, and citations.
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400 bg-[#0d1424] px-3 py-1.5 rounded-lg border border-[#1e293b]">
          {history.length} logged queries
        </span>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter previously asked tax questions..."
          className="w-full bg-[#0d1424] border border-[#1e293b] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {/* History List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          Loading research history...
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0b101c] border border-[#1e293b] text-center flex flex-col items-center">
          <Clock className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-sm font-medium text-slate-300 mb-1">No research history yet</p>
          <p className="text-xs text-slate-500 max-w-sm">
            Ask your first tax question on the Research dashboard to record evidence-backed findings.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredHistory.map((item, idx) => (
            <div
              key={idx}
              onClick={() => onSelectHistoryItem(item)}
              className="p-4 rounded-xl bg-[#0b101c] hover:bg-[#0f172a] border border-[#1e293b] hover:border-blue-500/40 cursor-pointer transition-all duration-200 group flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    {item.created_at || 'Recent'}
                  </span>
                  <div className="flex items-center gap-2">
                    {item.tax_year && item.tax_year !== 'General / Unspecified' && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/30 text-blue-400">
                        {item.tax_year}
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                      {item.confidence_level || 'High Grounding'}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors mb-2">
                  {item.query}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {item.answer ? item.answer.replace(/[#*`_]/g, '') : ''}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 font-mono">
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                  {item.citations?.length || 0} citations attached
                </span>
                <span className="flex items-center gap-1 text-blue-400 group-hover:translate-x-1 transition-all font-medium">
                  Inspect Report <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
