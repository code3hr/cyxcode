/**
 * CyxCode State Versioning — Correction Tracking
 *
 * Tracks user corrections with strength scoring.
 * Corrected 3+ times = auto-promoted to system prompt.
 */

import fs from "fs/promises"
import path from "path"
import { createHash } from "crypto"
import { Log } from "@/util/log"
import { historyBasePath } from "./types"
import { Changelog } from "./changelog"

const log = Log.create({ service: "cyxcode-versioning-corrections" })

const AUTO_PROMOTE_THRESHOLD = 3
const MAX_CORRECTIONS = 50

// --- Types ---

export type Correction = {
  id: string
  rule: string
  strength: number
  created: string
  updated: string
  source: "explicit" | "heuristic" | "dream"
  promoted: boolean
  decayBase: number
}

// --- Path resolution ---

function basePath(): string {
  return path.join(historyBasePath(), "corrections")
}

function correctionPath(id: string): string {
  return path.join(basePath(), id + ".json")
}

// --- Write lock ---

let writeLock: Promise<void> = Promise.resolve()

// --- Hash ---

function hashRule(rule: string): string {
  return createHash("sha256").update(rule.toLowerCase().trim()).digest("hex").slice(0, 12)
}

// --- Corrections namespace ---

export namespace Corrections {
  export async function add(rule: string, source: Correction["source"] = "explicit"): Promise<Correction> {
    const id = hashRule(rule)
    const existing = await get(id)

    if (existing) {
      return reinforce(existing)
    }

    const correction: Correction = {
      id,
      rule: rule.trim(),
      strength: 1,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      source,
      promoted: false,
      decayBase: 0,
    }

    writeLock = writeLock.then(async () => {
      await fs.mkdir(basePath(), { recursive: true })
      await fs.writeFile(correctionPath(id), JSON.stringify(correction, null, 2))
    }).catch(e => log.warn("Failed to write correction", { error: e }))
    await writeLock

    await Changelog.append({
      type: "correction",
      timestamp: correction.created,
      data: { id, rule: correction.rule, strength: 1, source },
    })

    log.debug("Added correction", { id, rule: correction.rule, strength: 1 })

    return correction
  }

  export async function reinforce(correction: Correction): Promise<Correction> {
    correction.strength++
    correction.updated = new Date().toISOString()
    correction.decayBase = 0 // Reset decay on reinforcement

    writeLock = writeLock.then(async () => {
      await fs.writeFile(correctionPath(correction.id), JSON.stringify(correction, null, 2))
    }).catch(e => log.warn("Failed to reinforce correction", { error: e }))
    await writeLock

    await Changelog.append({
      type: "correction-reinforced",
      timestamp: correction.updated,
      data: { id: correction.id, rule: correction.rule, strength: correction.strength },
    })

    log.debug("Reinforced correction", { id: correction.id, strength: correction.strength })

    return correction
  }

  export async function get(id: string): Promise<Correction | null> {
    try {
      const content = await fs.readFile(correctionPath(id), "utf-8")
      return JSON.parse(content) as Correction
    } catch {
      return null
    }
  }

  export async function all(): Promise<Correction[]> {
    try {
      await fs.mkdir(basePath(), { recursive: true })
      const files = await fs.readdir(basePath())
      const jsonFiles = files.filter(f => f.endsWith(".json"))
      // Batch read in parallel
      const results = await Promise.allSettled(
        jsonFiles.map(f => fs.readFile(path.join(basePath(), f), "utf-8"))
      )
      const corrections: Correction[] = []
      for (const result of results) {
        if (result.status === "fulfilled") {
          try {
            const parsed = JSON.parse(result.value)
            if (parsed.id && parsed.rule && typeof parsed.strength === "number") {
              corrections.push(parsed as Correction)
            }
          } catch {}
        }
      }
      return corrections.sort((a, b) => b.strength - a.strength)
    } catch {
      return []
    }
  }

  export async function active(): Promise<Correction[]> {
    const corrections = await all()
    return corrections.filter(c => !c.promoted && c.strength > 0)
  }

  export async function promoted(): Promise<Correction[]> {
    const corrections = await all()
    return corrections.filter(c => c.promoted)
  }

  export async function shouldPromote(): Promise<Correction[]> {
    const corrections = await all()
    return corrections.filter(c => !c.promoted && c.strength >= AUTO_PROMOTE_THRESHOLD)
  }

  export async function markPromoted(id: string): Promise<void> {
    const correction = await get(id)
    if (!correction) return

    correction.promoted = true
    correction.updated = new Date().toISOString()

    writeLock = writeLock.then(async () => {
      await fs.writeFile(correctionPath(id), JSON.stringify(correction, null, 2))
    }).catch(e => log.warn("Failed to mark promoted", { error: e }))
    await writeLock

    await Changelog.append({
      type: "promotion",
      timestamp: correction.updated,
      data: { id, rule: correction.rule, strength: correction.strength },
    })

    log.debug("Promoted correction", { id, rule: correction.rule })
  }

  export async function remove(id: string): Promise<void> {
    try {
      await fs.unlink(correctionPath(id))
    } catch {}
  }

  /**
   * Format corrections for system prompt injection.
   * Returns array of strings, sorted by strength (highest first).
   * Budget: max ~300 tokens (~1200 chars).
   */
  export async function forSystemPrompt(): Promise<string[]> {
    const corrections = await active()
    if (corrections.length === 0) return []

    const WRAPPER_OVERHEAD = 100 // <cyxcode-corrections> tags + header text
    const MAX_CHARS = 1100 // 1200 - wrapper overhead
    let total = 0
    const lines: string[] = []

    for (const c of corrections) {
      const line = `- [strength ${c.strength}] ${c.rule}`
      if (total + line.length > MAX_CHARS) break
      lines.push(line)
      total += line.length
    }

    if (lines.length === 0) return []

    return [`<cyxcode-corrections>\nIMPORTANT — User has corrected you on these behaviors:\n${lines.join("\n")}\n</cyxcode-corrections>`]
  }
}
