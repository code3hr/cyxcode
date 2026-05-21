import { defineConfig } from "vite"
import desktopPlugin from "./vite"

export default defineConfig({
  plugins: [desktopPlugin] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
    strictPort: true,
    proxy: {
      "/dashboard": {
        target: "http://127.0.0.1:3002",
        changeOrigin: true,
        ws: true,
      },
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
  build: {
    target: "esnext",
    // sourcemap: true,
  },
})
