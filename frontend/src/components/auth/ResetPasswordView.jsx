import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  ShieldCheck, 
  KeyRound
} from 'lucide-react';
import { api } from '../../services/api';
import ZorvexLogo from '../common/ZorvexLogo';
import ThemeToggle from '../common/ThemeToggle';

export default function ResetPasswordView({ darkMode, onToggleDarkMode }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [token] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Set New Password — ZORVEX | See Beyond Spend.';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain uppercase, lowercase, and a number');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPassword(email, password, token);
      setSuccess(res.message || 'Password successfully updated! Redirecting...');
      setTimeout(() => {
        navigate('/login');
      }, 1800);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative select-none selection:bg-zorvex-forest/20 selection:text-zorvex-forest">
      
      {/* Top Navigation */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between z-20">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full clay-button text-xs font-extrabold text-zorvex-text dark:text-zorvex-dark-text hover:text-zorvex-forest transition-all cursor-pointer shadow-sm"
          title="Return to Sign In"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-block text-[11px] font-extrabold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted">
            Security Update
          </span>
          {onToggleDarkMode && (
            <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} size="sm" />
          )}
        </div>
      </header>

      {/* Center Portal */}
      <main className="w-full max-w-md mx-auto my-auto py-6 sm:py-8 z-20">
        <div className="clay-card rounded-[32px] p-6 sm:p-9 border border-zorvex-border dark:border-zorvex-dark-border bg-zorvex-surface dark:bg-zorvex-dark-surface shadow-2xl relative transition-all duration-300">
          
          <div className="text-center flex flex-col items-center mb-6">
            <Link to="/" className="inline-block transition-transform hover:scale-105">
              <ZorvexLogo size="md" showWordmark={true} showTagline={false} />
            </Link>
            <h2 className="text-xl font-black text-zorvex-text dark:text-zorvex-dark-text mt-3">
              Set New Password
            </h2>
            <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-1 font-medium">
              Choose a secure master passphrase for your console.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-2xl bg-clay-coral-light border border-clay-coral/30 text-xs text-clay-coral font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="reset-email" className="block text-[10px] font-extrabold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted mb-1">
                Registered Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zorvex-text-muted dark:text-zorvex-forest-highlight absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  aria-label="Registered Email"
                  className="w-full pl-10 pr-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reset-password" className="block text-[10px] font-extrabold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted mb-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zorvex-text-muted dark:text-zorvex-forest-highlight absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  aria-label="New Password"
                  className="w-full pl-10 pr-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reset-confirm-password" className="block text-[10px] font-extrabold uppercase tracking-wider text-zorvex-text-muted dark:text-zorvex-dark-text-muted mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zorvex-text-muted dark:text-zorvex-forest-highlight absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-confirm-password"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  aria-label="Confirm Password"
                  className="w-full pl-10 pr-4 py-2.5 clay-input text-xs font-semibold text-zorvex-text dark:text-zorvex-dark-text"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 clay-button-primary text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-clay hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Update Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-zorvex-border/60 dark:border-zorvex-dark-border/60 text-center text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
            Return to{' '}
            <Link to="/login" className="font-extrabold text-zorvex-forest dark:text-zorvex-forest-highlight hover:underline">
              Sign In
            </Link>
          </div>

        </div>
      </main>

      <footer className="w-full text-center text-[11px] font-semibold text-zorvex-text-muted dark:text-zorvex-dark-text-muted py-2 z-20">
        <span>© 2026 ZORVEX Inc. • See Beyond Spend.</span>
      </footer>

    </div>
  );
}
