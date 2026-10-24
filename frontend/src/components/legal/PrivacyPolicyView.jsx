import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Eye,
  Database,
  Lock,
  Mail,
  ArrowLeft,
  Globe,
  Clock,
  Server,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import ZorvexLogo from '../common/ZorvexLogo';

export default function PrivacyPolicyView() {
  useEffect(() => {
    document.title = 'Privacy Policy — ZORVEX | See Beyond Spend.';
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    { id: 'overview', title: '1. Architecture & Local-First Philosophy' },
    { id: 'collection', title: '2. Information We Collect' },
    { id: 'cur-data', title: '3. Cloud Cost (CUR) Data Processing' },
    { id: 'cookies', title: '4. Cookies & Local Storage' },
    { id: 'storage', title: '5. Storage, Retention & Deletion' },
    { id: 'subprocessors', title: '6. Zero Third-Party Trackers' },
    { id: 'compliance', title: '7. GDPR & CCPA Rights' },
    { id: 'security', title: '8. Security Measures' },
    { id: 'contact', title: '9. Contact & Inquiries' }
  ];

  return (
    <div className="min-h-screen bg-zorvex-canvas dark:bg-zorvex-dark-canvas text-zorvex-text dark:text-zorvex-dark-text transition-colors duration-200">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-zorvex-dark-surface/80 border-b border-zorvex-border dark:border-zorvex-dark-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ZorvexLogo size="md" showTagline={false} />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/terms"
              className="text-xs font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-forest dark:hover:text-zorvex-forest-highlight transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-clay-pill bg-zorvex-forest/10 dark:bg-zorvex-forest/20 text-zorvex-forest dark:text-zorvex-forest-highlight text-xs font-extrabold hover:bg-zorvex-forest/20 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Title Header Card */}
        <div className="clay-card p-6 sm:p-10 mb-8 border border-zorvex-border dark:border-zorvex-dark-border shadow-surface-raised">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-zorvex-forest-soft dark:bg-zorvex-forest-dark-soft flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight shadow-inner">
              <Shield className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest font-black text-zorvex-forest dark:text-zorvex-forest-highlight bg-zorvex-forest/10 dark:bg-zorvex-forest/20 px-2 py-0.5 rounded-full">
                Enterprise Compliance
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight mt-1">
                Privacy Policy
              </h1>
            </div>
          </div>
          <p className="text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary leading-relaxed">
            This Privacy Policy describes how ZORVEX Cloud Financial Operations (&ldquo;ZORVEX&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects, processes, and protects your enterprise financial and infrastructure telemetry.
          </p>
          <div className="mt-4 pt-4 border-t border-zorvex-border/50 dark:border-zorvex-dark-border/50 flex flex-wrap items-center justify-between text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Effective Date: <strong>October 20, 2026</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" />
              <span>Jurisdiction: <strong>Delaware, USA / Global GDPR Compliant</strong></span>
            </div>
          </div>
        </div>

        {/* Quick Jump Table of Contents */}
        <nav aria-label="Table of contents" className="clay-card p-5 mb-8 border border-zorvex-border/70 dark:border-zorvex-dark-border/70">
          <h2 className="text-xs font-black uppercase tracking-wider text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mb-3 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-zorvex-forest" />
            <span>Table of Contents</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {sections.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-forest dark:hover:text-zorvex-forest-highlight hover:underline transition-colors flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-zorvex-forest/60"></span>
                <span>{sec.title}</span>
              </a>
            ))}
          </div>
        </nav>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Section 1 */}
          <section id="overview" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Server className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                1. Architecture &amp; Local-First Philosophy
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                ZORVEX is engineered around a <strong>privacy-first, local-orchestrated architecture</strong>. Unlike multi-tenant third-party SaaS platforms that siphon proprietary infrastructure billing data to public clouds, ZORVEX processes your AWS Cost and Usage Reports (CUR) in your isolated workspace environments.
              </p>
              <p>
                Your cloud spending figures, account identifiers, resource IDs, and workload tags are kept inside strictly guarded analytical boundaries. We do not sell, trade, or monetize your financial or cloud workload telemetry.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="collection" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Eye className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                2. Information We Collect
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>We collect and handle minimal data necessary to provide accurate FinOps telemetry:</p>
              <ul className="space-y-2 pl-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-zorvex-forest shrink-0 mt-0.5" />
                  <span><strong>Account Information:</strong> Name, work email address, hashed passwords (bcrypt salted), organization name, and role tier.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-zorvex-forest shrink-0 mt-0.5" />
                  <span><strong>Cloud Cost Data (CUR):</strong> Uploaded AWS CUR CSV/Parquet files including usage start dates, line item descriptions, unblended/net costs, pricing units, and service names.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-zorvex-forest shrink-0 mt-0.5" />
                  <span><strong>Diagnostic System Logs:</strong> In-memory session markers, API endpoint response times, and error logs stored locally for platform performance and diagnostic integrity.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section id="cur-data" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Database className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                3. Cloud Cost (CUR) Data Processing
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                When you upload an AWS Cost &amp; Usage Report:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Files are parsed in a secure streaming pipeline with sanitization against formula injection and malicious payloads.</li>
                <li>Data is indexed inside your enterprise PostgreSQL and Redis analytical cache.</li>
                <li>Cost metrics are aggregated for day-over-day benchmark comparison, unit economics calculations, and budget variance detection.</li>
                <li>Your financial telemetry is <strong>never</strong> shared with public foundation AI training corpora.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="cookies" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Lock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                4. Cookies &amp; Local Storage Practices
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                ZORVEX does not deploy third-party advertising cookies, cross-site trackers, or behavioral profiling scripts. We utilize local browser storage strictly for essential operational capabilities:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-zorvex-border dark:border-zorvex-dark-border rounded-lg overflow-hidden">
                  <thead className="bg-zorvex-surface-secondary/70 dark:bg-zorvex-dark-surface-secondary/70 text-zorvex-text dark:text-zorvex-dark-text font-bold">
                    <tr>
                      <th className="p-2.5">Key</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Purpose</th>
                      <th className="p-2.5">Persistence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zorvex-border/40 dark:divide-zorvex-dark-border/40">
                    <tr>
                      <td className="p-2.5 font-mono">finops_token</td>
                      <td className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400">Essential</td>
                      <td className="p-2.5">Secure JWT bearer authentication token for authenticated API calls.</td>
                      <td className="p-2.5">Session / Logout</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono">finops_clay_theme</td>
                      <td className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400">Essential</td>
                      <td className="p-2.5">Stores chosen visual palette preference (Light vs Dark mode).</td>
                      <td className="p-2.5">Persistent</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono">finops_currency</td>
                      <td className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400">Essential</td>
                      <td className="p-2.5">Maintains active currency display toggle ($ USD vs ₹ INR).</td>
                      <td className="p-2.5">Persistent</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono">finops_cookie_consent</td>
                      <td className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400">Essential</td>
                      <td className="p-2.5">Stores your cookie consent banner decision.</td>
                      <td className="p-2.5">Persistent</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section id="storage" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Clock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                5. Storage, Retention &amp; Deletion
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                We retain account data as long as your enterprise workspace is active. You maintain total data sovereignty:
              </p>
              <ul className="space-y-1.5 list-disc pl-5">
                <li><strong>On-Demand Dataset Purge:</strong> You can purge uploaded CUR datasets anytime directly from the platform settings.</li>
                <li><strong>Account Deletion:</strong> Upon organization termination, all associated credentials and encrypted cost ledgers are purged within 30 days.</li>
                <li><strong>Automated Export:</strong> You can export full analytical reports as signed PDF documents or encrypted Excel spreadsheets at any time.</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section id="subprocessors" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Shield className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                6. Zero Third-Party Trackers
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                ZORVEX does not integrate Google Analytics, Meta Pixel, Hotjar, or advertising attribution SDKs. The only external API communication is an unauthenticated, zero-PII live currency exchange query (Open Exchange Rates) to fetch real-time USD/INR market rates for financial report conversions.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="compliance" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <FileText className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                7. GDPR &amp; CCPA Rights
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>Depending on your geographic location, you hold statutory data protection rights:</p>
              <ul className="space-y-1.5 list-disc pl-5">
                <li><strong>Right of Access &amp; Portability:</strong> Request an export of your personal identifiers and telemetry.</li>
                <li><strong>Right to Rectification:</strong> Request correction of inaccurate account records.</li>
                <li><strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> Request the irrevocable destruction of your workspace records.</li>
                <li><strong>CCPA &ldquo;Do Not Sell My Info&rdquo;:</strong> We do not sell personal or commercial telemetry. You are fully opted out by default.</li>
              </ul>
            </div>
          </section>

          {/* Section 8 */}
          <section id="security" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Lock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                8. Security Measures
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>We deploy defense-in-depth protocols across every architectural layer:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-zorvex-surface-secondary/50 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/60">
                  <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text block mb-1">Encryption at Rest</span>
                  <span className="text-xs">Database volumes encrypted via AES-256 standard cryptographic suites.</span>
                </div>
                <div className="p-3 rounded-lg bg-zorvex-surface-secondary/50 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/60">
                  <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text block mb-1">Encryption in Transit</span>
                  <span className="text-xs">All API endpoints enforce modern TLS 1.3 cryptographic ciphers.</span>
                </div>
                <div className="p-3 rounded-lg bg-zorvex-surface-secondary/50 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/60">
                  <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text block mb-1">Rate Limiting</span>
                  <span className="text-xs">FastAPI endpoints defended with distributed token-bucket rate limiting via Redis.</span>
                </div>
                <div className="p-3 rounded-lg bg-zorvex-surface-secondary/50 dark:bg-zorvex-dark-surface-secondary/50 border border-zorvex-border/60">
                  <span className="font-bold text-zorvex-text dark:text-zorvex-dark-text block mb-1">Automated Security Gates</span>
                  <span className="text-xs">Continuous CI gate verification protecting against injection and financial tampering.</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section id="contact" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Mail className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                9. Contact &amp; Inquiries
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                For data protection inquiries, audit requests, or to exercise your GDPR/CCPA statutory rights, contact our Data Protection Officer:
              </p>
              <div className="p-4 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/40 border border-zorvex-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-zorvex-text dark:text-zorvex-dark-text">ZORVEX Legal &amp; Privacy Office</div>
                  <div className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">Direct Email: <a href="mailto:privacy@zorvex.io" className="text-zorvex-forest underline font-mono">privacy@zorvex.io</a></div>
                </div>
                <a
                  href="mailto:privacy@zorvex.io"
                  className="px-4 py-2 rounded-clay-pill clay-button-primary text-xs font-bold"
                >
                  Contact Privacy Team
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-12 pt-6 border-t border-zorvex-border dark:border-zorvex-dark-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
          <Link
            to="/terms"
            className="hover:text-zorvex-forest dark:hover:text-zorvex-forest-highlight font-semibold flex items-center gap-1.5"
          >
            <span>Proceed to Terms of Service</span>
            <span>&rarr;</span>
          </Link>
          <div className="text-center sm:text-right text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
            &copy; 2026 ZORVEX Inc. All rights reserved.
          </div>
        </div>
      </main>
    </div>
  );
}
