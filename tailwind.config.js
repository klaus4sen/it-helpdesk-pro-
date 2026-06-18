/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Faveo-inspired enterprise blue
        brand: {
          50: '#eef5ff', 100: '#dcebff', 200: '#b3d4ff', 300: '#80b8ff',
          400: '#4596fb', 500: '#1c7ce8', 600: '#0d63c9', 700: '#0a4ea0',
          800: '#0b3f80', 900: '#0d3568',
        },
        // deep navy sidebar/console ink
        navy: {
          50: '#eef1f6', 100: '#dde2eb', 200: '#b7c1d3', 300: '#8c9ab4',
          400: '#5c6c8c', 500: '#3a4866', 600: '#283450', 700: '#1d2740',
          800: '#141b30', 900: '#0d1322',
        },
        ink: '#101826',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(13,19,34,0.05), 0 1px 3px 0 rgba(13,19,34,0.07)',
        lift: '0 16px 40px -16px rgba(13,19,34,0.35)',
        nav: '2px 0 16px -8px rgba(13,19,34,0.25)',
      },
    },
  },
  plugins: [],
}
