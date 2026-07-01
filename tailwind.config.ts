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
        bg: "#f4f1ea",
        surface: "#efece3",
        surface2: "#ffffff",
        border: "#16130f",
        "text-primary": "#16130f",
        "text-secondary": "#8a8378",
        accent: "#ffc400",
        "accent-hover": "#000000",
        success: "#1f9d57",
        danger: "#d6492f",
        gold: "#d6492f",
        "gold-light": "#ec1c24",
        marquee: "#fff6d6",
        muted: "#b3ac9e",
      },
      fontFamily: {
        anton: ["var(--font-anton)", "Impact", "sans-serif"],
        barlow: ["var(--font-barlow)", "sans-serif"],
        "barlow-condensed": ["var(--font-barlow-condensed)", "sans-serif"],
        "space-mono": ["var(--font-space-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
