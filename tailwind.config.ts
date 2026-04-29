import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0F1614", soft: "#1F2A26", muted: "#5C6B65" },
        cream: { DEFAULT: "#F8F5EF", warm: "#F2EDE2", deep: "#EAE2D2" },
        leaf: { DEFAULT: "#0E7E5C", soft: "#7FB89F", pale: "#D8E8DF" },
        ember: { DEFAULT: "#D9613A", soft: "#F2A684" },
        sage: { DEFAULT: "#B7C4B3" }
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"]
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 2s linear infinite",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
export default config;
