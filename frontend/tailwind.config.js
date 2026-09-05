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
        primary: {
          50: '#effdf9',
          100: '#d0f5ec',
          200: '#a1e9d9',
          300: '#6bd5c0',
          400: '#3cb8a5',
          500: '#129588',
          600: '#0d756d',
          700: '#0f5c57',
          800: '#104a46',
          900: '#103d3b',
        },
      },
    },
  },
  plugins: [],
}