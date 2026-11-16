/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        zorvex: {
          // Cloud Synthesis Claymorphism System (Light Mode: GCP Alabaster × AWS Warm Amber)
          bg: '#F4F6F9',
          surface: '#FFFFFF',
          secondary: '#EEF2F6',
          'surface-secondary': '#EEF2F6',
          'surface-recessed': '#E9EEF4',
          border: '#E2E8F0',
          forest: '#EC7211',
          'forest-soft': '#FDF3E7',
          'forest-dark-soft': '#2A1E14',
          'forest-highlight': '#EC7211',
          text: '#0F172A',
          'text-secondary': '#475569',
          'text-muted': '#64748B',
          muted: '#64748B',

          // Cloud Synthesis Claymorphism System (Dark Mode: AWS Squid Ink × Azure Fluent Slate)
          dark: {
            bg: '#0E0F12',
            surface: '#111215',
            secondary: '#16171A',
            'surface-secondary': '#16171A',
            'surface-recessed': '#0D0E11',
            border: '#222328',
            forest: '#FF9900',
            'forest-soft': '#2A1E14',
            'forest-highlight': '#FF9900',
            text: '#F8FAFC',
            'text-secondary': '#94A3B8',
            'text-muted': '#64748B',
            muted: '#64748B',
          },

          // Semantic FinOps Indicators (GCP Material & AWS Precision)
          spike: '#EA4335',
          'spike-soft': '#FCE8E6',
          savings: '#34A853',
          'savings-soft': '#E6F4EA',
          warning: '#FBBC04',
          'warning-soft': '#FEF7ED',
        },
        clay: {
          // Intentionally retained legacy aliases (Finding H audit: verified active references)
          surface: '#FFFFFF',          // Retained: active in App.jsx and SettingsView.jsx
          card: '#FFFFFF',             // Retained: active in App.jsx
          'espresso-muted': '#64748B', // Retained: active in index.css
          sage: '#EC7211',             // Retained: 10 active uses for stable workload delta indicators
          'sage-light': '#FDF3E7',     // Retained: 6 active uses for stable workload delta badges
          coral: '#EA4335',            // Retained: 27 active uses for cost spike alerts
          'coral-light': '#FCE8E6',    // Retained: 14 active uses for cost spike pills
          amber: '#FBBC04',            // Retained: 2 active uses in ComparisonView.jsx
          'amber-light': '#FEF7ED',    // Retained: 2 active uses in ComparisonView.jsx
          dark: {
            'text-muted': '#94A3B8',   // Retained: active in SettingsView.jsx and index.css
          }
        }
      },
      boxShadow: {
        // Authentic Claymorphism 3D Depth — Cloud Synthesis Light Mode
        'surface-flat': '0 1px 2px rgba(15, 23, 42, 0.05)',
        'surface-raised': '0 8px 20px -3px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.03), inset 1px 1px 0px #FFFFFF, inset 2px 2px 4px rgba(255, 255, 255, 0.8), inset -1px -1px 3px rgba(15, 23, 42, 0.03)',
        'surface-recessed': 'inset 0 2px 4px rgba(15, 23, 42, 0.06), inset 0 1px 2px rgba(15, 23, 42, 0.03), 0 1px 1px rgba(255, 255, 255, 0.8)',
        'surface-floating': '0 18px 36px -6px rgba(15, 23, 42, 0.10), 0 6px 14px -2px rgba(15, 23, 42, 0.05), inset 1px 1px 0px #FFFFFF, inset -1px -1px 3px rgba(15, 23, 42, 0.04)',
        'surface-interactive': '0 14px 28px -4px rgba(15, 23, 42, 0.08), 0 4px 10px -1px rgba(15, 23, 42, 0.04), inset 1px 1px 0px #FFFFFF, inset 2px 2px 5px rgba(255, 255, 255, 0.85), inset -1px -1px 3px rgba(15, 23, 42, 0.04)',

        // Authentic Claymorphism 3D Depth — Cloud Synthesis Dark Mode (AWS Squid Ink × Azure Fluent)
        'surface-flat-dark': '0 1px 2px rgba(0, 0, 0, 0.5)',
        'surface-raised-dark': '0 10px 24px -4px rgba(0, 0, 0, 0.65), 0 4px 10px -2px rgba(0, 0, 0, 0.5), inset 1px 1px 0px rgba(255, 255, 255, 0.08), inset 2px 2px 6px rgba(236, 114, 17, 0.05), inset -2px -2px 6px rgba(0, 0, 0, 0.5)',
        'surface-recessed-dark': 'inset 0 2px 6px rgba(0, 0, 0, 0.7), inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 1px rgba(255, 255, 255, 0.05)',
        'surface-floating-dark': '0 20px 44px -8px rgba(0, 0, 0, 0.85), 0 8px 18px -2px rgba(0, 0, 0, 0.7), inset 1px 1px 1px rgba(255, 255, 255, 0.1), inset -2px -2px 8px rgba(0, 0, 0, 0.65)',
        'surface-interactive-dark': '0 16px 36px -6px rgba(0, 0, 0, 0.8), 0 6px 14px -2px rgba(0, 0, 0, 0.65), inset 1px 1px 1px rgba(255, 255, 255, 0.12), inset 2px 2px 8px rgba(236, 114, 17, 0.08), inset -2px -2px 6px rgba(0, 0, 0, 0.7)',

        // Legacy compatibility shadows
        'clay': '0 8px 20px -3px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.03), inset 1px 1px 0px #FFFFFF, inset 2px 2px 4px rgba(255, 255, 255, 0.8), inset -1px -1px 3px rgba(15, 23, 42, 0.03)',
        'clay-dark': '0 10px 24px -4px rgba(0, 0, 0, 0.65), 0 4px 10px -2px rgba(0, 0, 0, 0.5), inset 1px 1px 0px rgba(255, 255, 255, 0.08), inset 2px 2px 6px rgba(236, 114, 17, 0.05), inset -2px -2px 6px rgba(0, 0, 0, 0.5)',
        'clay-interactive': '0 14px 28px -4px rgba(15, 23, 42, 0.08), 0 4px 10px -1px rgba(15, 23, 42, 0.04), inset 1px 1px 0px #FFFFFF, inset 2px 2px 5px rgba(255, 255, 255, 0.85), inset -1px -1px 3px rgba(15, 23, 42, 0.04)',
        'clay-interactive-dark': '0 16px 36px -6px rgba(0, 0, 0, 0.8), 0 6px 14px -2px rgba(0, 0, 0, 0.65), inset 1px 1px 1px rgba(255, 255, 255, 0.12), inset 2px 2px 8px rgba(236, 114, 17, 0.08), inset -2px -2px 6px rgba(0, 0, 0, 0.7)',
        'clay-sm': '0 2px 6px -1px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.02), inset 1px 1px 0px #FFFFFF, inset 1px 1px 2px rgba(255, 255, 255, 0.7)',
        'clay-sm-dark': '0 3px 8px -1px rgba(0, 0, 0, 0.6), 0 1px 3px rgba(0, 0, 0, 0.4), inset 1px 1px 1px rgba(255, 255, 255, 0.08)',
        'clay-lg': '0 18px 36px -6px rgba(15, 23, 42, 0.10), 0 6px 14px -2px rgba(15, 23, 42, 0.05), inset 1px 1px 0px #FFFFFF, inset -1px -1px 3px rgba(15, 23, 42, 0.04)',
        'clay-lg-dark': '0 20px 44px -8px rgba(0, 0, 0, 0.85), 0 8px 18px -2px rgba(0, 0, 0, 0.7), inset 1px 1px 1px rgba(255, 255, 255, 0.1), inset -2px -2px 8px rgba(0, 0, 0, 0.65)',
        'clay-track': 'inset 0 2px 4px rgba(15, 23, 42, 0.06), inset 0 1px 2px rgba(15, 23, 42, 0.03), 0 1px 1px rgba(255, 255, 255, 0.8)',
        'clay-track-dark': 'inset 0 2px 6px rgba(0, 0, 0, 0.7), inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 1px rgba(255, 255, 255, 0.05)',
        'clay-btn': '0 2px 6px -1px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.03), inset 1px 1px 0px #FFFFFF, inset 0 1px 2px rgba(255, 255, 255, 0.8)',
        'clay-btn-dark': '0 3px 8px -1px rgba(0, 0, 0, 0.6), 0 1px 3px rgba(0, 0, 0, 0.4), inset 1px 1px 1px rgba(255, 255, 255, 0.1)',
        'clay-btn-primary': '0 4px 14px rgba(236, 114, 17, 0.35), 0 1px 3px rgba(15, 23, 42, 0.15), inset 1px 1px 1px rgba(255, 255, 255, 0.35), inset 0 -2px 4px rgba(0, 0, 0, 0.25)',
        'clay-btn-primary-dark': '0 4px 18px rgba(236, 114, 17, 0.45), 0 2px 6px rgba(0, 0, 0, 0.6), inset 1px 1px 2px rgba(255, 255, 255, 0.45), inset 0 -2px 4px rgba(0, 0, 0, 0.4)',
        'clay-input': 'inset 0 2px 4px rgba(15, 23, 42, 0.06), inset 0 1px 2px rgba(15, 23, 42, 0.03), 0 1px 1px rgba(255, 255, 255, 0.85)',
        'clay-input-dark': 'inset 0 2px 6px rgba(0, 0, 0, 0.7), inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 1px rgba(255, 255, 255, 0.05)',
      },
      borderRadius: {
        'clay': '16px',
        'clay-sm': '10px',
        'clay-lg': '20px',
        'clay-pill': '9999px',
      },
      gridTemplateColumns: {
        '24': 'repeat(24, minmax(0, 1fr))',
      }
    },
  },
  plugins: [],
}
