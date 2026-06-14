import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        rarity: {
          common: "#9ca3af",
          rare: "#3b82f6",
          epic: "#a855f7",
          legendary: "#f59e0b",
          cursed: "#dc2626",
        },
      },
      keyframes: {
        roll: {
          "0%": { transform: "rotate(0deg) scale(1)" },
          "50%": { transform: "rotate(180deg) scale(1.15)" },
          "100%": { transform: "rotate(360deg) scale(1)" },
        },
        pop: {
          "0%": { transform: "scale(0.85)", opacity: "0.4" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-6px)" },
          "75%": { transform: "translateX(6px)" },
        },
      },
      animation: {
        roll: "roll 0.4s ease-in-out",
        pop: "pop 0.2s ease-out",
        shake: "shake 0.3s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
