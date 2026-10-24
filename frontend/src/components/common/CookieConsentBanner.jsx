import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X, Shield, ChevronDown, ChevronUp, Check } from 'lucide-react';

const CONSENT_KEY = 'finops_cookie_consent';

const essentialItems = [
  {
    label: 'Authentication token (JWT)',
    description: 'Keeps you securely signed in across sessions.',
  },
  {
    label: 'Theme preference',
    description: 'Remembers your light or dark mode selection.',
  },
  {
    label: 'Currency preference',
    description: 'Stores your preferred display currency for cost data.',
  },
  {
    label: 'Cookie consent status',
    description: 'Records your cookie preference so we don\u2019t ask again.',
  },
];

function CookieConsentBanner() {
  const [consentGiven, setConsentGiven] = useState(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored === 'accepted' || stored === 'essential_only';
  });
  const [isVisible, setIsVisible] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Slide-up after a short delay so the page renders first
  useEffect(() => {
    if (consentGiven) return;
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, [consentGiven]);

  const handleConsent = (value) => {
    setIsExiting(true);
    setIsVisible(false);
    setTimeout(() => {
      localStorage.setItem(CONSENT_KEY, value);
      setConsentGiven(true);
    }, 300);
  };

  // Already consented — render nothing
  if (consentGiven) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-in-out ${
        isVisible && !isExiting ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {/* Accent border */}
      <div className="h-[2px] bg-gradient-to-r from-zorvex-forest via-emerald-500 to-zorvex-forest" />

      {/* Banner body */}
      <div className="backdrop-blur-xl bg-white/95 dark:bg-zorvex-dark-surface/95 border-t border-zorvex-border dark:border-zorvex-dark-border shadow-2xl">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          {/* Close button */}
          <button
            type="button"
            onClick={() => handleConsent('essential_only')}
            className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            aria-label="Close and accept essential cookies only"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header row */}
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zorvex-forest/10 dark:bg-zorvex-forest/20 text-zorvex-forest">
              <Cookie className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Cookie Preferences
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                ZORVEX uses essential cookies and local storage to provide secure
                authentication, remember your preferences, and deliver the best
                experience. We do not use any third-party tracking or advertising
                cookies.{' '}
                <Link
                  to="/privacy"
                  className="inline-flex items-center gap-1 font-medium text-zorvex-forest hover:text-emerald-700 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>

          {/* Expandable details */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-expanded={detailsOpen}
            >
              {detailsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              View Details
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                detailsOpen ? 'mt-3 max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="rounded-xl border border-zorvex-border dark:border-zorvex-dark-border bg-gray-50/80 dark:bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Essential
                  </h3>
                  <span className="rounded-full bg-zorvex-forest/10 px-2.5 py-0.5 text-xs font-medium text-zorvex-forest">
                    Always Active
                  </span>
                </div>
                <ul className="space-y-2">
                  {essentialItems.map((item) => (
                    <li key={item.label} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {item.label}
                        </span>
                        <span className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">
                          — {item.description}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => handleConsent('essential_only')}
              className="inline-flex items-center justify-center rounded-lg border border-zorvex-border dark:border-zorvex-dark-border bg-white dark:bg-transparent px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-zorvex-forest/40 focus:ring-offset-1"
            >
              Essential Only
            </button>
            <button
              type="button"
              onClick={() => handleConsent('accepted')}
              className="clay-button-primary inline-flex items-center justify-center rounded-lg bg-zorvex-forest px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-zorvex-forest/40 focus:ring-offset-1"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CookieConsentBanner;
