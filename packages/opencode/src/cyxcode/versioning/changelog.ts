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
}
