/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bili: {
          pink: "#FB7299",
          pinkdark: "#E85D82",
          blue: "#00AEEC",
          ink: "#18191C",
          panel: "#1F2023",
          card: "#25272C",
          muted: "#9499A0",
          line: "#2E3033",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 6px 20px -6px rgba(0,0,0,0.5)",
        glow: "0 8px 30px -8px rgba(251,114,153,0.45)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease both",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};
