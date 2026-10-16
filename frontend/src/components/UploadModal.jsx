import React, { useState } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
      if (name.endsWith('.csv') || name.endsWith('.csv.gz') || name.endsWith('.gz')) {
        // avoid duplicates by name
        if (!selectedFiles.some(existing => existing.name === f.name)) {
          valid.push(f);
        }
      } else {
        setError(`File '${f.name}' is not supported. Please select .csv or .csv.gz files.`);
        return;
      }
    }
    if (valid.length > 0) {
      // Sort parts logically (e.g., -00001, -00002)
      const combined = [...selectedFiles, ...valid].sort((a, b) => a.name.localeCompare(b.name));
      setSelectedFiles(combined);
    }
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles(selectedFiles.filter((_, idx) => idx !== indexToRemove));
  };

  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.uploadFile(selectedFiles);
      setSuccessMsg(`Ingested ${res.filename}! Loaded $${res.total_cost?.toLocaleString()} across ${res.dates?.length || 0} dates.`);
      setTimeout(() => {
        onUploadSuccess(res.filename);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="clay-card w-full max-w-lg p-6 relative border border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface dark:bg-zorvex-dark-surface shadow-clay-lg">
        
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
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
              <Upload className="w-5 h-5 stroke-[2]" />
            </span>
            <h3 className="text-lg font-extrabold text-zorvex-text dark:text-zorvex-dark-text tracking-tight">
              Ingest AWS CUR Report
            </h3>
          </div>
          <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
            Drop your AWS Cost & Usage Report (.csv or .csv.gz). Multi-part reports (e.g. -00001, -00002) are automatically stitched.
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
            dragActive
              ? 'border-zorvex-forest bg-zorvex-forest-soft/40 dark:bg-zorvex-forest-dark-soft/40'
              : selectedFiles.length > 0
              ? 'border-zorvex-forest/60 bg-zorvex-secondary/60 dark:bg-zorvex-dark-secondary/60'
              : 'border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-secondary/30 dark:bg-zorvex-dark-secondary/30 hover:bg-zorvex-secondary/60'
          }`}
        >
          {selectedFiles.length > 0 ? (
            <div className="flex flex-col items-center w-full">
              {/* Multi-part banner if more than 1 file */}
              {selectedFiles.length > 1 && (
                <div className="w-full mb-3 px-3 py-1.5 rounded-lg bg-zorvex-forest-soft/50 border border-zorvex-forest/20 text-zorvex-forest dark:text-zorvex-forest-highlight text-[11px] font-bold flex items-center justify-between">
                  <span>Multi-Part CUR ({selectedFiles.length} files)</span>
                  <span className="text-[10px] uppercase tracking-wider bg-zorvex-forest/20 px-2 py-0.5 rounded font-mono">Auto-Merge</span>
                </div>
              )}

              {/* Selected Files List */}
              <div className="w-full max-h-40 overflow-y-auto space-y-1.5 text-left mb-3 pr-1">
                {selectedFiles.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight flex-shrink-0" />
                      <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text truncate font-mono text-[11px]">
                        {f.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[11px] font-mono text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        aria-label={`Remove file ${f.name}`}
                        className="text-zorvex-spike hover:bg-zorvex-spike/10 p-1 rounded-md transition-colors"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary & Add more */}
              <div className="flex items-center justify-between w-full pt-2 border-t border-zorvex-border dark:border-zorvex-dark-border text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                <span className="font-mono">Total: {(totalBytes / (1024 * 1024)).toFixed(2)} MB</span>
                <label className="text-zorvex-forest dark:text-zorvex-forest-highlight hover:underline cursor-pointer font-bold inline-flex items-center gap-1">
                  + Add another part
                  <input
                    type="file"
                    accept=".csv,.gz"
                    multiple
                    aria-label="Add another CUR file part"
                    onChange={handleChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-zorvex-secondary dark:bg-zorvex-dark-secondary text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center justify-center mb-3 shadow-inner">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text">
                Drag & drop your CUR file(s) here, or{' '}
                <label className="text-zorvex-forest dark:text-zorvex-forest-highlight hover:underline cursor-pointer font-extrabold">
                  browse
                  <input
                    type="file"
                    accept=".csv,.gz"
                    multiple
                    aria-label="Browse CUR files to upload"
                    onChange={handleChange}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-2">
                Supports single or multi-part AWS CUR v1/v2 (.csv or .csv.gz)
              </p>
            </div>
          )}
        </div>

        {/* Status / Alerts */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-zorvex-spike-soft dark:bg-zorvex-spike-dark-soft border border-zorvex-spike/30 text-zorvex-spike text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft border border-zorvex-forest/30 text-zorvex-forest dark:text-zorvex-forest-highlight text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || loading}
            className={`px-5 py-2.5 rounded-clay-pill text-xs font-extrabold flex items-center gap-2 ${
              selectedFiles.length === 0 || loading
                ? 'bg-zorvex-secondary text-zorvex-text-muted/50 cursor-not-allowed'
                : 'clay-button-primary'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{selectedFiles.length > 1 ? 'Merging & Streaming Ingestion...' : 'Streaming Ingestion...'}</span>
              </>
            ) : (
              <span>{selectedFiles.length > 1 ? `Stitch & Ingest (${selectedFiles.length} Parts)` : 'Start Ingestion'}</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
