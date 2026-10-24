import React from 'react';

/**
 * DashboardSkeleton
 * Authentic Claymorphism 3.0 Skeleton Loader
 * Replaces generic spinners with LinkedIn/YouTube-style dual-tone clay shimmer.
 */
export const DashboardSkeleton = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 4 Clay KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="surface-raised rounded-2xl p-5 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-3 w-28 clay-skeleton rounded-md" />
              <div className="w-8 h-8 rounded-xl clay-skeleton" />
            </div>
            <div className="h-7 w-36 clay-skeleton rounded-lg mb-3" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 clay-skeleton rounded-full" />
              <div className="h-3 w-24 clay-skeleton rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Trajectory Chart Card Skeleton */}
      <div className="surface-raised rounded-3xl p-6 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="space-y-2">
            <div className="h-5 w-52 clay-skeleton rounded-lg" />
            <div className="h-3 w-72 clay-skeleton rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 clay-skeleton rounded-full" />
            <div className="h-8 w-16 clay-skeleton rounded-full" />
            <div className="h-8 w-16 clay-skeleton rounded-full" />
          </div>
        </div>

        {/* Debossed Chart Socket Area */}
        <div className="surface-recessed rounded-2xl p-6 h-64 flex items-end justify-between gap-3 border border-zorvex-border/30 dark:border-zorvex-dark-border/30">
          {[40, 65, 55, 80, 45, 90, 70, 85, 60, 95, 75, 88].map((h, idx) => (
            <div
              key={idx}
              className="flex-1 clay-skeleton rounded-t-lg transition-all"
              style={{ height: `${h}%`, opacity: 0.35 + (idx / 20) }}
            />
          ))}
        </div>
      </div>

      {/* Donut & Breakdown Split Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Donut Skeleton Card */}
        <div className="surface-raised rounded-3xl p-6 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 relative overflow-hidden">
          <div className="h-5 w-48 clay-skeleton rounded-lg mb-2" />
          <div className="h-3 w-64 clay-skeleton rounded-md mb-6" />

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
            {/* Donut Circle with Cockpit Socket */}
            <div className="w-44 h-44 rounded-full border-[18px] border-slate-200/60 dark:border-slate-800/60 clay-skeleton flex items-center justify-center relative">
              <div className="w-20 h-20 rounded-full surface-recessed flex flex-col items-center justify-center">
                <div className="w-10 h-2.5 clay-skeleton rounded mb-1" />
                <div className="w-12 h-3.5 clay-skeleton rounded" />
              </div>
            </div>

            {/* Legend Pills Skeleton */}
            <div className="flex flex-col gap-2.5 w-full sm:w-44">
              {[1, 2, 3, 4, 5].map((l) => (
                <div key={l} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full clay-skeleton" />
                    <div className="w-20 h-3 clay-skeleton rounded" />
                  </div>
                  <div className="w-10 h-3 clay-skeleton rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Unit Economics Skeleton Card */}
        <div className="surface-raised rounded-3xl p-6 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 relative overflow-hidden">
          <div className="h-5 w-44 clay-skeleton rounded-lg mb-2" />
          <div className="h-3 w-60 clay-skeleton rounded-md mb-6" />

          <div className="space-y-5">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-32 clay-skeleton rounded" />
                  <div className="h-3.5 w-16 clay-skeleton rounded" />
                </div>
                <div className="h-3 w-full surface-recessed rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full clay-skeleton rounded-full"
                    style={{ width: `${90 - item * 18}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * ViewLoadingFallback
 * Lightweight clay skeleton fallback for lazy-loaded route tabs.
 */
export const ViewLoadingFallback = () => {
  return (
    <div className="space-y-6 py-4 animate-in fade-in duration-200">
      <div className="surface-raised rounded-2xl p-6 border border-zorvex-border/60 dark:border-zorvex-dark-border/60 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 clay-skeleton rounded-lg" />
          <div className="h-8 w-28 clay-skeleton rounded-full" />
        </div>
        <div className="h-3.5 w-80 clay-skeleton rounded-md" />
        <div className="h-48 surface-recessed rounded-xl p-4 flex items-center justify-center">
          <div className="h-4 w-32 clay-skeleton rounded-full" />
        </div>
      </div>
    </div>
  );
};

/**
 * ClayTableSkeleton
 * Polished recessed clay shimmer skeleton for high-density tables.
 * Prevents screen jumps, layout shifts, or blank whiteouts.
 */
export const ClayTableSkeleton = ({ rows = 5, columns = 6 }) => {
  return (
    <div className="space-y-2.5 p-3">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="flex items-center justify-between gap-4 p-3.5 rounded-xl surface-raised border border-zorvex-border/50 dark:border-zorvex-dark-border/50 animate-fade-in"
          style={{ animationDelay: `${rIdx * 50}ms` }}
        >
          <div className="flex items-center gap-3 w-1/3 min-w-[200px]">
            <div className="w-8 h-8 rounded-lg clay-skeleton flex-shrink-0" />
            <div className="space-y-1.5 w-full">
              <div className="h-3.5 w-3/4 clay-skeleton rounded-md" />
              <div className="h-2.5 w-1/2 clay-skeleton rounded-md" />
            </div>
          </div>
          <div className="hidden sm:block w-1/6 space-y-1.5">
            <div className="h-3 w-3/4 clay-skeleton rounded-md" />
            <div className="h-2 w-1/2 clay-skeleton rounded-md" />
          </div>
          <div className="w-1/6 flex justify-center">
            <div className="h-6 w-24 clay-skeleton rounded-full" />
          </div>
          <div className="w-1/6 text-right space-y-1.5">
            <div className="h-3.5 w-20 clay-skeleton rounded-md ml-auto" />
            <div className="h-2.5 w-14 clay-skeleton rounded-md ml-auto" />
          </div>
          <div className="w-1/6 flex justify-end">
            <div className="h-7 w-20 clay-skeleton rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardSkeleton;
