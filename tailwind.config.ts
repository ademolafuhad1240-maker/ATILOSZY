import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'emerald-dark': '#0B3B2E',
        'emerald-rich': '#145A43',
        'gold-warm': '#C9A227',
        'gold-soft': '#E4CC77',
        'cream-warm': '#F7F3E8',
        'cream-off': '#FCFBF7',
        'charcoal': '#171A18',
        'text-muted': '#66706A',
        'border-color': '#DED9CC',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'section': '4rem',
        'section-sm': '2rem',
      },
    },
  },
  plugins: [],
};
export default config;
