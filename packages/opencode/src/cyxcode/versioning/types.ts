/**
 * CyxCode State Versioning — Type Definitions & Shared Utilities
 */

import path from "path"

// --- Shared path resolution (single cache for all versioning modules) ---

let _historyBase: string | undefined

export function historyBasePath(): string {
  if (_historyBase) return _historyBase
  // Walk up from cwd to find project root .opencode/
  // Skip .opencode/ dirs that are inside packages/ (not project root)
  let dir = process.cwd()
  let found: string | undefined
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, ".opencode")
    try {
      require("fs").accessSync(candidate)
      found = path.join(dir, ".opencode", "history")
      // Keep walking up to find the project root (has package.json or .git)
      const hasGit = (() => { try { require("fs").accessSync(path.join(dir, ".git")); return true } catch { return false } })()
      const hasRootPkg = (() => { try { const p = JSON.parse(require("fs").readFileSync(path.join(dir, "package.json"), "utf-8")); return p.workspaces !== undefined } catch { return false } })()
      if (hasGit || hasRootPkg) {
        _historyBase = found
        return _historyBase
      }
    } catch {}
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  _historyBase = found || path.join(process.cwd(), ".opencode", "history")
  return _historyBase
}

export type Commit = {
  hash: string
  parent: string | null
  timestamp: string
  trigger: "compaction" | "session-end" | "manual"
  session: {
    slug: string
    timestamp: string
  }
  state: CommitState
}

export type CommitState = {
  goal: string
  workingFiles: string[]
  inProgress: string
  completed: string[]
  discoveries: string[]
  activeMemories: string[]
  activePatterns: string[]
}

export type Head = {
  hash: string
  timestamp: string
}

export type ChangelogEntry = {
  type: "commit" | "correction" | "correction-reinforced"
      | "drift" | "promotion" | "decay" | "epoch"
  timestamp: string
  data: Record<string, any>
}
