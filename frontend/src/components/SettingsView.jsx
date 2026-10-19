import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Settings, 
  Cloud, 
  Database, 
  KeyRound, 
  Info,
  Server,
  User,
  LogIn,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileText,
  Printer,
  X,
  Sparkles
} from 'lucide-react';
import ClayDropdown from './common/ClayDropdown';
import { api } from '../services/api';

export default function SettingsView({ activeDataset, currentUser, onRefreshDatasets, onSelectDataset }) {
  const [currency, setCurrency] = useState('USD');
  const [awsRoleArn, setAwsRoleArn] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('us-east-1');
  const [s3Prefix, setS3Prefix] = useState('');
  const [s3AccountName, setS3AccountName] = useState('');
  const [externalId] = useState('finops-clay-94281');
  
  const [s3Status, setS3Status] = useState('IDLE');
  const [s3Message, setS3Message] = useState('');
  const [s3Loading, setS3Loading] = useState(false);
  const [s3Feedback, setS3Feedback] = useState(null);

  // Agency White-Labeling Branding state
  const [agencyName, setAgencyName] = useState('Cloud FinOps Advisory Partners');
  const [clientName, setClientName] = useState('Enterprise Client Organization');
  const [preparedBy, setPreparedBy] = useState('Burhan Kapasi, Principal FinOps Lead');
  const [contactEmail, setContactEmail] = useState('cloudops@finopsclay.io');
  const [confidentialityNote, setConfidentialityNote] = useState('Strictly Confidential — Prepared for Executive Boardroom Review');
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandFeedback, setBrandFeedback] = useState(null);
  const [showBoardroomPreview, setShowBoardroomPreview] = useState(false);

  const userName = currentUser?.name || 'Burhan Kapasi';
  const userEmail = currentUser?.email || 'cloudops@finopsclay.io';

  const currencyOptions = [
    { value: 'USD', label: 'USD ($) — United States Dollar' },
    { value: 'INR', label: 'INR (₹) — Indian Rupee' },
    { value: 'EUR', label: 'EUR (€) — Euro' },
    { value: 'GBP', label: 'GBP (£) — British Pound' }
  ];

  const regionOptions = [
    { value: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
    { value: 'ap-south-1', label: 'ap-south-1 (Mumbai)' },
    { value: 'us-west-2', label: 'us-west-2 (Oregon)' },
    { value: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
    { value: 'ap-southeast-1', label: 'ap-southeast-1 (Singapore)' }
  ];

  // Load existing S3 & Branding configuration from backend DB
  useEffect(() => {
    api.getS3Config()
      .then((cfg) => {
        if (cfg.configured) {
          setS3Bucket(cfg.bucket_name || '');
          setS3Region(cfg.region || 'us-east-1');
          setS3Prefix(cfg.prefix || '');
          setAwsRoleArn(cfg.role_arn || '');
          setS3AccountName(cfg.account_name || '');
          setS3Status(cfg.last_status || 'CONFIGURED');
          setS3Message(cfg.last_message || '');
        }
      })
      .catch((err) => console.error('Could not load S3 config', err));

    api.getBranding()
      .then((b) => {
        if (b) {
          setAgencyName(b.agency_name || 'Cloud FinOps Advisory Partners');
          setClientName(b.client_name || 'Enterprise Client Organization');
          setPreparedBy(b.prepared_by || 'Burhan Kapasi, Principal FinOps Lead');
          setContactEmail(b.contact_email || 'cloudops@finopsclay.io');
          setConfidentialityNote(b.confidentiality_note || 'Strictly Confidential — Prepared for Executive Boardroom Review');
        }
      })
      .catch((err) => console.error('Could not load branding', err));
  }, []);

  const handleSaveBranding = async () => {
    setBrandSaving(true);
    setBrandFeedback(null);
    try {
      await api.saveBranding({
        agency_name: agencyName,
        client_name: clientName,
        prepared_by: preparedBy,
        contact_email: contactEmail,
        confidentiality_note: confidentialityNote
      });
      setBrandFeedback({ type: 'success', text: 'Custom agency branding saved. Executive PDF & Excel reports will now carry this header and signature.' });
    } catch (err) {
      setBrandFeedback({ type: 'error', text: err.message || 'Failed to save branding' });
    } finally {
      setBrandSaving(false);
    }
  };

  const handleSaveAndSync = async () => {
    if (!s3Bucket.trim()) {
      setS3Feedback({ type: 'error', text: 'Please specify your S3 CUR delivery bucket name.' });
      return;
    }

    setS3Loading(true);
    setS3Feedback(null);
    try {
      await api.saveS3Config({
        bucket_name: s3Bucket.trim(),
        region: s3Region,
        prefix: s3Prefix.trim(),
        role_arn: awsRoleArn.trim(),
        account_name: s3AccountName.trim()
      });

      const syncResult = await api.triggerS3Sync();
      setS3Status('SYNCED');
      setS3Message(syncResult.message);
      setS3Feedback({ type: 'success', text: syncResult.message });

      if (onRefreshDatasets) {
        await onRefreshDatasets();
      }
      if (syncResult.filename && onSelectDataset) {
        await onSelectDataset(syncResult.filename);
      }
    } catch (err) {
      setS3Feedback({ type: 'error', text: err.message || 'S3 validation failed' });
    } finally {
      setS3Loading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="clay-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-2 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight">
            <Settings className="w-5 h-5 stroke-[2.5]" />
          </span>
          <h2 className="text-xl font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
            Platform Settings & AWS Cloud Sync
          </h2>
        </div>
        <p className="text-xs text-zorvex-text dark:text-zorvex-dark-text-muted">
          Manage your cloud telemetry ingestion, automated S3 synchronization, and multi-tenant preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: AWS Cloud Connection & Ingestion */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="clay-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zorvex-border dark:border-zorvex-dark-border">
              <div className="flex items-center gap-2.5">
                <Cloud className="w-5 h-5 text-zorvex-spike" />
                <h3 className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                  AWS S3 Automated CUR Synchronization
                </h3>
              </div>
              <span className={`px-3 py-1 rounded-clay-pill text-xs font-extrabold border ${
                s3Status === 'SYNCED'
                  ? 'bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight border-zorvex-forest/30'
                  : 'bg-clay-surface text-zorvex-text dark:text-zorvex-dark-text-muted border border-zorvex-border dark:border-zorvex-dark-border'
              }`}>
                {s3Status === 'SYNCED' ? '● Live S3 Sync Active' : 'Offline / Standalone Mode'}
              </span>
            </div>

            {/* Status Banner */}
            <div className="p-4 rounded-2xl bg-zorvex-forest-soft/50 dark:bg-zorvex-forest-dark-soft/40 border border-zorvex-forest/20 text-xs text-zorvex-text dark:text-zorvex-dark-text space-y-2">
              <div className="flex items-center gap-2 font-extrabold text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Info className="w-4 h-4" />
                <span>Automated Zero-Touch Ingestion</span>
              </div>
              <p className="text-[11px] text-zorvex-text dark:text-zorvex-dark-text-muted leading-relaxed">
                Connect your AWS Cost and Usage Report (CUR) delivery bucket directly. The platform automatically polls, decompresses, and runs hourly/daily variance analytics without requiring manual report downloads.
              </p>
            </div>

            {/* Feedback alert */}
            {s3Feedback && (
              <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                s3Feedback.type === 'success'
                  ? 'bg-clay-sage-light text-zorvex-forest dark:text-zorvex-forest-highlight border border-clay-sage/30'
                  : 'bg-zorvex-spike-soft dark:bg-zorvex-spike-dark-soft text-zorvex-spike border border-clay-coral/30'
              }`}>
                {s3Feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{s3Feedback.text}</span>
              </div>
            )}

            {/* S3 Setup Form */}
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="s3-bucket-name" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1.5">
                    S3 CUR Delivery Bucket Name
                  </label>
                  <input
                    id="s3-bucket-name"
                    name="s3Bucket"
                    aria-label="S3 CUR Delivery Bucket Name"
                    type="text"
                    placeholder="e.g. cur-report-poc-96708"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    className="w-full px-4 py-2.5 clay-input text-xs font-mono text-zorvex-text dark:text-zorvex-dark-text"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1.5">
                    AWS Region
                  </label>
                  <ClayDropdown
                    options={regionOptions}
                    value={s3Region}
                    onChange={setS3Region}
                    width="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="s3-prefix-path" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1.5">
                    CUR S3 Prefix / Path (Optional)
                  </label>
                  <input
                    id="s3-prefix-path"
                    name="s3Prefix"
                    aria-label="CUR S3 Prefix or Path"
                    type="text"
                    placeholder="e.g. cur/"
                    value={s3Prefix}
                    onChange={(e) => setS3Prefix(e.target.value)}
                    className="w-full px-4 py-2.5 clay-input text-xs font-mono text-zorvex-text dark:text-zorvex-dark-text"
                  />
                </div>

                <div>
                  <label htmlFor="security-external-id" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1.5">
                    Security External ID
                  </label>
                  <input
                    id="security-external-id"
                    name="externalId"
                    aria-label="Security External ID"
                    type="text"
                    readOnly
                    value={externalId}
                    className="w-full px-4 py-2.5 clay-input text-xs font-mono bg-clay-surface/50 text-zorvex-text dark:text-zorvex-dark-text-muted cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="s3-account-name" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1.5">
                  Account / Dataset Display Name (Optional)
                </label>
                <input
                  id="s3-account-name"
                  name="s3AccountName"
                  aria-label="Account or Dataset Display Name"
                  type="text"
                  placeholder="e.g. POC AWS Account (Leave blank to use bucket name)"
                  value={s3AccountName}
                  onChange={(e) => setS3AccountName(e.target.value)}
                  className="w-full px-4 py-2.5 clay-input text-xs font-mono text-zorvex-text dark:text-zorvex-dark-text"
                />
                <span className="block text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-muted mt-1">
                  Custom label shown in the top navigation dataset selector and executive reports. If left blank, defaults to bucket name.
                </span>
              </div>

              <div>
                <label htmlFor="aws-role-arn" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1.5">
                  Cross-Account IAM Read-Only Role ARN (Optional)
                </label>
                <input
                  id="aws-role-arn"
                  name="awsRoleArn"
                  aria-label="Cross-Account IAM Read-Only Role ARN"
                  type="text"
                  placeholder="Leave blank (Not needed with IAM Roles Anywhere)"
                  value={awsRoleArn}
                  onChange={(e) => setAwsRoleArn(e.target.value)}
                  className="w-full px-4 py-2.5 clay-input text-xs font-mono text-zorvex-text dark:text-zorvex-dark-text"
                />
                <span className="block text-[10px] text-zorvex-text-secondary dark:text-zorvex-dark-text-muted mt-1">
                  Leave completely blank when using IAM Roles Anywhere / local certificate authentication.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleSaveAndSync}
                  disabled={s3Loading}
                  className="px-6 py-2.5 rounded-clay-pill text-xs font-extrabold clay-button-primary flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${s3Loading ? 'animate-spin' : ''}`} />
                  <span>{s3Loading ? 'Validating S3 Bucket...' : 'Save & Test S3 Sync'}</span>
                </button>

                {s3Status === 'SYNCED' && (
                  <span className="text-xs font-bold text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Bucket Verified</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Agency White-Labeling & Client Branding Card */}
          <div className="clay-card p-6 space-y-6">
            <div className="flex items-start justify-between pb-4 border-b border-zorvex-border dark:border-zorvex-dark-border">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft text-zorvex-forest dark:text-zorvex-forest-highlight shadow-inner">
                  <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                    Agency White-Labeling & Client Branding
                  </h3>
                  <p className="text-xs text-zorvex-text dark:text-zorvex-dark-text-muted dark:text-clay-dark-text-muted">
                    Stamp your consultancy agency name, architect sign-off, and client organization onto Boardroom PDF & Excel briefs.
                  </p>
                </div>
              </div>
            </div>

            {/* Educational White-Labeling Explainer for Commercial Sales */}
            <div className="p-4 rounded-xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft border border-zorvex-forest/25 text-xs">
              <div className="flex items-center gap-2 font-black text-zorvex-forest dark:text-zorvex-forest-highlight mb-1">
                <Sparkles className="w-4 h-4 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                <span>What is Agency White-Labeling?</span>
              </div>
              <p className="text-zorvex-text-muted dark:text-zorvex-dark-text-muted leading-relaxed">
                White-labeling allows you to resell this FinOps platform under <strong>your own agency brand</strong> to enterprise clients paying you <strong>₹30,000 – ₹50,000/month</strong> ($400 - $600/mo). All boardroom presentation memos, PDF briefs, and Excel audits will carry your company header, your lead architect sign-off, and your client's name without third-party marks.
              </p>
            </div>

            {brandFeedback && (
              <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                brandFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
              }`}>
                {brandFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{brandFeedback.text}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="agency-name" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted mb-1.5">
                    Consultancy / Agency Name
                  </label>
                  <input
                    id="agency-name"
                    name="agencyName"
                    aria-label="Consultancy or Agency Name"
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="e.g. Zorvex FinOps Consulting"
                    className="w-full px-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text"
                  />
                </div>

                <div>
                  <label htmlFor="client-organization-name" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted mb-1.5">
                    Client Organization Name
                  </label>
                  <input
                    id="client-organization-name"
                    name="clientName"
                    aria-label="Client Organization Name"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Acme Corp Technologies"
                    className="w-full px-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prepared-by-architect" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted mb-1.5">
                    Lead FinOps Architect / Sign-Off
                  </label>
                  <input
                    id="prepared-by-architect"
                    name="preparedBy"
                    aria-label="Lead FinOps Architect Sign-Off"
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    placeholder="e.g. Burhan Kapasi, Principal FinOps Lead"
                    className="w-full px-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text"
                  />
                </div>

                <div>
                  <label htmlFor="executive-contact-email" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted mb-1.5">
                    Contact Email (Executive Brief)
                  </label>
                  <input
                    id="executive-contact-email"
                    name="contactEmail"
                    aria-label="Executive Brief Contact Email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="cloudops@finopsclay.io"
                    className="w-full px-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confidentiality-note" className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted mb-1.5">
                  Confidentiality Classification
                </label>
                <input
                  id="confidentiality-note"
                  name="confidentialityNote"
                  aria-label="Confidentiality Classification"
                  type="text"
                  value={confidentialityNote}
                  onChange={(e) => setConfidentialityNote(e.target.value)}
                  placeholder="Strictly Confidential — Prepared for Executive Boardroom Review"
                  className="w-full px-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text"
                />
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleSaveBranding}
                  disabled={brandSaving}
                  className="px-6 py-2.5 rounded-clay-pill text-xs font-extrabold clay-button-primary flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{brandSaving ? 'Saving...' : 'Save Custom Branding'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBoardroomPreview(true)}
                  className="px-5 py-2.5 rounded-clay-pill text-xs font-extrabold clay-button border border-zorvex-forest/30 text-zorvex-forest dark:text-zorvex-forest-highlight flex items-center gap-2 cursor-pointer hover:bg-zorvex-forest/10"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Preview Executive Boardroom Memo</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right 1 Col: Display & Environment */}
        <div className="space-y-6">
          
          <div className="clay-card p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text pb-2 border-b border-zorvex-border dark:border-zorvex-dark-border">
              Display Preferences
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text-muted mb-1.5">
                Reporting Currency
              </label>
              <ClayDropdown
                options={currencyOptions}
                value={currency}
                onChange={setCurrency}
                width="w-full"
              />
            </div>
          </div>

          <div className="clay-card p-6 space-y-3">
            <div className="flex items-center gap-2.5 pb-2 border-b border-zorvex-border dark:border-zorvex-dark-border">
              <Server className="w-5 h-5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
              <h3 className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                Platform Telemetry
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zorvex-text dark:text-zorvex-dark-text-muted">Active Dataset:</span>
                <span className="font-mono font-bold text-zorvex-forest dark:text-zorvex-forest-highlight truncate max-w-[150px]">
                  {activeDataset}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zorvex-text dark:text-zorvex-dark-text-muted">Ingestion Engine:</span>
                <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">Universal CUR 2.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zorvex-text dark:text-zorvex-dark-text-muted">Attribution Engine:</span>
                <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text">Zorvex Heuristics</span>
              </div>
            </div>
          </div>

          <div className="clay-card p-6 space-y-3">
            <div className="flex items-center gap-2.5 pb-2 border-b border-zorvex-border dark:border-zorvex-dark-border">
              <User className="w-5 h-5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
              <h3 className="text-sm font-extrabold text-zorvex-text dark:text-zorvex-dark-text">
                Active Organization
              </h3>
            </div>

            <div className="space-y-1 text-xs">
              <div className="font-extrabold text-zorvex-text dark:text-zorvex-dark-text">{userName}</div>
              <div className="text-[11px] text-zorvex-text dark:text-zorvex-dark-text-muted">{userEmail}</div>
              <div className="text-[10px] uppercase font-bold text-zorvex-forest dark:text-zorvex-forest-highlight mt-2">
                Enterprise Cloud Ops Plan
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Executive Boardroom Memo Modal (Printable / PDF-Ready) */}
      {showBoardroomPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="clay-card w-full max-w-3xl bg-zorvex-surface dark:bg-zorvex-dark-surface border border-zorvex-border dark:border-zorvex-dark-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Controls Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-secondary dark:bg-zorvex-dark-secondary">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-zorvex-forest dark:text-zorvex-forest-highlight" />
                <span className="text-xs font-black uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text">
                  Executive Boardroom Memo Preview
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="clay-button-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-xs font-black cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Export PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBoardroomPreview(false)}
                  aria-label="Close memo preview"
                  className="p-1.5 rounded-lg hover:bg-zorvex-secondary dark:hover:bg-zorvex-dark-secondary text-zorvex-text-muted hover:text-zorvex-text dark:hover:text-zorvex-dark-text transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Memo Content */}
            <div className="p-8 overflow-y-auto space-y-6 text-zorvex-text dark:text-zorvex-dark-text bg-white dark:bg-zorvex-dark-surface print:p-0 print:m-0">
              
              {/* Memo Header & Confidentiality */}
              <div className="border-b-2 border-zorvex-border dark:border-zorvex-dark-border pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black tracking-tight uppercase text-zorvex-forest dark:text-zorvex-forest-highlight">
                    {agencyName}
                  </h1>
                  <p className="text-xs font-bold text-zorvex-text-muted dark:text-zorvex-dark-text-muted uppercase tracking-widest mt-0.5">
                    Cloud Financial Architecture & Governance Advisory
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    {confidentialityNote}
                  </span>
                  <div className="text-xs font-mono text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-1">
                    Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Memo Meta Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-zorvex-secondary dark:bg-zorvex-dark-secondary/50 border border-zorvex-border dark:border-zorvex-dark-border text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted block">
                    Target Enterprise
                  </span>
                  <strong className="text-zorvex-text dark:text-zorvex-dark-text font-semibold">{clientName}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted block">
                    Lead FinOps Architect
                  </span>
                  <strong className="text-zorvex-text dark:text-zorvex-dark-text font-semibold">{preparedBy}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted block">
                    Contact Email
                  </span>
                  <span className="text-zorvex-text-muted dark:text-zorvex-dark-text-muted font-mono">{contactEmail}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted block">
                    Audit Verification
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">AWS CUR Unblended</span>
                </div>
              </div>

              {/* Executive Summary Narrative */}
              <div className="space-y-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-zorvex-text dark:text-zorvex-dark-text">
                  1. Executive Brief & Commercial Thesis
                </h2>
                <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted leading-relaxed">
                  This advisory brief summarizes the findings of the deep-tier FinOps telemetry analysis performed on <strong>{clientName}</strong>'s AWS cloud infrastructure. Through automated Cost and Usage Report (CUR) heuristic modeling and baseline hour normalization, our architecture team has isolated recurring waste and formulated a risk-free commitment strategy.
                </p>
              </div>

              {/* Key Financial Impact Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-secondary dark:bg-zorvex-dark-secondary">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted block mb-1">
                    Telemetry Source
                  </span>
                  <div className="text-sm font-bold font-mono text-zorvex-text dark:text-zorvex-dark-text truncate">
                    {activeDataset || 'AWS CUR Telemetry'}
                  </div>
                  <span className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-1 block">Full line-item audit</span>
                </div>

                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
                    Actionable Monthly Savings
                  </span>
                  <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                    Remediable Waste Found
                  </div>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1 block font-medium">
                    Zero disruption to production SLAs
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-zorvex-forest/25 bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zorvex-forest dark:text-zorvex-forest-highlight block mb-1">
                    Client Retainer Value
                  </span>
                  <div className="text-lg font-black font-mono text-zorvex-forest dark:text-zorvex-forest-highlight">
                    6x – 10x ROI
                  </div>
                  <span className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-1 block font-medium">
                    Platform cost fully offset
                  </span>
                </div>
              </div>

              {/* Sign-off & Authority Stamp */}
              <div className="pt-6 border-t border-zorvex-border dark:border-zorvex-dark-border flex items-center justify-between text-xs">
                <div>
                  <p className="font-extrabold text-zorvex-text dark:text-zorvex-dark-text">{preparedBy}</p>
                  <p className="text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">{agencyName}</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 rounded-full bg-zorvex-secondary dark:bg-zorvex-dark-secondary border border-zorvex-border dark:border-zorvex-dark-border font-mono text-[10px] font-bold text-zorvex-text dark:text-zorvex-dark-text">
                    AUTHENTICATED FINOPS AUDIT
                  </span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
