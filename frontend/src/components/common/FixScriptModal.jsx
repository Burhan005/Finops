import React, { useState } from 'react';
import { 
  X, 
  Terminal, 
  Copy, 
  Check, 
  FileCode, 
  Layers, 
  AlertTriangle,
  Download
} from 'lucide-react';

export default function FixScriptModal({ isOpen, onClose, recommendation }) {
  const [activeTab, setActiveTab] = useState('cli');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !recommendation) return null;

  const scripts = recommendation.scripts || {
    cli: recommendation.cli_command || '# No CLI command provided',
    boto3: '# Python Boto3 script\nimport boto3\n# Execution logic',
    terraform: '# Terraform configuration\n# Resource migration'
  };

  const currentScript = scripts[activeTab] || scripts.cli;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = activeTab === 'cli' ? 'sh' : activeTab === 'boto3' ? 'py' : 'tf';
    const filename = `finops-remediation-${recommendation.id}.${ext}`;
    const blob = new Blob([currentScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="clay-card w-full max-w-2xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-6 border-b border-zorvex-border dark:border-zorvex-dark-border flex items-start justify-between gap-4 bg-gradient-to-r from-zorvex-surface to-zorvex-secondary dark:from-zorvex-dark-surface dark:to-zorvex-dark-secondary">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 rounded-lg bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Terminal className="w-4 h-4 stroke-[2.5]" />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-zorvex-forest dark:text-zorvex-forest-highlight">
                1-Click DevOps Remediation
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border border-zorvex-forest/30">
                Save ${recommendation.monthly_savings?.toFixed(2)}/mo
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-zorvex-text dark:text-zorvex-dark-text leading-snug tracking-tight">
              {recommendation.title}
            </h3>
            <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-1">
              Automated script execution blueprint. Copy into your CI/CD pipeline or AWS terminal.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text hover:bg-zorvex-secondary dark:hover:bg-zorvex-dark-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between border-b border-zorvex-border dark:border-zorvex-dark-border">
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl clay-track">
            <button
              onClick={() => setActiveTab('cli')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'cli'
                  ? 'clay-pill-active'
                  : 'text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>AWS CLI</span>
            </button>

            <button
              onClick={() => setActiveTab('boto3')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'boto3'
                  ? 'clay-pill-active'
                  : 'text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Python (Boto3)</span>
            </button>

            <button
              onClick={() => setActiveTab('terraform')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'terraform'
                  ? 'clay-pill-active'
                  : 'text-zorvex-text-muted dark:text-zorvex-dark-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Terraform</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl clay-button text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
              title="Download script file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-clay-pill clay-button-primary text-xs font-extrabold shadow-sm transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Script</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Content Viewer */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="relative rounded-2xl bg-[#0F1611] dark:bg-[#0A0F0B] text-zorvex-forest-highlight border border-[#1E2B21] p-4 font-mono text-xs overflow-x-auto shadow-inner leading-relaxed">
            <pre className="whitespace-pre-wrap selection:bg-zorvex-forest/40">
              {currentScript}
            </pre>
          </div>

          {/* Safety Notice Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="font-bold">Safety Guideline:</strong> Review target resource IDs and run with dry-run/read-only permissions in Staging before applying destructive terminations to Production.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-secondary dark:bg-zorvex-dark-secondary flex items-center justify-between text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
          <span>Target Architecture: AWS CloudShell & Boto3 Runtime</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-clay-pill clay-button text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
