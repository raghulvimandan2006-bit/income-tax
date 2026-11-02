import React from 'react';
import { Search, FileText, ChevronRight, Sparkles } from 'lucide-react';

export default function Topbar({ 
  activeTab, 
  onQuickSearchClick, 
  onOpenLibrary,
  healthStatus 
}) {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  const kbdSymbol = isMac ? '⌘' : 'Ctrl';

  const tabLabels = {
    research: 'Research',
    history: 'Research history',
    library: 'Source library'
  };

  return (
    <header className="h-14 border-b border-[#1e293b]/70 px-6 flex items-center justify-between bg-[#080c16]/80 backdrop-blur-md sticky top-0 z-10">
      {/* Breadcrumbs matching design */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <span className="hover:text-slate-300 transition-colors cursor-pointer">Workspace</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-200 font-semibold">{tabLabels[activeTab] || 'Research'}</span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Model status pill */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d1424] border border-[#1e293b] text-[11px] text-slate-300">
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span>{healthStatus?.active_model || 'Gemini 3.5 Flash'}</span>
        </div>

        {/* Search button with shortcut */}
        <button
          onClick={onQuickSearchClick}
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0e1626] hover:bg-[#131e34] border border-[#1e293b] text-slate-400 hover:text-slate-200 text-xs transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search</span>
          </div>
          <kbd className="text-[10px] font-mono text-slate-400 bg-[#162035] px-1.5 py-0.5 rounded border border-[#23334d]">
            {kbdSymbol} /
          </kbd>
        </button>

        {/* Quick Documents icon button */}
        <button
          onClick={onOpenLibrary}
          title="Open Document Library"
          className="p-1.5 rounded-lg bg-[#0e1626] hover:bg-[#131e34] border border-[#1e293b] text-slate-400 hover:text-slate-200 transition-colors"
        >
          <FileText className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
