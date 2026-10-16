import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { TrendingUp, PieChart as PieIcon } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

export default function SpendingCharts({ overview, trends }) {
  if (!overview) return null;

  // Prepare Daily Trajectory Data
  const dailyTotals = overview.daily_totals || {};
  const dates = Object.keys(dailyTotals).slice(-30);
  const spendData = dates.map(d => dailyTotals[d]);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const chartBg = isDark ? '#252E26' : '#FFFCF5';
  const forestColor = isDark ? '#AFC69B' : '#49664D';

  const lineChartData = {
    labels: dates.map(d => d.slice(5)),
    datasets: [
      {
        label: 'Daily Spend ($)',
        data: spendData,
        borderColor: forestColor,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, isDark ? 'rgba(175, 198, 155, 0.25)' : 'rgba(73, 102, 77, 0.22)');
          gradient.addColorStop(1, 'rgba(73, 102, 77, 0.01)');
          return gradient;
        },
        fill: true,
        tension: 0.35,
        pointBackgroundColor: chartBg,
        pointBorderColor: forestColor,
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#252E26' : '#292E28',
        titleColor: isDark ? '#F0EEE4' : '#FFFCF5',
        bodyColor: isDark ? '#F0EEE4' : '#FFFCF5',
        titleFont: { family: 'Plus Jakarta Sans', weight: 700 },
        bodyFont: { family: 'IBM Plex Mono', weight: 600 },
        padding: 10,
        cornerRadius: 12,
        borderColor: isDark ? '#3B493D' : '#E3DCCB',
        borderWidth: 1,
        displayColors: false,
        callbacks: {
          label: (context) => `Spend: $${context.parsed.y.toFixed(2)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { 
          color: isDark ? '#B7C0AE' : '#656B5F', 
          font: { family: 'IBM Plex Mono', size: 10, weight: 600 } 
        }
      },
      y: {
        grid: { color: isDark ? 'rgba(59, 73, 61, 0.3)' : 'rgba(227, 220, 203, 0.6)' },
        ticks: {
          color: isDark ? '#B7C0AE' : '#656B5F',
          font: { family: 'IBM Plex Mono', size: 10, weight: 600 },
          callback: (value) => `$${value}`
        }
      }
    }
  };

  // Prepare Service Breakdown Donut
  const services = overview.services || {};
  const topServices = Object.entries(services).slice(0, 5);
  const serviceLabels = topServices.map(([k]) => k);
  const serviceValues = topServices.map(([, v]) => v);

  const forestPalette = [
    '#49664D', // Primary Forest
    '#39523C', // Deep Forest
    '#6B8E70', // Sage Highlight
    '#8FA87D', // Muted Olive
    '#C27803', // Amber Accent
    '#C94A3D', // Crimson Spike
  ];

  const doughnutData = {
    labels: serviceLabels,
    datasets: [
      {
        data: serviceValues,
        backgroundColor: forestPalette,
        borderWidth: 2,
        borderColor: chartBg,
        hoverOffset: 4
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          padding: 14,
          color: isDark ? '#B7C0AE' : '#656B5F',
          font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 }
        }
      },
      tooltip: {
        backgroundColor: isDark ? '#252E26' : '#292E28',
        titleColor: isDark ? '#F0EEE4' : '#FFFCF5',
        bodyColor: isDark ? '#F0EEE4' : '#FFFCF5',
        bodyFont: { family: 'IBM Plex Mono', weight: 600 },
        padding: 10,
        cornerRadius: 12,
        borderColor: isDark ? '#3B493D' : '#E3DCCB',
        borderWidth: 1,
        callbacks: {
          label: (context) => ` $${context.raw.toFixed(2)}`
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Daily Spending Trajectory (2 Cols) */}
      <div className="clay-card p-6 lg:col-span-2 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-zorvex-forest dark:text-zorvex-dark-forest" />
              Daily Spend Trajectory
            </h3>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Monitoring telemetry velocity across consecutive billing runs
            </p>
          </div>
          <span className="px-3 py-1 rounded-clay-pill bg-zorvex-surface-secondary dark:bg-zorvex-dark-surface-secondary text-[11px] font-bold text-zorvex-text dark:text-zorvex-dark-text border border-zorvex-border dark:border-zorvex-dark-border font-mono">
            {dates.length} Days View
          </span>
        </div>
        {dates.length === 0 ? (
          <div className="h-64 w-full flex flex-col items-center justify-center text-center p-6 bg-zorvex-surface-secondary/40 rounded-2xl border border-dashed border-zorvex-border dark:border-zorvex-dark-border">
            <TrendingUp className="w-8 h-8 text-zorvex-forest dark:text-zorvex-dark-forest opacity-40 mb-2" />
            <p className="text-xs font-bold text-zorvex-text dark:text-zorvex-dark-text">No Telemetry in Selected Date Range</p>
            <p className="text-[11px] text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary mt-1">Adjust the date range or select "All Telemetry" to view historical cloud spend.</p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        )}
      </div>

      {/* Service Spend Breakdown (1 Col) */}
      <div className="clay-card p-6 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-base font-extrabold text-zorvex-text dark:text-zorvex-dark-text flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-zorvex-forest dark:text-zorvex-dark-forest" />
              Service Allocation
            </h3>
            <p className="text-xs text-zorvex-text-secondary dark:text-zorvex-dark-text-secondary">
              Top contributing AWS cloud services
            </p>
          </div>
        </div>
        <div className="h-64 w-full relative flex items-center justify-center">
          <Doughnut data={doughnutData} options={doughnutOptions} />
        </div>
      </div>

    </div>
  );
}
