import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0f1117",
        surface: "#1a1d27",
        surface2: "#22263a",
        border: "#2e3347",
        accent: "#7c5cbf",
        "accent-hover": "#9370db",
        "text-primary": "#e8eaf0",
        "text-secondary": "#8b91a8",
        success: "#2d9e6b",
        danger: "#c94040",
        gold: "#d4a017",
        "gold-light": "#f0bc2e",
      },
    },
  },
  plugins: [],
};

export default config;
