/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fff9',
          100: '#d0ffee',
          200: '#a0ffdd',
          300: '#60f5c0',
          400: '#20e89e',
          500: '#00D886',
          600: '#00bd74',
          700: '#009e61',
          800: '#007e4e',
          900: '#00613c',
          950: '#003d25',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
