/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'charcoal': '#2d2d2d',
        'emerald-dark': '#1a5f4a',
        'emerald-rich': '#2a8659',
        'cream-off': '#f5f3f0',
        'cream-warm': '#faf8f5',
        'gold-warm': '#d4a574',
        'gold-soft': '#e6c9a8',
        'text-muted': '#666666',
        'border-color': '#e0e0e0',
      },
      spacing: {
        '128': '32rem',
      },
      fontSize: {
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
      },
    },
  },
  plugins: [],
};
