/**
 * CyxCode State Versioning — Commit Storage
 *
 * Content-hashed state snapshots with HEAD pointer.
 */

import fs from "fs/promises"
import path from "path"
import { createHash } from "crypto"
import { Log } from "@/util/log"
import { historyBasePath } from "./types"
import type { Commit, CommitState, Head } from "./types"

const log = Log.create({ service: "cyxcode-versioning-commit" })

const MAX_COMMITS = 100

function basePath(): string {
  return historyBasePath()
}

function headPath(): string {
  return path.join(basePath(), "HEAD.json")
}

function commitsDir(): string {
  return path.join(basePath(), "commits")
}

function commitPath(hash: string): string {
  return path.join(commitsDir(), hash + ".json")
}

// --- Write locks (per-file) ---

let headLock: Promise<void> = Promise.resolve()
let commitLock: Promise<void> = Promise.resolve()

// --- Hash ---

function hashState(state: CommitState): string {
  return createHash("sha256")
    .update(JSON.stringify(state))
    .digest("hex")
    .slice(0, 16)
}

// --- Commits namespace ---

export namespace Commits {
  export async function readHead(): Promise<Head | null> {
    try {
      const content = await fs.readFile(headPath(), "utf-8")
      return JSON.parse(content) as Head
    } catch {
      return null
    }
  }

  export async function writeHead(head: Head): Promise<void> {
    headLock = headLock.then(async () => {
      await fs.mkdir(basePath(), { recursive: true })
      // Atomic: write to temp, then rename
      const temp = headPath() + ".tmp"
      await fs.writeFile(temp, JSON.stringify(head, null, 2))
      await fs.rename(temp, headPath())
    }).catch(e => log.warn("Failed to write HEAD", { error: e }))
    await headLock
  }

  export async function create(
    state: CommitState,
    trigger: Commit["trigger"],
    session: Commit["session"],
    branchSessionID?: string,
  ): Promise<Commit> {
    const hash = hashState(state)

    // Determine parent based on branch
    let parent: string | null
    let branchMeta: Commit["branch"] | undefined

    if (branchSessionID) {
      // Branch commit: parent is branch HEAD or base
      const { Branch } = await import("./branch")
      const branch = await Branch.get(branchSessionID)
      parent = branch?.headHash ?? branch?.baseCommitHash ?? null
      if (parent === "root") parent = null
      branchMeta = {
        sessionID: branchSessionID,
        baseHash: branch?.baseCommitHash ?? "root",
      }

      // Skip if identical to branch HEAD
      if (branch?.headHash === hash) {
        const existing = await read(hash)
        if (existing) return existing
      }
    } else {
      // Main branch: parent is main HEAD
      const head = await readHead()
      parent = head?.hash ?? null

      // Skip if identical to HEAD
      if (head && head.hash === hash) {
        const existing = await read(hash)
        if (existing) return existing
      }
    }

    const commit: Commit = {
      hash,
      parent,
      timestamp: new Date().toISOString(),
      trigger,
      session,
      state,
      branch: branchMeta,
    }

    // Write commit file
    commitLock = commitLock.then(async () => {
      await fs.mkdir(commitsDir(), { recursive: true })
      await fs.writeFile(commitPath(hash), JSON.stringify(commit, null, 2))
    }).catch(e => log.warn("Failed to write commit", { error: e }))
    await commitLock

    // Update HEAD (main or branch)
    if (branchSessionID) {
      const { Branch } = await import("./branch")
      await Branch.updateHead(branchSessionID, hash)
    } else {
      await writeHead({ hash, timestamp: commit.timestamp })
    }

    // Garbage collect old commits (main only)
    if (!branchSessionID) {
      await gc()
    }

    log.debug("Created commit", { hash, trigger, parent: commit.parent, branch: branchSessionID })

    return commit
  }

  export async function read(hash: string): Promise<Commit | null> {
    try {
      const content = await fs.readFile(commitPath(hash), "utf-8")
      return JSON.parse(content) as Commit
    } catch {
      return null
    }
  }

  export async function latest(): Promise<Commit | null> {
    const head = await readHead()
    if (!head) return null
    return read(head.hash)
  }

  async function gc(): Promise<void> {
    try {
      const dir = commitsDir()
      const files = await fs.readdir(dir)
      if (files.length <= MAX_COMMITS) return

      // Build parent chain from HEAD to protect referenced commits
      const head = await readHead()
      const protected_ = new Set<string>()
      if (head) {
        let hash: string | null = head.hash
        while (hash) {
          protected_.add(hash + ".json")
          const commit = await read(hash)
          hash = commit?.parent ?? null
        }
      }

      // Sort by modification time, remove oldest (but never protected)
      const stats = await Promise.all(
        files.map(async f => ({
          name: f,
          time: (await fs.stat(path.join(dir, f))).mtimeMs,
        }))
      )
      stats.sort((a, b) => a.time - b.time)

      let removed = 0
      for (const f of stats) {
        if (files.length - removed <= MAX_COMMITS) break
        if (protected_.has(f.name)) continue
        await fs.unlink(path.join(dir, f.name))
        removed++
      }

      if (removed > 0) {
        log.debug("GC: removed old commits", { count: removed })
      }
    } catch {}
  }
}
