/**
 * CyxCode State Versioning — Changelog
 *
 * Append-only event log for all versioning events.
 */

import fs from "fs/promises"
import path from "path"
import { Log } from "@/util/log"
import { historyBasePath } from "./types"
import type { ChangelogEntry } from "./types"

const log = Log.create({ service: "cyxcode-versioning-changelog" })

const MAX_ENTRIES = 1000
const MAX_HISTORY = 12

function logPath(): string {
  return path.join(historyBasePath(), "changelog.json")
}

// --- Write lock ---

let writeLock: Promise<void> = Promise.resolve()

// --- Changelog namespace ---

export namespace Changelog {
  export async function read(): Promise<ChangelogEntry[]> {
    try {
      const content = await fs.readFile(logPath(), "utf-8")
      const parsed = JSON.parse(content)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  export async function append(entry: ChangelogEntry): Promise<void> {
    writeLock = writeLock.then(async () => {
      const entries = await read()
      entries.push(entry)

      // FIFO cap
      while (entries.length > MAX_ENTRIES) entries.shift()

      const dir = path.dirname(logPath())
      await fs.mkdir(dir, { recursive: true })
      // Atomic write: temp + rename
      const temp = logPath() + ".tmp"
      await fs.writeFile(temp, JSON.stringify(entries, null, 2))
      await fs.rename(temp, logPath())
    }).catch(e => log.warn("Failed to append changelog", { error: e }))
    await writeLock
  }

  export async function recent(n: number): Promise<ChangelogEntry[]> {
    const entries = await read()
    return entries.slice(-n)
  }

  export function format(entries: ChangelogEntry[]): string {
    if (entries.length === 0) return "No CyxCode history entries found."
    return entries.map((entry) => {
      const time = entry.timestamp.replace("T", " ").replace(/\.\d+Z$/, "Z")
      const detail = (() => {
        if (entry.type === "commit") {
          const trigger = entry.data.trigger ? ` ${entry.data.trigger}` : ""
          const hash = entry.data.hash ? ` ${String(entry.data.hash).slice(0, 8)}` : ""
          const files = Number.isFinite(entry.data.files) ? ` ${entry.data.files} files` : ""
          const session = entry.data.session ? ` ${entry.data.session}` : ""
          return `${trigger}${hash}${files}${session}`.trim()
        }
        if (entry.type === "correction" || entry.type === "correction-reinforced") {
          const rule = entry.data.rule ? ` ${entry.data.rule}` : ""
          const strength = entry.data.strength ? ` strength ${entry.data.strength}` : ""
          return `${rule}${strength}`.trim()
        }
        if (entry.type === "drift") {
          return entry.data.rule ? String(entry.data.rule) : ""
        }
        if (entry.type === "promotion") {
          return entry.data.rule ? String(entry.data.rule) : ""
        }
        if (entry.type === "decay") {
          return entry.data.id ? String(entry.data.id) : ""
        }
        return Object.keys(entry.data).length > 0 ? JSON.stringify(entry.data) : ""
      })()
      return `${time}  ${entry.type}${detail ? `  ${detail}` : ""}`
    }).join("\n")
  }

  export async function summary(n = MAX_HISTORY): Promise<string> {
    return format((await recent(n)).reverse())
  }
}
