import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#000000",
        "bg-elev": "#0a0a0a",
        card: "#0d0d0d",
        line: "#1a1a1a",
        soft: "#ededed",
        muted: "#878787",
        dim: "#3a3a3a",
        teal: "#22c55e",
        orange: "#fb923c",
        hot: "#ef4444",
        ok: "#22c55e",
        warn: "#f59e0b",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        DEFAULT: "4px",
      },
    },
  },
  plugins: [],
};

export default config;
