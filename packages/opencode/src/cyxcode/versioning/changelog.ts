/**
 * CyxCode State Versioning — Changelog
 *
 * Append-only event log for all versioning events.
 */

import fs from "fs/promises"
import path from "path"
import { Log } from "@/util/log"
import type { ChangelogEntry } from "./types"

const log = Log.create({ service: "cyxcode-versioning-changelog" })

const MAX_ENTRIES = 1000

// --- Path resolution ---

let _path: string | undefined

function logPath(): string {
  if (_path) return _path
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, ".opencode")
    try {
      require("fs").accessSync(candidate)
      _path = path.join(dir, ".opencode", "history", "changelog.json")
      return _path
    } catch {}
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  _path = path.join(process.cwd(), ".opencode", "history", "changelog.json")
  return _path
}

// --- Write lock ---

let writeLock: Promise<void> = Promise.resolve()

// --- Changelog namespace ---

export namespace Changelog {
  export async function read(): Promise<ChangelogEntry[]> {
    try {
      const content = await fs.readFile(logPath(), "utf-8")
      return JSON.parse(content) as ChangelogEntry[]
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
      await fs.writeFile(logPath(), JSON.stringify(entries, null, 2))
    }).catch(e => log.warn("Failed to append changelog", { error: e }))
    await writeLock
  }

  export async function recent(n: number): Promise<ChangelogEntry[]> {
    const entries = await read()
    return entries.slice(-n)
  }
}
