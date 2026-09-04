import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Every colour resolves through a CSS variable so the dark theme is one
      // block in globals.css rather than a `dark:` prefix on every element.
      // Values are space-separated RGB; the alpha slot keeps `bg-ink/10` working.
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)"
        },
        cream: {
          DEFAULT: "rgb(var(--cream) / <alpha-value>)",
          warm: "rgb(var(--cream-warm) / <alpha-value>)",
          deep: "rgb(var(--cream-deep) / <alpha-value>)"
        },
        leaf: {
          DEFAULT: "rgb(var(--leaf) / <alpha-value>)",
          soft: "rgb(var(--leaf-soft) / <alpha-value>)",
          pale: "rgb(var(--leaf-pale) / <alpha-value>)",
          text: "rgb(var(--leaf-text) / <alpha-value>)"
        },
        ember: {
          DEFAULT: "rgb(var(--ember) / <alpha-value>)",
          soft: "rgb(var(--ember-soft) / <alpha-value>)",
          text: "rgb(var(--ember-text) / <alpha-value>)"
        },
        sage: { DEFAULT: "rgb(var(--sage) / <alpha-value>)" },
        swiggy: {
          DEFAULT: "rgb(var(--swiggy) / <alpha-value>)",
          ink: "rgb(var(--swiggy-ink) / <alpha-value>)",
          muted: "rgb(var(--swiggy-muted) / <alpha-value>)",
          text: "rgb(var(--swiggy-text) / <alpha-value>)"
        },
        // Label on a filled accent (Swiggy orange, ember). Deliberately does not
        // follow the theme — a light label on orange is 2.16:1.
        "on-accent": "rgb(var(--on-accent) / <alpha-value>)"
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
  plugins: [
    ({ addVariant }: any) => addVariant("hover", "@media (hover: hover) and (pointer: fine) { &:hover }")
  ]
};
export default config;
