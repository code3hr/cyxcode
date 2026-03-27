/**
 * CyxCode Dream Consolidation System
 *
 * "Sleep for AI" — clean, deduplicate, validate, persist.
 *
 * Phases 1-4 run on startup (free, code-based).
 * Phase 5 runs via /dream command (AI-powered, optional).
 */

import fs from "fs/promises"
import path from "path"
import { Log } from "@/util/log"
import { Memory } from "./memory"
import type { MemoryIndex } from "./memory"
import { LearnedPatterns } from "./learned"
import { SkillRouter } from "./router"

const log = Log.create({ service: "cyxcode-dream" })

// --- Stats file ---

type StatsFile = {
  version: 1
  matches: number
  misses: number
  hitRate: number
  tokensSaved: number
  topPatterns: Array<{ id: string; count: number }>
  sessions: number
  lastDream: string
}

const DEFAULT_STATS: StatsFile = {
  version: 1,
  matches: 0,
  misses: 0,
  hitRate: 0,
  tokensSaved: 0,
  topPatterns: [],
  sessions: 0,
  lastDream: "",
}

// --- Path resolution (same walk-up as learned.ts) ---

let _statsPath: string | undefined

function statsPath(): string {
  if (_statsPath) return _statsPath
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, ".opencode")
    try {
      require("fs").accessSync(candidate)
      _statsPath = path.join(dir, ".opencode", "cyxcode-stats.json")
      return _statsPath
    } catch {}
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  _statsPath = path.join(process.cwd(), ".opencode", "cyxcode-stats.json")
  return _statsPath
}

// --- Write lock ---

let writeLock: Promise<void> = Promise.resolve()

async function writeStats(data: StatsFile): Promise<void> {
  writeLock = writeLock.then(async () => {
    await fs.mkdir(path.dirname(statsPath()), { recursive: true })
    await fs.writeFile(statsPath(), JSON.stringify(data, null, 2))
  }).catch(e => log.warn("Failed to write stats", { error: e }))
  await writeLock
}

async function readStats(): Promise<StatsFile> {
  try {
    const content = await fs.readFile(statsPath(), "utf-8")
    return JSON.parse(content) as StatsFile
  } catch {
    return { ...DEFAULT_STATS }
  }
}

// --- Dream namespace ---

export namespace Dream {
  /**
   * Phase 1: Orient — read all current state
   */
  export async function orient() {
    const memoryIndex = await Memory.readIndex()
    const learnedData = await LearnedPatterns.read()
    const stats = await readStats()
    return { memoryIndex, learnedData, stats }
  }

  /**
   * Phase 2a: Deduplicate learned patterns
   */
  export async function deduplicatePatterns(): Promise<{ removedApproved: number; removedPending: number }> {
    // Wait for learned patterns to finish loading
    if ((globalThis as any).__cyxcode_learned_ready) {
      await (globalThis as any).__cyxcode_learned_ready
    }

    const data = await LearnedPatterns.read()
    const seenApproved = new Set<string>()
    const seenPending = new Set<string>()
    let removedApproved = 0
    let removedPending = 0

    // Deduplicate approved — extract regex from either format
    const cleanApproved = data.approved.filter(entry => {
      const sp = (entry as any).generatedPattern || entry
      const regex = sp.regex
      if (!regex || seenApproved.has(regex)) {
        removedApproved++
        return false
      }
      seenApproved.add(regex)
      return true
    })

    // Deduplicate pending
    const cleanPending = data.pending.filter(entry => {
      const regex = entry.generatedPattern.regex
      if (!regex || seenPending.has(regex) || seenApproved.has(regex)) {
        removedPending++
        return false
      }
      seenPending.add(regex)
      return true
    })

    if (removedApproved > 0 || removedPending > 0) {
      data.approved = cleanApproved
      data.pending = cleanPending
      await LearnedPatterns.write(data)
      log.debug("Deduplicated patterns", { removedApproved, removedPending })
    }

    return { removedApproved, removedPending }
  }

  /**
   * Phase 2b: Deduplicate memories with overlapping tags
   */
  export async function deduplicateMemories(): Promise<{ merged: number }> {
    const index = await Memory.readIndex()
    if (index.entries.length < 2) return { merged: 0 }

    const toRemove = new Set<string>()
    let merged = 0

    for (let i = 0; i < index.entries.length; i++) {
      if (toRemove.has(index.entries[i].id)) continue
      for (let j = i + 1; j < index.entries.length; j++) {
        if (toRemove.has(index.entries[j].id)) continue

        const a = index.entries[i]
        const b = index.entries[j]

        // Jaccard similarity on tags
        const setA = new Set(a.tags)
        const setB = new Set(b.tags)
        const intersection = [...setA].filter(t => setB.has(t)).length
        const union = new Set([...setA, ...setB]).size

        if (union > 0 && intersection / union > 0.5) {
          // Merge: keep higher accessCount, union tags
          const keep = a.accessCount >= b.accessCount ? a : b
          const drop = keep === a ? b : a

          keep.tags = [...new Set([...a.tags, ...b.tags])]
          if (keep.summary.length < drop.summary.length) keep.summary = drop.summary

          toRemove.add(drop.id)
          merged++

          // Delete dropped file
          try {
            await fs.unlink(path.join(Memory.getBasePath(), drop.file))
          } catch {}
        }
      }
    }

    if (merged > 0) {
      index.entries = index.entries.filter(e => !toRemove.has(e.id))
      await Memory.writeIndex(index)
      log.debug("Merged memories", { merged })
    }

    return { merged }
  }

  /**
   * Phase 3: Validate — check file existence and regex validity
   */
  export async function validate(): Promise<{ removedMemories: number; removedPatterns: number }> {
    let removedMemories = 0
    let removedPatterns = 0

    // Validate memory files exist
    const index = await Memory.readIndex()
    const validEntries = []
    for (const entry of index.entries) {
      try {
        await fs.access(path.join(Memory.getBasePath(), entry.file))
        validEntries.push(entry)
      } catch {
        removedMemories++
      }
    }
    if (removedMemories > 0) {
      index.entries = validEntries
      await Memory.writeIndex(index)
    }

    // Validate learned pattern regexes
    const data = await LearnedPatterns.read()
    const validApproved = data.approved.filter(entry => {
      const sp = (entry as any).generatedPattern || entry
      try {
        new RegExp(sp.regex, "i")
        return true
      } catch {
        removedPatterns++
        return false
      }
    })
    if (removedPatterns > 0) {
      data.approved = validApproved
      await LearnedPatterns.write(data)
    }

    if (removedMemories > 0 || removedPatterns > 0) {
      log.debug("Validated", { removedMemories, removedPatterns })
    }

    return { removedMemories, removedPatterns }
  }

  /**
   * Phase 4: Persist router stats across sessions
   */
  export async function persistStats(): Promise<StatsFile> {
    const current = SkillRouter.routerStats()
    const stats = await readStats()

    stats.matches += current.matches
    stats.misses += current.misses
    stats.tokensSaved += current.tokensSaved

    const total = stats.matches + stats.misses
    stats.hitRate = total > 0 ? stats.matches / total : 0

    stats.sessions++
    stats.lastDream = new Date().toISOString()

    await writeStats(stats)

    // Reset session counters so they're not double-counted
    SkillRouter.resetSessionStats()

    log.debug("Persisted stats", {
      matches: stats.matches,
      misses: stats.misses,
      hitRate: Math.round(stats.hitRate * 100) + "%",
      tokensSaved: stats.tokensSaved,
    })

    return stats
  }

  /**
   * Load persisted stats (for display/reporting)
   */
  export async function loadStats(): Promise<StatsFile> {
    return readStats()
  }

  /**
   * Run all code-based phases (1-4)
   */
  export async function run(): Promise<{
    dupPatterns: { removedApproved: number; removedPending: number }
    dupMemories: { merged: number }
    validation: { removedMemories: number; removedPatterns: number }
    stats: StatsFile
    promoted: number
    versioning: { decayed: number; archived: number; repaired: number }
  }> {
    const dupPatterns = await deduplicatePatterns()
    const dupMemories = await deduplicateMemories()
    const validation = await validate()
    const stats = await persistStats()

    const changes = dupPatterns.removedApproved + dupPatterns.removedPending +
      dupMemories.merged + validation.removedMemories + validation.removedPatterns

    if (changes > 0) {
      log.info("Dream complete", {
        dupPatternsRemoved: dupPatterns.removedApproved + dupPatterns.removedPending,
        memoriesMerged: dupMemories.merged,
        invalidRemoved: validation.removedMemories + validation.removedPatterns,
        sessions: stats.sessions,
        hitRate: Math.round(stats.hitRate * 100) + "%",
      })
    }

    // Phase 6: Auto-promote high-strength corrections to AGENTS.md
    const promoted = await promoteCorrections()

    // Phase 7: State versioning consolidation
    const versioning = await consolidateVersioning()

    return { dupPatterns, dupMemories, validation, stats, promoted, versioning }
  }

  /**
   * Phase 7: State versioning consolidation
   *
   * - Decay corrections not reinforced in 10+ sessions
   * - Archive old commits (keep last 50 in chain)
   * - Repair broken parent pointers
   */
  async function consolidateVersioning(): Promise<{ decayed: number; archived: number; repaired: number }> {
    let decayed = 0
    let archived = 0
    let repaired = 0

    try {
      const { Corrections } = await import("./versioning/corrections")
      const { Commits } = await import("./versioning/commit")
      const { Changelog } = await import("./versioning/changelog")

      // --- Decay: reduce strength of unused corrections ---
      const stats = await readStats()
      const corrections = await Corrections.all()

      for (const correction of corrections) {
        if (correction.promoted) continue // Promoted corrections don't decay

        // Decay: if correction hasn't been reinforced in 10+ sessions
        const sessionsSinceReinforce = stats.sessions - correction.decayBase
        if (sessionsSinceReinforce >= 10 && correction.strength > 0) {
          const decayAmount = Math.floor(sessionsSinceReinforce / 10)
          const newStrength = Math.max(0, correction.strength - decayAmount)

          if (newStrength < correction.strength) {
            // Write decayed correction
            const updated = { ...correction, strength: newStrength, updated: new Date().toISOString() }
            const corrFs = await import("fs/promises")
            const corrPath = await import("path")
            const { historyBasePath } = await import("./versioning/types")
            const filePath = corrPath.default.join(historyBasePath(), "corrections", correction.id + ".json")
            try {
              await corrFs.default.writeFile(filePath, JSON.stringify(updated, null, 2))
              decayed++

              await Changelog.append({
                type: "decay",
                timestamp: new Date().toISOString(),
                data: { id: correction.id, rule: correction.rule, from: correction.strength, to: newStrength },
              })
            } catch {}
          }

          // Remove if strength hits 0
          if (newStrength <= 0) {
            await Corrections.remove(correction.id)
            log.info("Correction decayed to 0, removed", { id: correction.id, rule: correction.rule })
          }
        }
      }

      // --- Archive: keep only last 50 commits in chain ---
      const head = await Commits.readHead()
      if (head) {
        // Walk the chain from HEAD, count commits
        const chain: string[] = []
        let hash: string | null = head.hash
        while (hash) {
          chain.push(hash)
          const commit = await Commits.read(hash)
          hash = commit?.parent ?? null
          if (chain.length > 100) break // Safety limit
        }

        // If more than 50 in chain, archive older ones
        if (chain.length > 50) {
          const toArchive = chain.slice(50)
          const { historyBasePath } = await import("./versioning/types")
          const commitsDir = (await import("path")).default.join(historyBasePath(), "commits")
          const archiveFs = await import("fs/promises")

          for (const h of toArchive) {
            try {
              await archiveFs.default.unlink((await import("path")).default.join(commitsDir, h + ".json"))
              archived++
            } catch {}
          }

          // Update the 50th commit's parent to null (break chain)
          if (chain.length > 50) {
            const lastKept = await Commits.read(chain[49])
            if (lastKept) {
              lastKept.parent = null
              const lastPath = (await import("path")).default.join(commitsDir, chain[49] + ".json")
              await archiveFs.default.writeFile(lastPath, JSON.stringify(lastKept, null, 2))
            }
          }

          if (archived > 0) {
            await Changelog.append({
              type: "epoch",
              timestamp: new Date().toISOString(),
              data: { archived, keptInChain: Math.min(chain.length, 50) },
            })
            log.info("Archived old commits", { archived, kept: 50 })
          }
        }
      }

      // --- Repair: validate HEAD points to existing commit ---
      if (head) {
        const headCommit = await Commits.read(head.hash)
        if (!headCommit) {
          // HEAD points to missing commit — find latest valid commit
          const { historyBasePath } = await import("./versioning/types")
          const commitsDir = (await import("path")).default.join(historyBasePath(), "commits")
          const repairFs = await import("fs/promises")
          try {
            const files = await repairFs.default.readdir(commitsDir)
            if (files.length > 0) {
              // Pick the newest commit file
              let newest = { name: "", time: 0 }
              for (const f of files) {
                const stat = await repairFs.default.stat((await import("path")).default.join(commitsDir, f))
                if (stat.mtimeMs > newest.time) newest = { name: f, time: stat.mtimeMs }
              }
              if (newest.name) {
                const hash = newest.name.replace(".json", "")
                await Commits.writeHead({ hash, timestamp: new Date().toISOString() })
                repaired++
                log.warn("Repaired HEAD — was pointing to missing commit", { oldHash: head.hash, newHash: hash })
              }
            }
          } catch {}
        }
      }

    } catch (e) {
      log.warn("Versioning consolidation failed", { error: e })
    }

    if (decayed > 0 || archived > 0 || repaired > 0) {
      log.info("Versioning consolidated", { decayed, archived, repaired })
    }

    return { decayed, archived, repaired }
  }

  /**
   * Phase 6: Auto-promote corrections with strength >= 3 to AGENTS.md
   */
  async function promoteCorrections(): Promise<number> {
    try {
      const { Corrections } = await import("./versioning/corrections")
      const toPromote = await Corrections.shouldPromote()
      if (toPromote.length === 0) return 0

      // Read AGENTS.md
      const agentsPath = await findAgentsMd()
      if (!agentsPath) return 0

      let content = await fs.readFile(agentsPath, "utf-8")

      for (const correction of toPromote) {
        // Check if already in AGENTS.md
        if (content.includes(correction.rule)) {
          await Corrections.markPromoted(correction.id)
          continue
        }

        // Add under Error Response Guidelines section
        const marker = "## Error Response Guidelines"
        if (content.includes(marker)) {
          const idx = content.indexOf(marker)
          const nextSection = content.indexOf("\n## ", idx + marker.length)
          const insertAt = nextSection > 0 ? nextSection : content.length
          const line = `- ${correction.rule}\n`
          content = content.slice(0, insertAt) + line + content.slice(insertAt)
        } else {
          // Append at end if no section found
          content += `\n- ${correction.rule}\n`
        }

        await Corrections.markPromoted(correction.id)
        log.info("Promoted correction to AGENTS.md", { rule: correction.rule, strength: correction.strength })
      }

      await fs.writeFile(agentsPath, content)
      return toPromote.length
    } catch (e) {
      log.warn("Failed to promote corrections", { error: e })
      return 0
    }
  }

  async function findAgentsMd(): Promise<string | null> {
    let dir = process.cwd()
    for (let i = 0; i < 10; i++) {
      const candidate = path.join(dir, "AGENTS.md")
      try {
        await fs.access(candidate)
        return candidate
      } catch {}
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return null
  }

  /**
   * Recover pending commits from unclean shutdown
   */
  async function recoverPendingCommit(): Promise<void> {
    try {
      const { historyBasePath } = await import("./versioning/types")
      const pendingPath = path.join(historyBasePath(), "pending-commit.json")
      const content = await fs.readFile(pendingPath, "utf-8")
      const pending = JSON.parse(content)
      if (pending.sessionID) {
        const { StateVersioning } = await import("./versioning")
        await StateVersioning.autoCommit(pending.sessionID, "session-end")
        log.info("Recovered pending commit", { sessionID: pending.sessionID })
      }
      await fs.unlink(pendingPath)
    } catch {
      // No pending commit or recovery failed — that's fine
    }
  }

  /**
   * Initialize auto-dream on startup
   */
  export function initAutoDream() {
    recoverPendingCommit().then(() => run()).catch(() => {})
  }
}
