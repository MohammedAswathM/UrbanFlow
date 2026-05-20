/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0b1020",
          800: "#10162b",
          700: "#161d36",
          600: "#1d2643",
          500: "#2a3457",
        },
        accent: {
          500: "#ff4b4b",
          400: "#ff6b6b",
        },
        teal: {
          glow: "#22d3ee",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 30px rgba(34,211,238,0.25)",
      },
    },
  },
  plugins: [],
};
