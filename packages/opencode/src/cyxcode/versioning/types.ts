/**
 * CyxCode State Versioning — Type Definitions & Shared Utilities
 */

import { CyxPaths } from "../paths"

// --- Shared path resolution (centralized in CyxPaths) ---

export function historyBasePath(): string {
  return CyxPaths.historyDir()
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
