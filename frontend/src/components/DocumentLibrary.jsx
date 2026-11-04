import React, { useState, useEffect, useRef } from 'react';
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
  Database,
  Layers,
  FolderDown,
  Clock,
  Check,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  getDocuments, 
  uploadDocument, 
  batchUploadDocuments, 
  batchProcessDirectory, 
  getBatchJobs,
  deleteDocument, 
  reprocessDocument, 
  seedOfficialTaxDocs 
} from '../api';

export default function DocumentLibrary({ onRefreshStats }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [notification, setNotification] = useState(null);

  // Batch Processor states
  const [activeBatchJob, setActiveBatchJob] = useState(null);
  const [showBatchDetails, setShowBatchDetails] = useState(true);
  const [batchJobsHistory, setBatchJobsHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [scanningDirectory, setScanningDirectory] = useState(false);

  const fileInputRef = useRef(null);
  const batchFileInputRef = useRef(null);

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

  const fetchHistory = async () => {
    try {
      const jobs = await getBatchJobs();
      setBatchJobsHistory(jobs || []);
    } catch (err) {
      console.error('Failed to load batch jobs history:', err);
    }
  };

  useEffect(() => {
    fetchDocs();
    fetchHistory();
  }, []);

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Handles both single and multi-file uploads through the Batch Processor
  const handleFilesUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    
    // Filter for PDFs
    const validPdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (validPdfs.length === 0) {
      showNotice('error', 'Only PDF files (.pdf) are supported.');
      return;
    }

    if (validPdfs.length < files.length) {
      showNotice('info', `Filtered out ${files.length - validPdfs.length} non-PDF files.`);
    }

    try {
      setUploading(true);
      setActiveBatchJob({
        status: 'in_progress',
        total_files: validPdfs.length,
        processed_files: 0,
        results: []
      });

      const res = await batchUploadDocuments(validPdfs);
      setActiveBatchJob(res);
      showNotice(
        res.failed_files > 0 ? 'info' : 'success',
        `Batch complete: ${res.successful_files} indexed, ${res.skipped_duplicates} duplicate, ${res.failed_files} failed.`
      );
      fetchDocs();
      fetchHistory();
    } catch (err) {
      showNotice('error', err.message || 'Batch upload failed');
      setActiveBatchJob(prev => prev ? { ...prev, status: 'failed', error: err.message } : null);
    } finally {
      setUploading(false);
    }
  };

  const handleDirectoryScan = async () => {
    try {
      setScanningDirectory(true);
      showNotice('info', 'Scanning data/documents directory for unindexed tax PDFs...');
      const res = await batchProcessDirectory(null, false);
      if (res.total_files === 0) {
        showNotice('info', 'No new PDF documents discovered in directory.');
      } else {
        setActiveBatchJob(res);
        showNotice(
          'success',
          `Directory batch finished: ${res.successful_files} indexed, ${res.skipped_duplicates} duplicate, ${res.failed_files} failed.`
        );
        fetchDocs();
        fetchHistory();
      }
    } catch (err) {
      showNotice('error', err.message || 'Directory batch scanning failed');
    } finally {
      setScanningDirectory(false);
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
      showNotice('success', `Seeded ${res.seeded_count} official Indian tax documents into Pinecone vector database!`);
      fetchDocs();
      fetchHistory();
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1e293b]">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Database className="w-6 h-6 text-blue-500" />
            Official Tax Document Library
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Manage Income Tax Act PDFs, Finance Acts, and CBDT circulars indexed into Pinecone Cloud Vector Store.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleDirectoryScan}
            disabled={scanningDirectory || uploading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0e1626] hover:bg-[#15233c] border border-blue-500/30 text-blue-400 text-xs font-medium transition-all shadow-sm"
            title="Scan ./data/documents folder for PDFs"
          >
            <FolderDown className="w-3.5 h-3.5" />
            <span>{scanningDirectory ? 'Scanning...' : 'Scan Directory'}</span>
          </button>

          <button
            onClick={() => { fetchHistory(); setShowHistoryModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0e1626] hover:bg-[#15233c] border border-slate-700 text-slate-300 text-xs font-medium transition-all shadow-sm"
            title="View Batch Processing Job History"
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Batch History</span>
          </button>

          <button
            onClick={handleSeedDefaults}
            disabled={loading || uploading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/40 text-blue-400 text-xs font-medium transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Seed Essential Provisions</span>
          </button>
        </div>
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

      {/* Upload Drag & Drop Area with Batch Support */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesUpload(e.dataTransfer.files);
          }
        }}
        className={`mb-6 p-7 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center relative ${
          dragActive
            ? 'border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/10'
            : 'border-[#1e293b] hover:border-slate-600 bg-[#0b101c]/60'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-blue-400/20 border border-blue-500/30 flex items-center justify-center mb-3 text-blue-400 shadow-sm">
          <Layers className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-white mb-1">
          {uploading ? 'Batch Processing Documents...' : 'Batch Ingest Official Tax PDFs'}
        </h4>
        <p className="text-slate-400 text-xs mb-4 max-w-lg">
          Select or drop single or multiple Indian tax PDFs. The high-throughput Batch Processor extracts pages, generates embeddings in memory-optimized batches, and indexes vectors into Pinecone.
        </p>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <label className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all flex items-center gap-2 ${
            uploading ? 'bg-blue-600/40 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20'
          }`}>
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Processing Batch...' : 'Select Multiple PDFs'}</span>
            <input
              ref={batchFileInputRef}
              type="file"
              accept=".pdf"
              multiple
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesUpload(e.target.files);
                }
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Active Batch Processor Live Progress Panel */}
      {activeBatchJob && (
        <div className="mb-6 p-4 rounded-2xl bg-[#090e1a] border border-blue-500/40 shadow-xl relative animate-slide-up">
          <div className="flex items-center justify-between pb-3 border-b border-[#182338]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-950 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white font-mono">
                    Batch Job: {activeBatchJob.batch_id || 'Running...'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                    activeBatchJob.status === 'completed'
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                      : activeBatchJob.status === 'in_progress'
                      ? 'bg-blue-950/80 text-blue-400 border border-blue-500/30 animate-pulse'
                      : activeBatchJob.status === 'partial_success'
                      ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                  }`}>
                    {activeBatchJob.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Duration: {activeBatchJob.duration_seconds ? `${activeBatchJob.duration_seconds}s` : 'Processing...'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBatchDetails(!showBatchDetails)}
                className="p-1 rounded text-slate-400 hover:text-white"
                title="Toggle breakdown"
              >
                {showBatchDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setActiveBatchJob(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3">
            <div className="p-2 rounded-xl bg-[#0d1424] border border-[#1e293b] text-center">
              <div className="text-[10px] uppercase font-mono text-slate-400">Total Files</div>
              <div className="text-sm font-bold text-white font-mono mt-0.5">{activeBatchJob.total_files || 0}</div>
            </div>
            <div className="p-2 rounded-xl bg-[#0d1424] border border-[#1e293b] text-center">
              <div className="text-[10px] uppercase font-mono text-emerald-400">Indexed</div>
              <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">{activeBatchJob.successful_files || 0}</div>
            </div>
            <div className="p-2 rounded-xl bg-[#0d1424] border border-[#1e293b] text-center">
              <div className="text-[10px] uppercase font-mono text-amber-400">Duplicate</div>
              <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">{activeBatchJob.skipped_duplicates || 0}</div>
            </div>
            <div className="p-2 rounded-xl bg-[#0d1424] border border-[#1e293b] text-center">
              <div className="text-[10px] uppercase font-mono text-rose-400">Failed</div>
              <div className="text-sm font-bold text-rose-400 font-mono mt-0.5">{activeBatchJob.failed_files || 0}</div>
            </div>
            <div className="p-2 rounded-xl bg-[#0d1424] border border-[#1e293b] text-center col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase font-mono text-blue-400">Vectors Added</div>
              <div className="text-sm font-bold text-blue-400 font-mono mt-0.5">{activeBatchJob.total_chunks_indexed || 0}</div>
            </div>
          </div>

          {/* Itemized file results */}
          {showBatchDetails && activeBatchJob.results && activeBatchJob.results.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#182338] space-y-1.5 max-h-48 overflow-y-auto">
              {activeBatchJob.results.map((r, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#070b14] border border-[#192437] text-xs">
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-200 font-mono truncate">{r.filename}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400">{r.pages}p / {r.chunks} chunks</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                      r.status === 'success'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                        : r.status === 'skipped_duplicate'
                        ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                    }`}>
                      {r.status === 'success' ? 'Indexed' : r.status === 'skipped_duplicate' ? 'Duplicate' : 'Error'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Batch Processing History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div 
            className="w-full max-w-2xl bg-[#0b101c] border border-[#1e293b] rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#182338]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Batch Ingestion Jobs
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Execution history of multi-document batch runs
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-lg bg-[#0e1626] hover:bg-[#162035] text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 overflow-y-auto flex-1 text-xs">
              {batchJobsHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  No batch jobs recorded yet. Use "Select Multiple PDFs" to run your first batch.
                </div>
              ) : (
                batchJobsHistory.map((job) => (
                  <div key={job.batch_id} className="p-3.5 rounded-xl bg-[#070b14] border border-[#192437] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-slate-200">{job.batch_id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                        job.status === 'completed'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                          : job.status === 'partial_success'
                          ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                      }`}>
                        {job.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono flex-wrap">
                      <span>{job.created_at}</span>
                      <span>•</span>
                      <span>{job.total_files} files</span>
                      <span>•</span>
                      <span className="text-emerald-400">{job.successful_files} indexed</span>
                      <span>•</span>
                      <span className="text-blue-400">{job.total_chunks_indexed} vectors</span>
                      <span>•</span>
                      <span>{job.duration_seconds}s</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[#182338] flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-[#0e1626] hover:bg-[#162035] text-slate-300 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
