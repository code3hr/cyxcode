import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "astro/config"
import tailwind from "@astrojs/tailwind"

const pages = process.env.GITHUB_ACTIONS === "true"

export default defineConfig({
  // Keep page and asset identifiers consistent when Windows path casing differs.
  root: realpathSync.native(fileURLToPath(new URL(".", import.meta.url))),
  site: "https://code3hr.github.io",
  base: pages ? "/cyxcode" : "/",
  cacheDir: ".astro",
  integrations: [tailwind()],
  outDir: "./dist",
  vite: {
    cacheDir: ".astro-vite-cache",
    optimizeDeps: {
      entries: [],
    },
  },
})
