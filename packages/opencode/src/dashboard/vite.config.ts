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
    host: "127.0.0.1",
    port: 3002,
    strictPort: true,
    proxy: {
      "/pentest": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
      },
      "/cyxcode": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
      },
      "/cyxwatch": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
      },
      "/experimental": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
      },
      "/global": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
