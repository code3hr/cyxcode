import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import path from "path"

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
    port: 5173,
    proxy: {
      "/pentest": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/global": {
        target: "http://localhost:4096",
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
