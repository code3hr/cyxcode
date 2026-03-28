/**
 * CyxCode Community Pattern Loading
 *
 * Loads community-contributed pattern packs from ~/.cyxcode/community/
 * Each pack is a JSON file with name, version, and patterns array.
 */

import fs from "fs/promises"
import { Log } from "@/util/log"
import { CyxPaths } from "./paths"
import type { Pattern, Fix } from "./types"

const log = Log.create({ service: "cyxcode-community" })

// --- Community pack format ---

type CommunityPack = {
  name: string
  version: string
  author?: string
  patterns: Array<{
    id: string
    regex: string
    category: string
    description: string
    fixes: Fix[]
  }>
}

function isValidPack(data: any): data is CommunityPack {
  return (
    data &&
    typeof data.name === "string" &&
    typeof data.version === "string" &&
    Array.isArray(data.patterns) &&
    data.patterns.every((p: any) =>
      typeof p.id === "string" &&
      typeof p.regex === "string" &&
      typeof p.description === "string" &&
      Array.isArray(p.fixes)
    )
  )
}

// --- Public API ---

export namespace CommunityPatterns {
  /** Load all community pattern packs from ~/.cyxcode/community/ */
  export async function loadAll(): Promise<Pattern[]> {
    const dir = CyxPaths.globalCommunityDir()
    const patterns: Pattern[] = []

    let files: string[]
    try {
      files = await fs.readdir(dir)
    } catch {
      return patterns // directory doesn't exist, that's fine
    }

    for (const file of files) {
      if (!file.endsWith(".json")) continue

      try {
        const content = await fs.readFile(`${dir}/${file}`, "utf-8")
        const pack = JSON.parse(content)

        if (!isValidPack(pack)) {
          log.warn("Invalid community pack, skipping", { file })
          continue
        }

        for (const p of pack.patterns) {
          try {
            patterns.push({
              id: `community-${pack.name}-${p.id}`,
              regex: new RegExp(p.regex, "i"),
              category: p.category || "community",
              description: p.description,
              fixes: p.fixes,
            })
          } catch (regexErr) {
            log.warn("Invalid regex in community pattern, skipping", { pack: pack.name, id: p.id })
          }
        }

        log.info("Loaded community pack", { name: pack.name, patterns: pack.patterns.length })
      } catch (e) {
        log.warn("Failed to load community pack", { file, error: e })
      }
    }

    return patterns
  }
}
