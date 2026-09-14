/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1c1917',
          light: '#292524',
        },
        parchment: {
          DEFAULT: '#f3ead3',
          dark: '#e8d5b5',
          light: '#faf6eb',
        },
        gold: {
          DEFAULT: '#C9A24B',
          dark: '#A67F2D',
        },
        void: {
          DEFAULT: '#0a0a0a',
          light: '#171717',
        },
        offwhite: '#f5f5f5',
        crimson: { DEFAULT: '#4A1515', border: '#7A2C2C' },
        azure: { DEFAULT: '#15314A', border: '#2C5B7A' },
        verdant: { DEFAULT: '#153B22', border: '#2C6E41' },
        sands: { DEFAULT: '#5E4319', border: '#9E7638' },
        panel: '#151A20',
        track: {
          A: '#7A2430',
          B: '#1F4E63',
          C: '#2E5439',
          D: '#B8862E',
        },
        muted: '#9A9384',
      },
      fontFamily: {
        display: ['"Cinzel"', 'serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
      letterSpacing: {
        widest: '0.15em',
      },
      backgroundImage: {
        'void-gradient': 'radial-gradient(circle at center, #10151A 0%, #0B0E11 100%)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
}
