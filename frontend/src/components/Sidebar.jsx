import React from 'react';
import { 
  Home, 
  Clock, 
  BookOpen, 
  Plus, 
  HelpCircle, 
  Settings, 
  ChevronRight,
  Database
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  onNewResearch, 
  stats,
  onOpenHelp,
  onOpenSettings
}) {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  const kbdSymbol = isMac ? '⌘' : 'Ctrl';

  const navItems = [
    { id: 'research', label: 'Research', icon: Home },
    { id: 'history', label: 'Research history', icon: Clock },
    { id: 'library', label: 'Source library', icon: BookOpen },
  ];

  return (
    <aside className="w-64 min-w-[16rem] h-screen bg-[#090d16] border-r border-[#1e293b]/80 flex flex-col justify-between select-none z-20">
      {/* Top branding & actions */}
      <div className="p-4 flex flex-col gap-5">
        {/* Brand header */}
        <div className="flex items-center gap-3 px-1 pt-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-lg border border-blue-400/30">
            ₹
          </div>
          <div>
            <div className="text-white font-semibold tracking-tight text-[15px] flex items-center gap-1.5">
              TaxLens
            </div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-medium">
              RESEARCH INTELLIGENCE
            </div>
          </div>
        </div>

        {/* New Research Button */}
        <button
          onClick={onNewResearch}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#0e1626] hover:bg-[#131e34] border border-[#1e293b] hover:border-blue-500/50 text-slate-200 text-sm font-medium transition-all group shadow-sm hover:shadow-blue-500/5"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            <span>New research</span>
          </div>
          <kbd className="text-[10px] font-mono text-slate-400 bg-[#162035] px-1.5 py-0.5 rounded border border-[#23334d]">
            {kbdSymbol} K
          </kbd>
        </button>

        {/* Workspace section nav */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase px-2 py-1">
            Workspace
          </div>

          <nav className="flex flex-col gap-1 mt-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all relative ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e1524]'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-500 rounded-r-full" />
                  )}
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Middle/Bottom Card & Utilities */}
      <div className="p-4 flex flex-col gap-4">
        {/* Workspace Status Card matching screenshot */}
        <div className="p-3.5 rounded-xl bg-[#0c1322] border border-[#1e293b]/70 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Research workspace</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Answers are generated from the configured knowledge base.
          </p>
          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-blue-400" />
              {stats?.total_documents ?? 0} docs
            </span>
            <span>{stats?.total_chunks ?? 0} chunks</span>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onOpenHelp}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-[#0e1524] transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Help & methodology</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-[#0e1524] transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Settings</span>
          </button>
        </div>

        {/* User Profile Bar */}
        <div className="pt-2 border-t border-[#1e293b]/80">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#0e1524] cursor-pointer transition-colors group">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#1a2336] border border-[#2b3952] flex items-center justify-center text-xs font-semibold text-slate-300">
                TR
              </div>
              <div className="text-left">
                <div className="text-xs font-medium text-slate-200 group-hover:text-white leading-tight">
                  Tax Researcher
                </div>
                <div className="text-[10px] text-slate-400">
                  Professional workspace
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-300 transition-colors" />
          </div>
        </div>
      </div>
    </aside>
  );
}
