/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          light: "#f4f6fb",
          dark: "#0f1424",
        },
        panel: {
          light: "#ffffff",
          dark: "#171d33",
        },
        brand: {
          50: "#eef4ff",
          100: "#dae7ff",
          200: "#bbd2ff",
          300: "#8fb4ff",
          400: "#5f8fff",
          500: "#3a68ff",
          600: "#264ce0",
          700: "#1f3cb3",
          800: "#1e358c",
          900: "#1c306f",
        },
        plot: {
          available: "#4ade80",
          owned: "#60a5fa",
          listed: "#fbbf24",
          auction: "#fb923c",
          unavailable: "#f87171",
        },
      },
      fontFamily: {
        display: ["'Baloo 2'", "'Nunito'", "system-ui", "sans-serif"],
        body: ["'Nunito'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 10px 30px -12px rgba(15, 23, 42, 0.25)",
        "panel-dark": "0 10px 30px -12px rgba(0, 0, 0, 0.5)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.92)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(251, 146, 60, 0.45)" },
          "50%": { boxShadow: "0 0 0 8px rgba(251, 146, 60, 0)" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.18s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
