import React, { useState } from 'react';
import { 
  Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, 
  Layers, FileCode, ShieldCheck, Plus, Trash2, Info 
} from 'lucide-react';
import { api } from '../services/api';

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('auto'); // 'auto', 'single', 'multi'

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles) => {
    setError('');
    const valid = [];
    for (const f of newFiles) {
      const name = f.name.toLowerCase();
      if (name.endsWith('.parquet') || name.endsWith('.zip')) {
        setError(`File '${f.name}' format is unsupported. Phase 1 accepts CSV (.csv / .csv.gz) and Manifest (.json).`);
        return;
      }
      if (name.endsWith('.csv') || name.endsWith('.csv.gz') || name.endsWith('.gz') || name.endsWith('.json')) {
        // avoid duplicates by name
        if (!selectedFiles.some(existing => existing.name === f.name)) {
          valid.push(f);
        }
      } else {
        setError(`File '${f.name}' is not supported. Please select .csv, .csv.gz, or Manifest .json files.`);
        return;
      }
    }

    if (valid.length > 0) {
      // Sort parts logically (e.g. manifests first, then -00001, -00002)
      const combined = [...selectedFiles, ...valid].sort((a, b) => {
        const aIsJson = a.name.toLowerCase().endsWith('.json');
        const bIsJson = b.name.toLowerCase().endsWith('.json');
        if (aIsJson && !bIsJson) return -1;
        if (!aIsJson && bIsJson) return 1;
        return a.name.localeCompare(b.name);
      });
      setSelectedFiles(combined);
    }
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles(selectedFiles.filter((_, idx) => idx !== indexToRemove));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setError('');
    setSuccessMsg('');
  };

  const manifestFiles = selectedFiles.filter(f => f.name.toLowerCase().endsWith('.json'));
  const dataFiles = selectedFiles.filter(f => !f.name.toLowerCase().endsWith('.json'));
  const isMultiPart = dataFiles.length > 1;
  const isSingle = dataFiles.length === 1 && manifestFiles.length === 0;
  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (dataFiles.length === 0 && manifestFiles.length > 0) {
      setError("Please add at least one CUR data file (.csv or .csv.gz) alongside the manifest.");
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.uploadFile(selectedFiles);
      const grossFormatted = (res.gross_cost || res.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const revNote = res.revision_version && res.revision_version > 1 ? ` (Revision v${res.revision_version})` : '';
      setSuccessMsg(`Ingested ${res.filename}${revNote}! Loaded $${grossFormatted} across ${res.dates?.length || 0} dates.`);
      setTimeout(() => {
        onUploadSuccess(res.filename);
        onClose();
      }, 1400);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="clay-card w-full max-w-xl p-6 relative border border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface dark:bg-zorvex-dark-surface shadow-clay-lg">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close CUR upload modal"
          className="absolute top-5 right-5 p-2 rounded-full clay-button text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2.5 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight shadow-sm">
              <Upload className="w-5 h-5 stroke-[2.2]" />
            </span>
            <div>
              <h3 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight flex items-center gap-2">
                Ingest AWS CUR Report
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/20">
                  Phase 1 Safe
                </span>
              </h3>
              <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                Supports single reports, multi-part split exports (-00001, -00002), and AWS Manifests.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Mode Selector Pills */}
        <div className="grid grid-cols-2 gap-2 mb-4 p-1 rounded-2xl bg-zorvex-secondary/50 dark:bg-zorvex-dark-secondary/50 border border-zorvex-border dark:border-zorvex-dark-border">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'single' || (selectedFiles.length > 0 && isSingle)
                ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-forest-highlight shadow-sm border border-zorvex-forest/20'
                : 'text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Single CUR File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('multi')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'multi' || (selectedFiles.length > 0 && (isMultiPart || manifestFiles.length > 0))
                ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-forest-highlight shadow-sm border border-zorvex-forest/20'
                : 'text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Part Export (+ Manifest)</span>
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
            dragActive
              ? 'border-zorvex-forest bg-zorvex-forest-soft/40 dark:bg-zorvex-forest-dark-soft/40'
              : selectedFiles.length > 0
              ? 'border-zorvex-forest/60 bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/40'
              : 'border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-secondary/20 dark:bg-zorvex-dark-secondary/20 hover:bg-zorvex-secondary/50'
          }`}
        >
          {selectedFiles.length > 0 ? (
            <div className="flex flex-col items-center w-full">
              {/* Top Status Header */}
              <div className="w-full mb-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border">
                <div className="flex items-center gap-2 text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                  {isMultiPart ? (
                    <>
                      <Layers className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                      <span>Multi-Part Bundle ({dataFiles.length} Parts{manifestFiles.length > 0 ? ' + Manifest' : ''})</span>
                    </>
                  ) : manifestFiles.length > 0 && dataFiles.length === 0 ? (
                    <>
                      <FileCode className="w-4 h-4 text-purple-500" />
                      <span className="text-purple-600 dark:text-purple-400">Manifest Attached (Waiting for Data Part)</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                      <span>Single CUR Report File</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
                    {(totalBytes / (1024 * 1024)).toFixed(2)} MB Total
                  </span>
                  <button
                    type="button"
                    onClick={clearAllFiles}
                    className="p-1 rounded-md text-zorvex-text-muted hover:text-zorvex-spike transition-colors"
                    title="Remove all files"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Selected Files List with Grouping */}
              <div className="w-full max-h-48 overflow-y-auto space-y-1.5 text-left mb-3 pr-1 custom-scrollbar">
                {/* 1. Manifest files */}
                {manifestFiles.map((f, idx) => (
                  <div key={`manifest-${idx}`} className="flex items-center justify-between p-2 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded font-mono font-black text-[9px] uppercase bg-purple-500 text-white">
                        Manifest
                      </span>
                      <span className="font-bold text-purple-950 dark:text-purple-200 truncate font-mono text-[11px]">
                        {f.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] font-mono text-purple-700 dark:text-purple-300">
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(selectedFiles.indexOf(f))}
                        className="text-zorvex-spike hover:bg-zorvex-spike/10 p-1 rounded-md transition-colors"
                        title="Remove manifest"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* 2. Data part files */}
                {dataFiles.map((f, idx) => (
                  <div key={`data-${idx}`} className="flex items-center justify-between p-2 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-text-muted dark:text-zorvex-dark-text-muted border border-zorvex-border dark:border-zorvex-dark-border">
                        {dataFiles.length > 1 ? `Part ${String(idx + 1).padStart(2, '0')}` : 'CUR'}
                      </span>
                      <FileText className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight flex-shrink-0" />
                      <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text truncate font-mono text-[11px]">
                        {f.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] font-mono text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                        {f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(2)} MB` : `${(f.size / 1024).toFixed(1)} KB`}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(selectedFiles.indexOf(f))}
                        className="text-zorvex-spike hover:bg-zorvex-spike/10 p-1 rounded-md transition-colors"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add more files footer */}
              <div className="flex items-center justify-between w-full pt-2 border-t border-zorvex-border dark:border-zorvex-dark-border text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                  <span>Replay protection & revision-safe</span>
                </div>
                <label className="text-zorvex-forest dark:text-zorvex-forest-highlight hover:underline cursor-pointer font-extrabold inline-flex items-center gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add more files / manifest
                  <input
                    type="file"
                    accept=".csv,.gz,.json"
                    multiple
                    aria-label="Add more CUR file parts or manifest"
                    onChange={handleChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-2">
              <div className="w-14 h-14 rounded-3xl bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center justify-center mb-3 shadow-inner">
                {activeTab === 'multi' ? (
                  <Layers className="w-7 h-7 stroke-[2]" />
                ) : (
                  <Upload className="w-7 h-7 stroke-[2]" />
                )}
              </div>

              <div className="text-sm font-black text-zorvex-text dark:text-zorvex-dark-text mb-1">
                Drag & drop your CUR file(s) here, or{' '}
                <label className="text-zorvex-forest dark:text-zorvex-forest-highlight hover:underline cursor-pointer font-black">
                  browse files
                  <input
                    type="file"
                    accept=".csv,.gz,.json"
                    multiple
                    aria-label="Browse CUR files to upload"
                    onChange={handleChange}
                    className="hidden"
                  />
                </label>
              </div>

              <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted max-w-sm mb-3">
                {activeTab === 'multi' 
                  ? 'Select all split part files (e.g. -00001, -00002) + optional -Manifest.json together.'
                  : 'Select your complete CUR file (.csv or .csv.gz) or upload multi-part export chunks.'}
              </p>

              {/* Supported formats pills */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded-md bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text">
                  .csv.gz
                </span>
                <span className="px-2 py-0.5 rounded-md bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border text-zorvex-text">
                  .csv
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-300 font-bold">
                  *-Manifest.json
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Informative Guidance Callout */}
        <div className="mt-3.5 p-2.5 rounded-xl bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/40 border border-zorvex-border dark:border-zorvex-dark-border text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted flex items-start gap-2">
          <Info className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight flex-shrink-0 mt-0.5" />
          <span>
            <strong>Multi-part Ingestion:</strong> Files belonging to the same billing period are automatically pre-validated, column-aligned, deduplicated, and stitched without double-counting spend.
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-3 p-3 rounded-xl bg-zorvex-spike-soft dark:bg-zorvex-spike-dark-soft border border-zorvex-spike/30 text-zorvex-spike text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mt-3 p-3 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft border border-zorvex-forest/30 text-zorvex-forest dark:text-zorvex-forest-highlight text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-zorvex-border dark:border-zorvex-dark-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || loading || (dataFiles.length === 0 && manifestFiles.length > 0)}
            className={`px-5 py-2 rounded-clay-pill text-xs font-black flex items-center gap-2 ${
              selectedFiles.length === 0 || loading || (dataFiles.length === 0 && manifestFiles.length > 0)
                ? 'bg-zorvex-secondary text-zorvex-text-muted/50 cursor-not-allowed border border-zorvex-border dark:border-zorvex-dark-border'
                : 'clay-button-primary'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isMultiPart ? 'Validating & Stitching Parts...' : 'Streaming Ingestion...'}</span>
              </>
            ) : isMultiPart ? (
              <span>Stitch & Ingest ({dataFiles.length} Parts{manifestFiles.length > 0 ? ' + Manifest' : ''})</span>
            ) : manifestFiles.length > 0 && dataFiles.length === 1 ? (
              <span>Ingest CUR + Manifest</span>
            ) : (
              <span>Start Ingestion ({selectedFiles.length > 0 ? '1 File' : '0 Files'})</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
