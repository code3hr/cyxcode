import { defineConfig } from "astro/config"
import tailwind from "@astrojs/tailwind"

const pages = process.env.GITHUB_ACTIONS === "true"

export default defineConfig({
  site: "https://code3hr.github.io",
  base: pages ? "/cyxcode" : "/",
  cacheDir: pages ? ".astro" : process.platform === "win32" ? "D:/tmp/cyxcode-astro-cache" : ".astro",
  integrations: [tailwind()],
  outDir: "./dist",
  vite: {
    cacheDir: ".astro-vite-cache",
    optimizeDeps: {
      entries: []
    }
  }
})