/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        severity: {
          critical: "#dc2626",
          high: "#ea580c",
          medium: "#ca8a04",
          low: "#2563eb",
          info: "#6b7280",
        },
        status: {
          open: "#ef4444",
          confirmed: "#f97316",
          mitigated: "#22c55e",
          false_positive: "#6b7280",
        },
      },
    },
  },
  plugins: [],
}
