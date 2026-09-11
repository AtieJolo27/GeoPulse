/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // GeoPulse Green Theme - Eye-catching but not painful (hindi masakit sa mata)
        primary: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#0D5E33',
          800: '#0A4A28',
          900: '#06361E',
        },
        forest: {
          DEFAULT: '#0D5E33',
          light: '#16A34A',
          dark: '#06361E',
        },
        mint: {
          DEFAULT: '#DCFCE7',
          light: '#F0FDF4',
        },
        warm: {
          green: '#4ADE80',
        },
        soil: {
          bg: '#F0FDF4',
          card: '#DCFCE7',
          border: '#BBF7D0',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'green': '0 4px 6px -1px rgba(13, 94, 51, 0.1), 0 2px 4px -2px rgba(13, 94, 51, 0.1)',
        'green-lg': '0 10px 15px -3px rgba(13, 94, 51, 0.1), 0 4px 6px -4px rgba(13, 94, 51, 0.1)',
      },
    },
  },
  plugins: [],
}
