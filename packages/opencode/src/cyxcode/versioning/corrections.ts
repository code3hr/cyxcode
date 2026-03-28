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
import { CyxPaths } from "../paths"
import { Changelog } from "./changelog"
import { CyxAudit } from "../audit"

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
  return CyxPaths.correctionsDir()
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
  export async function add(rule: string, source: Correction["source"] = "explicit", scope: "project" | "global" = "project"): Promise<Correction> {
    const id = hashRule(rule)
    const targetDir = scope === "global" ? CyxPaths.globalCorrectionsDir() : basePath()
    const targetPath = path.join(targetDir, id + ".json")

    // Check existing
    try {
      const content = await fs.readFile(targetPath, "utf-8")
      const existing = JSON.parse(content) as Correction
      if (existing.id && existing.rule) return reinforce(existing)
    } catch {}

    // Get current session count for decay baseline
    let sessionCount = 0
    try {
      const sp = scope === "global" ? CyxPaths.globalStatsPath() : CyxPaths.statsPath()
      const stats = JSON.parse(require("fs").readFileSync(sp, "utf-8"))
      sessionCount = stats.sessions || 0
    } catch {}

    const correction: Correction = {
      id,
      rule: rule.trim(),
      strength: 1,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      source,
      promoted: false,
      decayBase: sessionCount,
    }

    writeLock = writeLock.then(async () => {
      await fs.mkdir(targetDir, { recursive: true })
      await fs.writeFile(targetPath, JSON.stringify(correction, null, 2))
    }).catch(e => log.warn("Failed to write correction", { error: e }))
    await writeLock

    if (scope === "project") {
      await Changelog.append({
        type: "correction",
        timestamp: correction.created,
        data: { id, rule: correction.rule, strength: 1, source },
      })
    }

    log.debug("Added correction", { id, rule: correction.rule, strength: 1, scope })

    // Emit audit event
    CyxAudit.record("cyxcode.correction.added", {
      correctionId: id,
      rule: correction.rule,
      strength: 1,
    }).catch(() => {})

    return correction
  }

  export async function reinforce(correction: Correction): Promise<Correction> {
    correction.strength++
    correction.updated = new Date().toISOString()
    // Reset decay baseline to current session count
    try {
      const statsPath = path.join(historyBasePath(), "..", "cyxcode-stats.json")
      const stats = JSON.parse(require("fs").readFileSync(statsPath, "utf-8"))
      correction.decayBase = stats.sessions || 0
    } catch {
      correction.decayBase = 0
    }

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

    // Emit audit event
    CyxAudit.record("cyxcode.correction.reinforced", {
      correctionId: correction.id,
      rule: correction.rule,
      strength: correction.strength,
    }).catch(() => {})

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

    // Emit audit event
    CyxAudit.record("cyxcode.correction.promoted", {
      correctionId: id,
      rule: correction.rule,
      strength: correction.strength,
    }).catch(() => {})
  }

  export async function remove(id: string): Promise<void> {
    try {
      await fs.unlink(correctionPath(id))
    } catch {}
  }

  /** Load corrections from a specific directory */
  async function loadFromDir(dir: string): Promise<Correction[]> {
    try {
      await fs.mkdir(dir, { recursive: true })
      const files = await fs.readdir(dir)
      const jsonFiles = files.filter(f => f.endsWith(".json"))
      const results = await Promise.allSettled(
        jsonFiles.map(f => fs.readFile(path.join(dir, f), "utf-8"))
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

  /**
   * Format corrections for system prompt injection.
   * Merges global + project corrections (project wins on same rule hash).
   * Budget: max ~300 tokens (~1200 chars).
   */
  export async function forSystemPrompt(): Promise<string[]> {
    // Load global corrections
    const globalCorr = await loadFromDir(CyxPaths.globalCorrectionsDir())

    // Load project corrections
    const projectCorr = await active()

    // Merge: project corrections override global ones with the same id
    const projectIds = new Set(projectCorr.map(c => c.id))
    const merged = [
      ...projectCorr,
      ...globalCorr.filter(c => !c.promoted && c.strength > 0 && !projectIds.has(c.id)),
    ].sort((a, b) => b.strength - a.strength)

    if (merged.length === 0) return []

    const MAX_CHARS = 1100
    let total = 0
    const lines: string[] = []

    for (const c of merged) {
      const line = `- [strength ${c.strength}] ${c.rule}`
      if (total + line.length > MAX_CHARS) break
      lines.push(line)
      total += line.length
    }

    if (lines.length === 0) return []

    return [`<cyxcode-corrections>\nIMPORTANT — User has corrected you on these behaviors:\n${lines.join("\n")}\n</cyxcode-corrections>`]
  }
}
