/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#faf7f2',
        'paper-deep': '#f1ece3',
        sand: '#f2ecdf',
        ink: '#1c1917',
        'ink-soft': '#57534e',
        'ink-faint': '#a8a29e',
        line: '#e4ddd1',
        accent: '#c2410c',
        'accent-soft': '#fde8dc',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,25,23,0.06), 0 4px 16px rgba(28,25,23,0.05)',
        panel: '-8px 0 32px rgba(28,25,23,0.12)',
      },
    },
  },
  plugins: [],
}
