import React, { useState, useEffect } from 'react';
import { 
  Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, 
  Layers, FileCode, ShieldCheck, Plus, Trash2, Info, Tag,
  Cloud, RefreshCw, KeyRound, Copy, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { api } from '../services/api';

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('single'); // 'single', 'multi', 's3'

  // S3 Automated Sync State
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('us-east-1');
  const [s3Prefix, setS3Prefix] = useState('');
  const [s3RoleArn, setS3RoleArn] = useState('');
  const [s3AccountName, setS3AccountName] = useState('');
  const [s3Status, setS3Status] = useState('IDLE');
  const [s3LastSynced, setS3LastSynced] = useState(null);
  const [s3Saving, setS3Saving] = useState(false);
  const [s3Syncing, setS3Syncing] = useState(false);
  const [s3Feedback, setS3Feedback] = useState(null);
  const [showPolicy, setShowPolicy] = useState(false);
  const [policyJson, setPolicyJson] = useState('');
  const [policyCopied, setPolicyCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getS3Config()
        .then((cfg) => {
          if (cfg && cfg.configured) {
            setS3Bucket(cfg.bucket_name || '');
            setS3Region(cfg.region || 'us-east-1');
            setS3Prefix(cfg.prefix || '');
            setS3RoleArn(cfg.role_arn || '');
            setS3AccountName(cfg.account_name || '');
            setS3Status(cfg.last_status || 'CONFIGURED');
            setS3LastSynced(cfg.last_synced_at || null);
          }
        })
        .catch((err) => console.debug('S3 config load notice:', err));
    }
  }, [isOpen]);

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
        setError(`File '${f.name}' format is unsupported. Please select CSV (.csv / .csv.gz) or Manifest (.json).`);
        return;
      }
      if (name.endsWith('.csv') || name.endsWith('.csv.gz') || name.endsWith('.gz') || name.endsWith('.json')) {
        if (!selectedFiles.some(existing => existing.name === f.name)) {
          valid.push(f);
        }
      } else {
        setError(`File '${f.name}' is not supported. Please select .csv, .csv.gz, or Manifest .json files.`);
        return;
      }
    }

    if (valid.length > 0) {
      const combined = [...selectedFiles, ...valid].sort((a, b) => {
        const aIsJson = a.name.toLowerCase().endsWith('.json');
        const bIsJson = b.name.toLowerCase().endsWith('.json');
        if (aIsJson && !bIsJson) return -1;
        if (!aIsJson && bIsJson) return 1;
        return a.name.localeCompare(b.name);
      });
      setSelectedFiles(combined);
      if (combined.filter(f => !f.name.toLowerCase().endsWith('.json')).length > 1) {
        setActiveTab('multi');
      }
    }
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles(selectedFiles.filter((_, idx) => idx !== indexToRemove));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setAccountName('');
    setError('');
    setSuccessMsg('');
  };

  const manifestFiles = selectedFiles.filter(f => f.name.toLowerCase().endsWith('.json'));
  const dataFiles = selectedFiles.filter(f => !f.name.toLowerCase().endsWith('.json'));
  const isMultiPart = dataFiles.length > 1;
  const isSingle = dataFiles.length === 1 && manifestFiles.length === 0;
  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleManualUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (dataFiles.length === 0 && manifestFiles.length > 0) {
      setError("Please add at least one CUR data file (.csv or .csv.gz) alongside the manifest.");
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.uploadFile(selectedFiles, accountName);
      const grossFormatted = (res.gross_cost || res.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const revNote = res.revision_version && res.revision_version > 1 ? ` (Revision v${res.revision_version})` : '';
      setSuccessMsg(`Ingested ${res.filename}${revNote}! Loaded $${grossFormatted} across ${res.dates?.length || 0} dates.`);
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

  // S3 Save Configuration
  const handleSaveS3Config = async () => {
    if (!s3Bucket.trim()) {
      setS3Feedback({ type: 'error', text: 'Please enter an AWS S3 Bucket Name.' });
      return;
    }
    setS3Saving(true);
    setS3Feedback(null);
    try {
      await api.saveS3Config({
        bucket_name: s3Bucket.trim(),
        region: s3Region,
        prefix: s3Prefix.trim(),
        role_arn: s3RoleArn.trim() || null,
        account_name: s3AccountName.trim() || null
      });
      setS3Status('CONFIGURED');
      setS3Feedback({ type: 'success', text: 'AWS S3 configuration saved successfully!' });
    } catch (err) {
      setS3Feedback({ type: 'error', text: err.message || 'Failed to save S3 configuration.' });
    } finally {
      setS3Saving(false);
    }
  };

  // S3 Trigger Sync
  const handleTriggerS3Sync = async () => {
    if (!s3Bucket.trim()) {
      setS3Feedback({ type: 'error', text: 'Please configure and save your S3 Bucket details first.' });
      return;
    }
    setS3Syncing(true);
    setS3Feedback(null);
    try {
      const res = await api.triggerS3Sync();
      setS3Status('SYNCED');
      setS3LastSynced(new Date().toISOString());
      const recs = res.records_ingested || res.total_rows || 0;
      setS3Feedback({ 
        type: 'success', 
        text: `Sync complete! Ingested ${recs.toLocaleString()} records from S3 into ${res.filename || 'active dataset'}.` 
      });
      setTimeout(() => {
        if (res.filename) onUploadSuccess(res.filename);
        onClose();
      }, 1400);
    } catch (err) {
      setS3Feedback({ type: 'error', text: err.message || 'S3 Synchronization failed. Ensure IAM permissions are attached.' });
    } finally {
      setS3Syncing(false);
    }
  };

  // Fetch IAM Policy
  const handleTogglePolicy = async () => {
    if (!showPolicy && !policyJson) {
      try {
        const p = await api.getS3Policy(s3Bucket || 'my-cur-bucket', s3Prefix || '');
        setPolicyJson(JSON.stringify(p.policy || p, null, 2));
      } catch (err) {
        setPolicyJson(JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:ListBucket", "s3:GetBucketLocation"],
              Resource: `arn:aws:s3:::${s3Bucket || 'my-cur-bucket'}`
            },
            {
              Effect: "Allow",
              Action: ["s3:GetObject"],
              Resource: `arn:aws:s3:::${s3Bucket || 'my-cur-bucket'}/*`
            }
          ]
        }, null, 2));
      }
    }
    setShowPolicy(!showPolicy);
  };

  const handleCopyPolicy = () => {
    navigator.clipboard.writeText(policyJson);
    setPolicyCopied(true);
    setTimeout(() => setPolicyCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="clay-card w-full max-w-xl p-6 relative border border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface dark:bg-zorvex-dark-surface shadow-clay-lg max-h-[92vh] overflow-y-auto custom-scrollbar">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close CUR upload modal"
          className="absolute top-5 right-5 p-2 rounded-full clay-button text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text cursor-pointer"
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
                Ingest AWS Cost & Usage Report
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/20">
                  Universal Pipeline
                </span>
              </h3>
              <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                Manual file ingestion or continuous automated AWS S3 bucket synchronization.
              </p>
            </div>
          </div>
        </div>

        {/* Ingestion Mode Selector: Manual vs Automated S3 */}
        <div className="grid grid-cols-3 gap-2 mb-4 p-1 rounded-2xl bg-zorvex-secondary/50 dark:bg-zorvex-dark-secondary/50 border border-zorvex-border dark:border-zorvex-dark-border">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-forest-highlight shadow-sm border border-zorvex-forest/20'
                : 'text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate">Manual (Single)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('multi')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'multi'
                ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-forest-highlight shadow-sm border border-zorvex-forest/20'
                : 'text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="truncate">Multi-Part</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('s3')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 's3'
                ? 'bg-zorvex-surface dark:bg-zorvex-dark-surface text-zorvex-forest dark:text-zorvex-forest-highlight shadow-sm border border-zorvex-forest/20'
                : 'text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span className="truncate">Automated S3</span>
            {s3Status === 'SYNCED' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
          </button>
        </div>

        {/* TAB 1 & 2: MANUAL FILE UPLOAD (SINGLE & MULTI-PART) */}
        {activeTab !== 's3' && (
          <div className="space-y-3.5">
            {/* Account Alias / Environment Tag (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                  <span>Account Name / Environment Alias</span>
                  <span className="text-[10px] font-normal text-zorvex-text-muted dark:text-zorvex-dark-text-muted">(Optional)</span>
                </label>
                <span className="text-[10px] font-mono text-zorvex-forest dark:text-zorvex-forest-highlight">
                  e.g. evital-prod
                </span>
              </div>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. evital-prod, client-staging, core-infra"
                className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/40 border border-zorvex-border dark:border-zorvex-dark-border focus:border-zorvex-forest dark:focus:border-zorvex-forest-highlight outline-none text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-muted/50 transition-colors"
              />
              <p className="mt-1 text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                Displayed alongside the detected CUR Usage Account ID for multi-account navigation.
              </p>
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
                        className="p-1 rounded-md text-zorvex-text-muted hover:text-zorvex-spike transition-colors cursor-pointer"
                        title="Remove all files"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full max-h-40 overflow-y-auto space-y-1.5 text-left mb-3 pr-1 custom-scrollbar">
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
                            className="text-zorvex-spike hover:bg-zorvex-spike/10 p-1 rounded-md transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

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
                            className="text-zorvex-spike hover:bg-zorvex-spike/10 p-1 rounded-md transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

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

            <div className="p-2.5 rounded-xl bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/40 border border-zorvex-border dark:border-zorvex-dark-border text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted flex items-start gap-2">
              <Info className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight flex-shrink-0 mt-0.5" />
              <span>
                <strong>Multi-part Ingestion:</strong> Files belonging to the same billing period are automatically pre-validated, column-aligned, deduplicated, and stitched without double-counting spend.
              </span>
            </div>
          </div>
        )}

        {/* TAB 3: AUTOMATED S3 SYNC */}
        {activeTab === 's3' && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-zorvex-forest-soft/50 via-zorvex-surface to-zorvex-surface-secondary/40 border border-zorvex-forest/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-zorvex-forest text-white flex items-center justify-center shadow-sm">
                  <Cloud className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-zorvex-forest dark:text-zorvex-forest-highlight">
                    Automated AWS S3 Bucket Ingestion
                  </h4>
                  <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                    Syncs latest daily CUR directly from your AWS billing export bucket.
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border ${
                s3Status === 'SYNCED'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
              }`}>
                {s3Status === 'SYNCED' ? '● Connected' : s3Bucket ? 'Configured' : 'Not Configured'}
              </span>
            </div>

            {s3Feedback && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                s3Feedback.type === 'success'
                  ? 'bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft border-zorvex-forest/30 text-zorvex-forest dark:text-zorvex-forest-highlight'
                  : 'bg-zorvex-spike-soft dark:bg-zorvex-spike-dark-soft border-zorvex-spike/30 text-zorvex-spike'
              }`}>
                {s3Feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{s3Feedback.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1">
                  S3 Bucket Name *
                </label>
                <input
                  type="text"
                  value={s3Bucket}
                  onChange={(e) => setS3Bucket(e.target.value)}
                  placeholder="e.g. cur-production-billing-96708"
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/40 border border-zorvex-border dark:border-zorvex-dark-border focus:border-zorvex-forest dark:focus:border-zorvex-forest-highlight outline-none text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-muted/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1">
                  AWS Region
                </label>
                <select
                  value={s3Region}
                  onChange={(e) => setS3Region(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/40 border border-zorvex-border dark:border-zorvex-dark-border focus:border-zorvex-forest dark:focus:border-zorvex-forest-highlight outline-none text-zorvex-text dark:text-zorvex-dark-text"
                >
                  <option value="us-east-1">us-east-1 (N. Virginia)</option>
                  <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                  <option value="us-west-2">us-west-2 (Oregon)</option>
                  <option value="eu-west-1">eu-west-1 (Ireland)</option>
                  <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1">
                  CUR S3 Prefix / Path
                </label>
                <input
                  type="text"
                  value={s3Prefix}
                  onChange={(e) => setS3Prefix(e.target.value)}
                  placeholder="e.g. cur-reports/daily/"
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/40 border border-zorvex-border dark:border-zorvex-dark-border focus:border-zorvex-forest dark:focus:border-zorvex-forest-highlight outline-none text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-muted/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1">
                  Account Name / Alias
                </label>
                <input
                  type="text"
                  value={s3AccountName}
                  onChange={(e) => setS3AccountName(e.target.value)}
                  placeholder="e.g. evital-prod"
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/40 border border-zorvex-border dark:border-zorvex-dark-border focus:border-zorvex-forest dark:focus:border-zorvex-forest-highlight outline-none text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-muted/40"
                />
              </div>

              {/* IAM Cross-Account Role ARN */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted">
                    AWS IAM Cross-Account Role ARN <span className="text-[10px] font-normal lowercase text-zorvex-text-muted">(optional)</span>
                  </label>
                  <span className="text-[10px] text-zorvex-forest dark:text-zorvex-forest-highlight font-mono">
                    Only for cross-account
                  </span>
                </div>
                <input
                  type="text"
                  value={s3RoleArn}
                  onChange={(e) => setS3RoleArn(e.target.value)}
                  placeholder="arn:aws:iam::123456789012:role/ZorvexCurReaderRole (Leave blank if same account / self-hosted)"
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-zorvex-secondary/40 dark:bg-zorvex-dark-secondary/40 border border-zorvex-border dark:border-zorvex-dark-border focus:border-zorvex-forest dark:focus:border-zorvex-forest-highlight outline-none text-zorvex-text dark:text-zorvex-dark-text placeholder:text-zorvex-text-muted/40"
                />
                <p className="mt-1 text-[10px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
                  Leave blank if running in the same AWS account (EC2/EKS profile is auto-inherited). For external accounts, uses secure AWS STS AssumeRole with tenant external ID.
                </p>
              </div>
            </div>

            {/* IAM Policy Accordion */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTogglePolicy}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-zorvex-secondary/30 dark:bg-zorvex-dark-secondary/30 border border-zorvex-border dark:border-zorvex-dark-border text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text cursor-pointer hover:bg-zorvex-secondary/60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                  <span>AWS IAM Least-Privilege Policy Document</span>
                </div>
                {showPolicy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showPolicy && (
                <div className="mt-2 p-3 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 text-xs font-mono relative">
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">
                      Attach to IAM Role / User for S3 CUR Read Access
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPolicy}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[10px] font-sans font-bold cursor-pointer transition-colors"
                    >
                      {policyCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{policyCopied ? 'Copied!' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="max-h-36 overflow-y-auto text-[11px] leading-relaxed custom-scrollbar whitespace-pre-wrap">
                    {policyJson}
                  </pre>
                </div>
              )}
            </div>

            {/* S3 Controls Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveS3Config}
                disabled={s3Saving || !s3Bucket.trim()}
                className="px-4 py-2 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {s3Saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Save Configuration</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerS3Sync}
                disabled={s3Syncing || !s3Bucket.trim()}
                className="px-5 py-2 rounded-clay-pill clay-button-primary text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {s3Syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Syncing AWS S3 CUR...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Latest S3 CUR Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

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

        {/* Footer Actions (For Manual Ingestion) */}
        {activeTab !== 's3' && (
          <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-zorvex-border dark:border-zorvex-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleManualUpload}
              disabled={selectedFiles.length === 0 || loading || (dataFiles.length === 0 && manifestFiles.length > 0)}
              className={`px-5 py-2 rounded-clay-pill text-xs font-black flex items-center gap-2 cursor-pointer ${
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
        )}

      </div>
    </div>
  );
}
