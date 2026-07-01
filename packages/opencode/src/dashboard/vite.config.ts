import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import path from "path"

const raw = process.env.CYXCODE_DASHBOARD_API?.trim()
const target =
  raw
    ? raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : `http://${raw}`
    : "http://127.0.0.1:4096"

export default defineConfig({
  plugins: [solid()],
  root: path.resolve(__dirname),
  base: "/dashboard/",
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3002,
    strictPort: true,
    proxy: {
      "/pentest": {
        target,
        changeOrigin: true,
      },
      "/cyxcode": {
        target,
        changeOrigin: true,
      },
      "/cyxwatch": {
        target,
        changeOrigin: true,
      },
      "/experimental": {
        target,
        changeOrigin: true,
      },
      "/global": {
        target,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
