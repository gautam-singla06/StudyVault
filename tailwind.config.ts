import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 60px rgba(56, 189, 248, 0.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;
