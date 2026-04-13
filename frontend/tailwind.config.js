/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', '"PingFang SC"', '"Microsoft YaHei"', '"Helvetica Neue"', '"Noto Sans SC"', 'sans-serif'],
        display: ['-apple-system', '"PingFang SC"', '"Microsoft YaHei"', '"Helvetica Neue"', '"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        /* Theme-aware colors via CSS variables */
        'primary': 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'accent': 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'highlight': 'var(--color-highlight)',
        'bg-base': 'var(--color-bg)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'bg-card': 'var(--color-bg-card)',
        'text-base': 'var(--color-text)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'border': 'var(--color-border)',
        /* Legacy palette (kept for existing component references) */
        'base': '#0F172A',
        'surface': '#1E293B',
        'elevated': '#253352',
        'electric-blue': '#3B82F6',
        'cyber-cyan': '#06B6D4',
        'neo-purple': '#8B5CF6',
      },
      backgroundImage: {
        'gradient-tech': 'linear-gradient(135deg, #0F172A 0%, #1a2744 40%, #1E293B 100%)',
        'gradient-blue-cyan': 'linear-gradient(135deg, #3B82F6, #06B6D4)',
        'gradient-primary': 'linear-gradient(135deg, var(--color-primary), var(--color-gradient))',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(59, 130, 246, 0.25)',
        'glow':    '0 0 20px rgba(59, 130, 246, 0.35)',
        'glow-lg': '0 0 40px rgba(59, 130, 246, 0.4)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.35)',
      },
      animation: {
        'gradient-shift': 'gradient-shift 12s ease infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'float-orb': 'float-orb 10s ease-in-out infinite',
        'text-shimmer': 'text-shimmer 5s linear infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwind-scrollbar-hide'),
  ],
}
