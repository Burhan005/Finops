import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFoundView() {
  useEffect(() => {
    document.title = '404 Page Not Found — ZORVEX | See Beyond Spend.';
  }, []);

  return (
    <div className="min-h-screen bg-zorvex-canvas dark:bg-zorvex-dark-canvas flex items-center justify-center p-6 text-center">
      <div className="clay-card max-w-md w-full p-8 shadow-clay-lg border border-zorvex-border dark:border-zorvex-dark-border animate-fade-in">
        
        <div className="w-16 h-16 rounded-3xl bg-zorvex-spike-soft dark:bg-zorvex-spike-dark-soft text-zorvex-spike flex items-center justify-center mx-auto mb-4 shadow-inner">
          <Compass className="w-8 h-8 stroke-[2.2]" />
        </div>

        <h1 className="text-3xl font-black text-zorvex-text dark:text-zorvex-dark-text tracking-tight font-mono">
          404
        </h1>
        <h2 className="text-sm font-extrabold text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-1 uppercase tracking-wider">
          Telemetry Route Not Found
        </h2>

        <p className="text-xs text-zorvex-text-muted dark:text-zorvex-dark-text-muted mt-3 leading-relaxed">
          The requested cloud intelligence view does not exist or has been relocated within the ZORVEX platform.
        </p>

        <div className="mt-6">
          <Link
            to="/app/overview"
            className="inline-flex items-center gap-2 px-5 py-2.5 clay-button-primary text-xs font-black cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Overview</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
