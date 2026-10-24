import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  Shield,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Clock,
  Globe,
  CheckCircle2,
  Lock,
  Server,
  Mail,
  Ban,
  HelpCircle
} from 'lucide-react';
import ZorvexLogo from '../common/ZorvexLogo';

export default function TermsOfServiceView() {
  useEffect(() => {
    document.title = 'Terms of Service — ZORVEX | See Beyond Spend.';
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    { id: 'acceptance', title: '1. Acceptance & Organizational Authority' },
    { id: 'services', title: '2. Description of Cloud FinOps Platform' },
    { id: 'accounts', title: '3. Accounts, Roles & Credential Security' },
    { id: 'acceptable-use', title: '4. Acceptable Use & Conduct' },
    { id: 'data-ownership', title: '5. Customer Data Ownership & Licensing' },
    { id: 'intellectual-property', title: '6. Proprietary Rights & IP' },
    { id: 'financial-disclaimer', title: '7. Cost Intelligence Disclaimer' },
    { id: 'liability', title: '8. Limitation of Liability' },
    { id: 'indemnity', title: '9. Mutual Indemnification' },
    { id: 'termination', title: '10. Termination & Data Portability' },
    { id: 'governing-law', title: '11. Governing Law & Jurisdiction' },
    { id: 'contact', title: '12. Legal Notices & Inquiries' }
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
              to="/privacy"
              className="text-xs font-bold text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary hover:text-zorvex-forest dark:hover:text-zorvex-forest-highlight transition-colors"
            >
              Privacy Policy
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
              <Scale className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest font-black text-zorvex-forest dark:text-zorvex-forest-highlight bg-zorvex-forest/10 dark:bg-zorvex-forest/20 px-2 py-0.5 rounded-full">
                Enterprise Agreement
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight mt-1">
                Terms of Service
              </h1>
            </div>
          </div>
          <p className="text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary leading-relaxed">
            These Terms of Service (&ldquo;Agreement&rdquo;) govern your organization&rsquo;s access to and use of the ZORVEX Cloud Financial Operations platform, analytics engines, APIs, and documentation.
          </p>
          <div className="mt-4 pt-4 border-t border-zorvex-border/50 dark:border-zorvex-dark-border/50 flex flex-wrap items-center justify-between text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Last Revised: <strong>October 20, 2026</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" />
              <span>Corporate Entity: <strong>ZORVEX Technologies, Inc.</strong></span>
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
          <section id="acceptance" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                1. Acceptance &amp; Organizational Authority
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                By accessing, registering an account, or uploading telemetry datasets to ZORVEX, you acknowledge that you have read, understood, and agree to be legally bound by this Agreement.
              </p>
              <p>
                If you are entering into this Agreement on behalf of a corporation, LLC, or other legal entity, you represent and warrant that you have full organizational authority to bind that entity to these Terms.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="services" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Server className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                2. Description of Cloud FinOps Platform
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                ZORVEX provides cloud cost intelligence software that parses AWS Cost &amp; Usage Reports (CUR), evaluates multi-dimensional spending trends, calculates unit economics metrics, detects billing anomalies, and generates executive C-suite reports.
              </p>
              <p>
                ZORVEX is designed for local and private enterprise deployments, maintaining low-latency analytics through PostgreSQL 18 and Redis caching engines.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section id="accounts" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Lock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                3. Accounts, Roles &amp; Credential Security
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                Users must provide authentic and up-to-date registration information. Each authorized user must maintain individual credentials:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>You are solely responsible for safeguarding your authentication tokens and passwords.</li>
                <li>Sharing single credentials across multiple team members is prohibited. Enterprise role-based access control (RBAC) tiers (Admin, FinOps Analyst, Viewer) must be utilized.</li>
                <li>You must immediately notify <a href="mailto:security@zorvex.io" className="text-zorvex-forest underline font-mono">security@zorvex.io</a> upon discovering any unauthorized session or security compromise.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="acceptable-use" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Ban className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                4. Acceptable Use &amp; Conduct
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>You agree not to engage in any of the following prohibited activities:</p>
              <ul className="space-y-1.5 pl-2">
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">&times;</span>
                  <span>Attempting to decompile, reverse engineer, or disassemble the proprietary analytical and anomaly detection algorithms of ZORVEX.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">&times;</span>
                  <span>Uploading files containing malware, viruses, trojans, or formula injection attack payloads targeted at spreadsheet engines.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold">&times;</span>
                  <span>Circumventing API rate limits, authentication gates, or access restriction tokens.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section id="data-ownership" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Shield className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                5. Customer Data Ownership &amp; Licensing
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                <strong>You retain 100% full ownership, title, and intellectual property rights</strong> in all AWS CUR files, cost figures, and enterprise metadata uploaded to ZORVEX.
              </p>
              <p>
                You grant ZORVEX a limited, non-exclusive license solely to process, calculate, display, and export your cost telemetry for your workspace members during the term of your usage. ZORVEX does not sell your cloud billing telemetry to third parties or use it to train public models.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section id="intellectual-property" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <FileText className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                6. Proprietary Rights &amp; IP
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                The ZORVEX name, logo, &ldquo;See Beyond Spend&rdquo; trademark, the Clay user interface architecture, backend optimization pipelines, and all related documentation are the exclusive intellectual property of ZORVEX Technologies, Inc. All rights not expressly granted herein are reserved.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="financial-disclaimer" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                7. Cost Intelligence Disclaimer
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p className="p-3 rounded-lg bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
                <strong>Important Notice:</strong> ZORVEX provides automated financial analysis, anomaly detection, and cloud optimization heuristics for diagnostic and informational purposes only. ZORVEX does not provide formal certified accounting, tax, or legal advisory services.
              </p>
              <p>
                You are solely responsible for verifying AWS billing line items, commitment plans (Reserved Instances, Savings Plans), and evaluating infrastructure alterations prior to cloud production modifications.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section id="liability" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Scale className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                8. Limitation of Liability
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL ZORVEX TECHNOLOGIES, INC., ITS DIRECTORS, EMPLOYEES, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES (INCLUDING LOSS OF PROFITS, DATA LOSS, OR BUSINESS INTERRUPTION) ARISING OUT OF OR IN CONNECTION WITH THE USE OR INABILITY TO USE THE SERVICE.
              </p>
              <p>
                IN ALL CIRCUMSTANCES, OUR AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL BE STRICTLY LIMITED TO THE GREATER OF $100 USD OR THE TOTAL AMOUNT ACTUALLY PAID BY YOU TO ZORVEX IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section id="indemnity" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Shield className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                9. Mutual Indemnification
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                You agree to defend, indemnify, and hold harmless ZORVEX from and against any third-party claims, liabilities, damages, and expenses (including reasonable attorneys&rsquo; fees) arising from your breach of this Agreement, violation of applicable law, or unlawful data uploaded to the system.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section id="termination" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Clock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                10. Termination &amp; Data Portability
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                Either party may terminate this agreement at any time by closing the account. Upon termination:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Your right to access the dashboard and APIs terminates immediately.</li>
                <li>You may request an export of your parsed cost data within thirty (30) days of termination.</li>
                <li>After 30 days, all analytical partitions and associated user identifiers are permanently scrubbed from our systems.</li>
              </ul>
            </div>
          </section>

          {/* Section 11 */}
          <section id="governing-law" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Globe className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                11. Governing Law &amp; Jurisdiction
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law principles. Any dispute arising out of or relating to this Agreement shall be subject to the exclusive jurisdiction of the state and federal courts located in New Castle County, Delaware.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section id="contact" className="clay-card p-6 sm:p-8 border border-zorvex-border dark:border-zorvex-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 flex items-center justify-center text-zorvex-forest dark:text-zorvex-forest-highlight">
                <Mail className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-black text-zorvex-text dark:text-zorvex-dark-text">
                12. Legal Notices &amp; Inquiries
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary space-y-3 leading-relaxed">
              <p>
                All legal notices, questions regarding this Agreement, or organizational contract requests should be directed to:
              </p>
              <div className="p-4 rounded-xl bg-zorvex-surface-secondary/40 dark:bg-zorvex-dark-surface-secondary/40 border border-zorvex-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-zorvex-text dark:text-zorvex-dark-text">ZORVEX Corporate Legal Counsel</div>
                  <div className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted">Direct Email: <a href="mailto:legal@zorvex.io" className="text-zorvex-forest underline font-mono">legal@zorvex.io</a></div>
                </div>
                <a
                  href="mailto:legal@zorvex.io"
                  className="px-4 py-2 rounded-clay-pill clay-button-primary text-xs font-bold"
                >
                  Contact Legal
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-12 pt-6 border-t border-zorvex-border dark:border-zorvex-dark-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
          <Link
            to="/privacy"
            className="hover:text-zorvex-forest dark:hover:text-zorvex-forest-highlight font-semibold flex items-center gap-1.5"
          >
            <span>&larr;</span>
            <span>View Privacy Policy</span>
          </Link>
          <div className="text-center sm:text-right text-[11px] text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
            &copy; 2026 ZORVEX Inc. All rights reserved.
          </div>
        </div>
      </main>
    </div>
  );
}
