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
          // Canonical ZORVEX Ivory & Forest Design System (Light Mode)
          bg: '#F3F0E7',
          surface: '#FFFCF5',
          secondary: '#E6E9DD',
          'surface-secondary': '#E6E9DD',
          'surface-recessed': '#E9E6DC',
          border: '#E3DCCB',
          forest: '#49664D',
          'forest-soft': '#E2E9D9',
          'forest-dark-soft': '#303E31',
          'forest-highlight': '#49664D',
          text: '#292E28',
          'text-secondary': '#656B5F',
          'text-muted': '#656B5F',
          muted: '#656B5F',

          // Canonical ZORVEX Ivory & Forest Design System (Dark Mode)
          dark: {
            bg: '#19211B',
            surface: '#252E26',
            secondary: '#2D382D',
            'surface-secondary': '#2D382D',
            'surface-recessed': '#1D261F',
            border: '#3B493D',
            forest: '#AFC69B',
            'forest-soft': '#303E31',
            'forest-highlight': '#AFC69B',
            text: '#F0EEE4',
            'text-secondary': '#C8D2BA',
            'text-muted': '#C8D2BA',
            muted: '#C8D2BA',
          },

          // Semantic FinOps Indicators
          spike: '#C94A3D',
          'spike-soft': '#FDF2F0',
          savings: '#3D7847',
          'savings-soft': '#EFF7F1',
          warning: '#C27803',
          'warning-soft': '#FEF7ED',
        },
        clay: {
          // Intentionally retained legacy aliases (Finding H audit: verified active references)
          surface: '#FFFCF5',          // Retained: active in App.jsx and SettingsView.jsx
          card: '#FFFCF5',             // Retained: active in App.jsx
          'espresso-muted': '#656B5F', // Retained: active in index.css
          sage: '#49664D',             // Retained: 10 active uses for stable workload delta indicators
          'sage-light': '#E2E9D9',     // Retained: 6 active uses for stable workload delta badges
          coral: '#C94A3D',            // Retained: 27 active uses for cost spike alerts
          'coral-light': '#FDF2F0',    // Retained: 14 active uses for cost spike pills
          amber: '#C27803',            // Retained: 2 active uses in ComparisonView.jsx
          'amber-light': '#FEF7ED',    // Retained: 2 active uses in ComparisonView.jsx
          dark: {
            'text-muted': '#C8D2BA',   // Retained: active in SettingsView.jsx and index.css
          }
        }
      },
      boxShadow: {
        // Authentic Claymorphism 3D Depth — Ivory & Forest Light Mode
        'surface-flat': '0 1px 2px rgba(41, 46, 40, 0.05)',
        'surface-raised': '0 10px 24px -4px rgba(41, 46, 40, 0.08), 0 2px 6px -1px rgba(41, 46, 40, 0.04), inset 1px 1px 0px rgba(255, 255, 255, 0.95), inset 2px 2px 4px rgba(255, 255, 255, 0.75), inset -1.5px -1.5px 4px rgba(73, 102, 77, 0.05)',
        'surface-recessed': 'inset 0 2px 4px rgba(41, 46, 40, 0.08), inset 0 1px 2px rgba(41, 46, 40, 0.04), 0 1px 1px rgba(255, 255, 255, 0.8)',
        'surface-floating': '0 20px 40px -8px rgba(41, 46, 40, 0.14), 0 6px 14px -2px rgba(41, 46, 40, 0.07), inset 1px 1px 0px rgba(255, 255, 255, 1.0), inset -2px -2px 6px rgba(73, 102, 77, 0.06)',
        'surface-interactive': '0 16px 32px -4px rgba(41, 46, 40, 0.12), 0 4px 10px -1px rgba(41, 46, 40, 0.06), inset 1px 1px 0px rgba(255, 255, 255, 1.0), inset 2px 2px 5px rgba(255, 255, 255, 0.85), inset -2px -2px 5px rgba(73, 102, 77, 0.06)',

        // Authentic Claymorphism 3D Depth — Deep Obsidian & Forest Dark Mode
        'surface-flat-dark': '0 1px 2px rgba(0, 0, 0, 0.5)',
        'surface-raised-dark': '0 14px 34px -4px rgba(0, 0, 0, 0.85), 0 4px 10px -2px rgba(0, 0, 0, 0.65), inset 1px 1px 1px rgba(175, 198, 155, 0.16), inset 2px 2px 6px rgba(73, 102, 77, 0.12), inset -2px -2px 6px rgba(0, 0, 0, 0.75)',
        'surface-recessed-dark': 'inset 0 2px 6px rgba(0, 0, 0, 0.75), inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 1px rgba(175, 198, 155, 0.06)',
        'surface-floating-dark': '0 24px 52px -8px rgba(0, 0, 0, 0.95), 0 8px 18px -2px rgba(0, 0, 0, 0.8), inset 1px 1px 1px rgba(175, 198, 155, 0.22), inset -2px -2px 8px rgba(0, 0, 0, 0.8)',
        'surface-interactive-dark': '0 20px 42px -6px rgba(0, 0, 0, 0.92), 0 6px 14px -2px rgba(0, 0, 0, 0.75), inset 1px 1px 1px rgba(175, 198, 155, 0.25), inset 2px 2px 8px rgba(73, 102, 77, 0.2), inset -2px -2px 6px rgba(0, 0, 0, 0.85)',

        // Legacy compatibility shadows
        'clay': '0 10px 24px -4px rgba(41, 46, 40, 0.08), 0 2px 6px -1px rgba(41, 46, 40, 0.04), inset 1px 1px 0px rgba(255, 255, 255, 0.95), inset 2px 2px 4px rgba(255, 255, 255, 0.75), inset -1.5px -1.5px 4px rgba(73, 102, 77, 0.05)',
        'clay-dark': '0 14px 34px -4px rgba(0, 0, 0, 0.85), 0 4px 10px -2px rgba(0, 0, 0, 0.65), inset 1px 1px 1px rgba(175, 198, 155, 0.16), inset 2px 2px 6px rgba(73, 102, 77, 0.12), inset -2px -2px 6px rgba(0, 0, 0, 0.75)',
        'clay-interactive': '0 16px 32px -4px rgba(41, 46, 40, 0.12), 0 4px 10px -1px rgba(41, 46, 40, 0.06), inset 1px 1px 0px rgba(255, 255, 255, 1.0), inset 2px 2px 5px rgba(255, 255, 255, 0.85), inset -2px -2px 5px rgba(73, 102, 77, 0.06)',
        'clay-interactive-dark': '0 20px 42px -6px rgba(0, 0, 0, 0.92), 0 6px 14px -2px rgba(0, 0, 0, 0.75), inset 1px 1px 1px rgba(175, 198, 155, 0.25), inset 2px 2px 8px rgba(73, 102, 77, 0.2), inset -2px -2px 6px rgba(0, 0, 0, 0.85)',
        'clay-sm': '0 3px 8px -1px rgba(41, 46, 40, 0.06), 0 1px 2px rgba(41, 46, 40, 0.03), inset 1px 1px 0px rgba(255, 255, 255, 0.9), inset 1px 1px 2px rgba(255, 255, 255, 0.7)',
        'clay-sm-dark': '0 4px 10px -1px rgba(0, 0, 0, 0.7), 0 1px 3px rgba(0, 0, 0, 0.5), inset 1px 1px 1px rgba(175, 198, 155, 0.14)',
        'clay-lg': '0 20px 40px -8px rgba(41, 46, 40, 0.14), 0 6px 14px -2px rgba(41, 46, 40, 0.07), inset 1px 1px 0px rgba(255, 255, 255, 1.0), inset -2px -2px 6px rgba(73, 102, 77, 0.06)',
        'clay-lg-dark': '0 24px 52px -8px rgba(0, 0, 0, 0.95), 0 8px 18px -2px rgba(0, 0, 0, 0.8), inset 1px 1px 1px rgba(175, 198, 155, 0.22), inset -2px -2px 8px rgba(0, 0, 0, 0.8)',
        'clay-track': 'inset 0 2px 4px rgba(41, 46, 40, 0.08), inset 0 1px 2px rgba(41, 46, 40, 0.04), 0 1px 1px rgba(255, 255, 255, 0.8)',
        'clay-track-dark': 'inset 0 2px 6px rgba(0, 0, 0, 0.75), inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 1px rgba(175, 198, 155, 0.06)',
        'clay-btn': '0 3px 8px -1px rgba(41, 46, 40, 0.08), 0 1px 3px rgba(41, 46, 40, 0.04), inset 1px 1px 0px rgba(255, 255, 255, 1.0), inset 0 1px 2px rgba(255, 255, 255, 0.8)',
        'clay-btn-dark': '0 4px 10px -1px rgba(0, 0, 0, 0.7), 0 1px 3px rgba(0, 0, 0, 0.5), inset 1px 1px 1px rgba(175, 198, 155, 0.18)',
        'clay-btn-primary': '0 4px 14px rgba(73, 102, 77, 0.35), 0 1px 3px rgba(41, 46, 40, 0.15), inset 1px 1px 1px rgba(255, 255, 255, 0.35), inset 0 -2px 4px rgba(0, 0, 0, 0.25)',
        'clay-btn-primary-dark': '0 4px 18px rgba(175, 198, 155, 0.35), 0 2px 6px rgba(0, 0, 0, 0.6), inset 1px 1px 2px rgba(240, 238, 228, 0.45), inset 0 -2px 4px rgba(0, 0, 0, 0.4)',
        'clay-input': 'inset 0 2px 4px rgba(41, 46, 40, 0.07), inset 0 1px 2px rgba(41, 46, 40, 0.04), 0 1px 1px rgba(255, 255, 255, 0.85)',
        'clay-input-dark': 'inset 0 2px 6px rgba(0, 0, 0, 0.75), inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 1px rgba(175, 198, 155, 0.06)',
      },
      borderRadius: {
        'clay': '16px',
        'clay-sm': '10px',
        'clay-lg': '20px',
        'clay-pill': '9999px',
      }
    },
  },
  plugins: [],
}
