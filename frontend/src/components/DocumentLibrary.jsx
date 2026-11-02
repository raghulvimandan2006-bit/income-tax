import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  ExternalLink,
  Search,
  Database
} from 'lucide-react';
import { getDocuments, uploadDocument, deleteDocument, reprocessDocument, seedOfficialTaxDocs } from '../api';

export default function DocumentLibrary({ onRefreshStats }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const data = await getDocuments();
      setDocuments(data || []);
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      showNotice('error', err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showNotice('error', 'Only PDF files (.pdf) are allowed.');
      return;
    }

    try {
      setUploading(true);
      const res = await uploadDocument(file);
      showNotice('success', res.message || 'Document uploaded and indexed successfully!');
      fetchDocs();
    } catch (err) {
      showNotice('error', err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId, title) => {
    if (!window.confirm(`Are you sure you want to delete '${title}' and remove all its indexed vectors from Pinecone?`)) return;
    try {
      await deleteDocument(docId);
      showNotice('success', 'Document deleted successfully');
      fetchDocs();
    } catch (err) {
      showNotice('error', err.message || 'Delete failed');
    }
  };

  const handleReprocess = async (docId) => {
    try {
      showNotice('info', 'Reprocessing and re-embedding document...');
      await reprocessDocument(docId);
      showNotice('success', 'Document reprocessed successfully');
      fetchDocs();
    } catch (err) {
      showNotice('error', err.message || 'Reprocess failed');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setLoading(true);
      const res = await seedOfficialTaxDocs();
      showNotice('success', `Seeded ${res.seeded_count} official Indian tax documents into ChromaDB!`);
      fetchDocs();
    } catch (err) {
      showNotice('error', err.message || 'Failed to seed documents');
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter(doc => 
    (doc.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.filename || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.detected_sections || []).some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#1e293b]">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Database className="w-6 h-6 text-blue-500" />
            Official Tax Document Library
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Manage official Income Tax Act PDFs, Finance Acts, and CBDT circulars indexed into cloud Pinecone database.
          </p>
        </div>

        <button
          onClick={handleSeedDefaults}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] border border-blue-500/40 text-blue-400 text-xs font-medium transition-all shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Seed Essential Tax Provisions</span>
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`mb-6 p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-slide-up ${
          notification.type === 'error'
            ? 'bg-rose-950/50 border border-rose-500/40 text-rose-200'
            : notification.type === 'info'
            ? 'bg-blue-950/50 border border-blue-500/40 text-blue-200'
            : 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-200'
        }`}>
          {notification.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Upload Drag & Drop Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        className={`mb-8 p-8 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center relative ${
          dragActive
            ? 'border-blue-500 bg-blue-950/20 glow-blue'
            : 'border-[#1e293b] hover:border-slate-600 bg-[#0b101c]/60'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mb-3">
          <Upload className="w-6 h-6 text-blue-400" />
        </div>
        <h4 className="text-sm font-semibold text-white mb-1">
          {uploading ? 'Extracting & Indexing PDF...' : 'Drag and drop official tax PDF here'}
        </h4>
        <p className="text-slate-400 text-xs mb-4">
          PyMuPDF extracts pages & sections, SentenceTransformers generates embeddings, Pinecone indexes vectors.
        </p>

        <label className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-medium text-white transition-all ${
          uploading ? 'bg-blue-600/40 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20'
        }`}>
          <span>{uploading ? 'Processing Document...' : 'Browse Local PDF'}</span>
          <input
            type="file"
            accept=".pdf"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />
        </label>
      </div>

      {/* Document Search & Filter bar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search indexed documents or sections..."
            className="w-full bg-[#0d1424] border border-[#1e293b] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {filteredDocs.length} of {documents.length} documents
        </span>
      </div>

      {/* Documents Table / Card List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          Loading document library...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0b101c] border border-[#1e293b] text-center flex flex-col items-center">
          <FileText className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-sm font-medium text-slate-300 mb-1">No documents found</p>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            Upload an official Indian Income Tax Act PDF or click the button above to seed standard provisions.
          </p>
          <button
            onClick={handleSeedDefaults}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            Seed Sample Official Tax Documents
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredDocs.map((doc) => (
            <div
              key={doc.document_id}
              className="p-4 rounded-xl bg-[#0b101c] border border-[#1e293b] hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-blue-950/80 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {doc.title}
                    </h4>
                    {doc.ocr_required && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 border border-amber-500/40 text-amber-300">
                        OCR Required
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                      Indexed
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap font-mono">
                    <span>{doc.filename}</span>
                    <span>•</span>
                    <span>{doc.total_pages} pages</span>
                    <span>•</span>
                    <span>{doc.total_chunks} chunks</span>
                    <span>•</span>
                    <span>{Math.round((doc.file_size || 0) / 1024)} KB</span>
                  </div>

                  {/* Detected sections tag pills */}
                  {doc.detected_sections && doc.detected_sections.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {doc.detected_sections.slice(0, 5).map((sec, sIdx) => (
                        <span key={sIdx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10192b] text-slate-300 border border-[#21304a]">
                          {sec}
                        </span>
                      ))}
                      {doc.detected_sections.length > 5 && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          +{doc.detected_sections.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <a
                  href={`/api/documents/${doc.document_id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-[#0e1626] hover:bg-[#131e34] border border-[#1e293b] text-slate-400 hover:text-slate-200 transition-colors"
                  title="View / Download PDF"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => handleReprocess(doc.document_id)}
                  className="p-2 rounded-lg bg-[#0e1626] hover:bg-[#131e34] border border-[#1e293b] text-slate-400 hover:text-slate-200 transition-colors"
                  title="Reprocess & Re-chunk"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(doc.document_id, doc.title)}
                  className="p-2 rounded-lg bg-[#0e1626] hover:bg-rose-950/40 border border-[#1e293b] hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Delete Document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
