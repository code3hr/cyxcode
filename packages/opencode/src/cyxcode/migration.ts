/**
 * CyxCode Migration — .opencode/ to .cyxcode/
 *
 * Copy-based migration for safety. Originals are NOT deleted.
 * Writes a .cyxcode-migrated marker to prevent re-migration.
 */

import fs from "fs/promises"
import path from "path"
import { Log } from "@/util/log"

const log = Log.create({ service: "cyxcode-migration" })

const MARKER_FILE = ".cyxcode-migrated"

export type MigrationReport = {
  patterns: number
  memories: number
  history: number
  stats: number
  commands: number
  agents: number
  totalFiles: number
}

// --- File mapping ---

type MigrationItem = {
  type: "file" | "dir"
  src: string   // relative to .opencode/
  dest: string  // relative to .cyxcode/
  category: keyof Omit<MigrationReport, "totalFiles">
}

const MIGRATION_MAP: MigrationItem[] = [
  { type: "file", src: "cyxcode-learned.json", dest: "patterns/learned.json", category: "patterns" },
  { type: "file", src: "cyxcode-stats.json", dest: "stats.json", category: "stats" },
  { type: "dir", src: "memory", dest: "memory", category: "memories" },
  { type: "dir", src: "history", dest: "history", category: "history" },
  { type: "dir", src: "command", dest: "command", category: "commands" },
  { type: "dir", src: "agent", dest: "agent", category: "agents" },
]

// --- Recursive copy ---

async function copyDir(src: string, dest: string): Promise<number> {
  let count = 0
  try {
    const entries = await fs.readdir(src, { withFileTypes: true })
    await fs.mkdir(dest, { recursive: true })
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        count += await copyDir(srcPath, destPath)
      } else {
        try {
          await fs.copyFile(srcPath, destPath)
          count++
        } catch (e) {
          log.warn("Failed to copy file", { src: srcPath, dest: destPath, error: e })
        }
      }
    }
  } catch {}
  return count
}

// --- Public API ---

export namespace CyxMigration {
  /** Check if migration is needed */
  export async function needsMigration(projectDir: string): Promise<boolean> {
    const opencodeDir = path.join(projectDir, ".opencode")
    const cyxcodeDir = path.join(projectDir, ".cyxcode")
    const markerPath = path.join(opencodeDir, MARKER_FILE)

    // No .opencode/ → nothing to migrate
    try { await fs.access(opencodeDir) } catch { return false }

    // Already migrated
    try { await fs.access(markerPath); return false } catch {}

    // .cyxcode/ must exist (init should have created it)
    try { await fs.access(cyxcodeDir) } catch { return false }

    // Check if any cyxcode-specific files exist
    for (const item of MIGRATION_MAP) {
      try {
        await fs.access(path.join(opencodeDir, item.src))
        return true
      } catch {}
    }

    return false
  }

  /** Run migration — copies files from .opencode/ to .cyxcode/ */
  export async function migrate(projectDir: string): Promise<MigrationReport> {
    const opencodeDir = path.join(projectDir, ".opencode")
    const cyxcodeDir = path.join(projectDir, ".cyxcode")

    const report: MigrationReport = {
      patterns: 0,
      memories: 0,
      history: 0,
      stats: 0,
      commands: 0,
      agents: 0,
      totalFiles: 0,
    }

    for (const item of MIGRATION_MAP) {
      const srcPath = path.join(opencodeDir, item.src)
      const destPath = path.join(cyxcodeDir, item.dest)

      try {
        await fs.access(srcPath)
      } catch {
        continue // source doesn't exist, skip
      }

      if (item.type === "file") {
        try {
          await fs.mkdir(path.dirname(destPath), { recursive: true })
          await fs.copyFile(srcPath, destPath)
          report[item.category]++
          report.totalFiles++
        } catch (e) {
          log.warn("Migration: failed to copy file", { src: srcPath, error: e })
        }
      } else {
        const count = await copyDir(srcPath, destPath)
        report[item.category] += count
        report.totalFiles += count
      }
    }

    // Write migration marker
    if (report.totalFiles > 0) {
      try {
        await fs.writeFile(
          path.join(opencodeDir, MARKER_FILE),
          JSON.stringify({
            migratedAt: new Date().toISOString(),
            filesCount: report.totalFiles,
          }, null, 2) + "\n",
        )
      } catch (e) {
        log.warn("Failed to write migration marker", { error: e })
      }
    }

    log.info("Migration complete", { report })
    return report
  }
}
