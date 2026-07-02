/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/react-app/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter',
          'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif',
        ],
        mono: [
          'IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo',
          'Consolas', 'monospace',
        ],
      },
      colors: {
        // Semantic tokens — driven by CSS variables (see index.css).
        app: 'var(--app)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        ink: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          fg: 'var(--accent-fg)',
          soft: 'var(--accent-soft)',
        },
        brand: 'var(--blue)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        warning: 'var(--warning)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
      },
      // Unify all sized corners to 5px (keeps `full` for avatars/dots, `none` for sharp edges).
      borderRadius: {
        sm: '5px',
        DEFAULT: '5px',
        md: '5px',
        lg: '5px',
        xl: '5px',
        '2xl': '5px',
        '3xl': '5px',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)',
        pop: '0 8px 28px -8px rgba(0,0,0,0.18), 0 2px 6px -2px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
