import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ResearchView from './components/ResearchView';
import QueryResult from './components/QueryResult';
import DocumentLibrary from './components/DocumentLibrary';
import QueryHistory from './components/QueryHistory';
import SourceViewerModal from './components/SourceViewerModal';
import HelpModal from './components/HelpModal';
import SettingsModal from './components/SettingsModal';

import { askTaxQuestion, getSystemStats, getHealthStatus } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('research');
  const [activeResult, setActiveResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);

  // Modals
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // User RAG settings
  const [ragSettings, setRagSettings] = useState({
    topK: 4,
    threshold: 0.20,
    defaultYear: ''
  });

  const searchInputRef = useRef(null);

  // Fetch initial stats and health status
  const refreshStats = async () => {
    try {
      const [sData, hData] = await Promise.all([
        getSystemStats().catch(() => null),
        getHealthStatus().catch(() => null)
      ]);
      if (sData) setStats(sData);
      if (hData) setHealthStatus(hData);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  // Global Keyboard Shortcuts (⌘K / Ctrl K and ⌘/ / Ctrl /)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewResearch();
      }
      if (isCmdOrCtrl && e.key === '/') {
        e.preventDefault();
        setActiveTab('research');
        setActiveResult(null);
        setTimeout(() => {
          if (searchInputRef.current) searchInputRef.current.focus();
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNewResearch = () => {
    setActiveTab('research');
    setActiveResult(null);
    setTimeout(() => {
      if (searchInputRef.current) searchInputRef.current.focus();
    }, 50);
  };

  const handleExecuteQuery = async ({ query, taxYear }) => {
    try {
      setLoading(true);
      setActiveResult(null);
      const res = await askTaxQuestion({
        query,
        taxYear: taxYear || ragSettings.defaultYear,
        topK: ragSettings.topK,
        threshold: ragSettings.threshold
      });
      setActiveResult(res);
      refreshStats();
    } catch (err) {
      alert(`Research query failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistoryItem = (item) => {
    setActiveResult({
      query: item.query,
      answer: item.answer,
      citations: item.citations || [],
      confidence_level: item.confidence_level || 'High',
      tax_year_applicability: item.tax_year || 'General',
      model_name: item.model_name || 'Gemini 3.5 Flash',
      insufficient_evidence: (item.answer || '').toLowerCase().includes('insufficient evidence')
    });
    setActiveTab('research');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070a12] text-slate-100 font-sans">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'research') setActiveResult(null);
        }}
        onNewResearch={handleNewResearch}
        stats={stats}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#070a12] relative">
        <Topbar
          activeTab={activeTab}
          onQuickSearchClick={handleNewResearch}
          onOpenLibrary={() => setActiveTab('library')}
          healthStatus={healthStatus}
        />

        <main className="flex-1 overflow-y-auto flex flex-col">
          {activeTab === 'research' && (
            loading || activeResult ? (
              <QueryResult
                result={activeResult}
                loading={loading}
                onBackToSearch={() => setActiveResult(null)}
                onViewSource={(citation) => setSelectedCitation(citation)}
              />
            ) : (
              <ResearchView
                onExecuteQuery={handleExecuteQuery}
                loading={loading}
                inputRef={searchInputRef}
                onOpenHelp={() => setIsHelpOpen(true)}
              />
            )
          )}

          {activeTab === 'library' && (
            <DocumentLibrary onRefreshStats={refreshStats} />
          )}

          {activeTab === 'history' && (
            <QueryHistory onSelectHistoryItem={handleSelectHistoryItem} />
          )}
        </main>
      </div>

      {/* Source Viewer Modal */}
      {selectedCitation && (
        <SourceViewerModal
          citation={selectedCitation}
          onClose={() => setSelectedCitation(null)}
        />
      )}

      {/* Help & Methodology Modal */}
      {isHelpOpen && (
        <HelpModal onClose={() => setIsHelpOpen(false)} />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          settings={ragSettings}
          onSaveSettings={(newSettings) => setRagSettings(newSettings)}
          onClose={() => setIsSettingsOpen(false)}
          healthStatus={healthStatus}
        />
      )}
    </div>
  );
}
