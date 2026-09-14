import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dali:   { DEFAULT: "#E63329", deep: "#B01C15", soft: "#FF5347" },
        gold:   { DEFAULT: "#F5C542", deep: "#D9A521" },
        ink:    { DEFAULT: "#14110F", soft: "#2A2422", line: "#3A322E" },
        bone:   { DEFAULT: "#F4F0E4", dim: "#E4DDCB" },
        mint:   "#3FB68B",
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        body:    ["var(--font-body)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card:  "0 18px 40px -18px rgba(0,0,0,.55)",
        hard:  "6px 6px 0 0 rgba(20,17,15,1)",
        goldy: "0 0 0 3px rgba(245,197,66,.35)",
      },
      keyframes: {
        rise:   { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "none" } },
        pulseRing: { "0%,100%": { boxShadow: "0 0 0 0 rgba(230,51,41,.45)" }, "50%": { boxShadow: "0 0 0 14px rgba(230,51,41,0)" } },
        ticker: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
      },
      animation: {
        rise: "rise .45s cubic-bezier(.2,.8,.2,1) both",
        pulseRing: "pulseRing 2s ease-out infinite",
        ticker: "ticker 26s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
