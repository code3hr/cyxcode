import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import config from "../astro.config.mjs"

const root = fileURLToPath(new URL("../dist/", import.meta.url))
const pages = (await fs.readdir(root, { recursive: true })).filter((file) => file.endsWith(".html"))
if (!pages.length) throw new Error("No generated website pages")

for (const file of pages) {
  const html = await fs.readFile(path.join(root, file), "utf8")
  const links = [...html.matchAll(/<link\b[^>]*>/g)]
    .filter(([tag]) => /rel="stylesheet"/.test(tag))
    .flatMap(([tag]) => [...tag.matchAll(/href="([^"]+)"/g)].map((match) => match[1]))
  if (!links.some((link) => !/^https?:/.test(link)) && !/<style[\s>]/.test(html)) {
    throw new Error(`Styles are missing from ${file}. Check the resolved project path before publishing.`)
  }
  for (const link of links) {
    if (/^https?:/.test(link)) continue
    const base = config.base.replace(/\/$/, "")
    const asset = decodeURIComponent(link.split("?")[0])
    if (base && !asset.startsWith(base + "/")) throw new Error(`Invalid asset base: ${link}`)
    await fs.access(path.join(root, asset.slice(base.length).replace(/^\//, "")))
  }
}
console.log(`Verified styles and stylesheet assets for ${pages.length} pages.`)
