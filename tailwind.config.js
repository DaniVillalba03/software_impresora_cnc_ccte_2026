/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,tsx,ts,jsx,js}'],
  theme: {
    extend: {
      colors: {
        cnc: {
          bg: '#131418',         // Deep studio background
          surface: '#1b1d22',    // CAD panel background
          elevated: '#24272e',   // Input and card background
          border: '#323640',     // Subtle precision border
          'border-light': '#424652',
          text: '#f1f3f7',       // Crisp text
          muted: '#8c92a0',      // Technical metadata text
          primary: '#2563eb',    // Solid engineering blue
          'primary-hover': '#1d4ed8',
          secondary: '#38bdf8',  // Steel cyan accent
          hoop: '#38bdf8',       // Steel blue for Hoop layers
          helical: '#f59e0b',    // Technical Amber for Helical layers
          success: '#16a34a',    // Industrial Green
          warning: '#d97706',    // Industrial Amber
          danger: '#dc2626',     // Industrial Red
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    }
  },
  plugins: [],
}
