/** @type {import("tailwindcss").Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx,vue,svelte}"],
  theme: {
    extend: {
      colors: {
        ink: {
          base: "#f5f7fb",
          soft: "#ced4e2",
          deep: "#202a3b"
        },
        glow: {
          mint: "#24d1a3",
          amber: "#f3ad28",
          violet: "#8d6dff"
        },
        panel: {
          0: "#0a0f1a",
          1: "#101a2a",
          2: "#17233a"
        },
        line: "#22304b"
      },
      fontFamily: {
        sans: [
          "Space Grotesk",
          "Inter",
          "Avenir Next",
          "Avenir",
          "Segoe UI",
          "sans-serif"
        ],
        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "SFMono",
          "Menlo",
          "Consolas",
          "monospace"
        ]
      },
      boxShadow: {
        neon: "0 14px 40px rgba(36, 209, 163, 0.2)"
      }
    }
  }
}
