/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./pubmed_miner.html",
    "./src/**/*.{js,html}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
