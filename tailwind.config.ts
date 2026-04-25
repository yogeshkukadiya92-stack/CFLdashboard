import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#101513",
          900: "#18211d",
          700: "#31413a",
          500: "#63736b"
        },
        mint: {
          50: "#ecfdf5",
          100: "#d3f7e7",
          500: "#10a37f",
          600: "#07876b",
          700: "#05624f"
        },
        saffron: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#f97316",
          600: "#ea580c"
        },
        ai: {
          50: "#eef2ff",
          500: "#6366f1",
          600: "#4f46e5"
        }
      },
      boxShadow: {
        panel: "0 22px 70px -52px rgba(15, 23, 42, 0.55)",
        soft: "0 16px 34px -28px rgba(15, 23, 42, 0.55)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
