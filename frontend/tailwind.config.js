/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(10 10 10 / <alpha-value>)',
        'bg-subtle': 'rgb(20 20 20 / <alpha-value>)',
        'bg-elevated': 'rgb(24 24 24 / <alpha-value>)',
        border: 'rgb(255 255 255 / 0.08)',
        'border-loud': 'rgb(255 255 255 / 0.14)',
        fg: 'rgb(245 245 245 / <alpha-value>)',
        muted: 'rgb(163 163 163 / <alpha-value>)',
        subtle: 'rgb(115 115 115 / <alpha-value>)',
        heat: 'rgb(var(--color-heat) / <alpha-value>)',
        'heat-fg': 'rgb(var(--color-heat-fg) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
      boxShadow: { panel: '0 18px 45px rgb(0 0 0 / 0.22)' },
    },
  },
  plugins: [],
}
