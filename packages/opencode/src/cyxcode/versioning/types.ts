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
  trigger: "compaction" | "session-end" | "manual" | "branch-create" | "branch-merge"
  session: {
    slug: string
    timestamp: string
  }
  state: CommitState
  /** Branch metadata (undefined = main branch) */
  branch?: {
    sessionID: string
    baseHash: string
  }
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
      | "branch-create" | "branch-merge" | "branch-abandon"
  timestamp: string
  data: Record<string, any>
}

// --- Multi-agent branching types ---

/** Branch reference stored in branches/{sessionID}.json */
export type BranchRef = {
  sessionID: string           // Subagent session ID (used as branch name)
  parentSessionID: string     // Parent session that spawned this branch
  baseCommitHash: string      // Commit hash at branch creation time
  created: string             // ISO timestamp
  status: "active" | "merged" | "abandoned"
  headHash: string | null     // Current HEAD of this branch (null if no commits yet)
}

/** Merge record stored in merges/{mergeHash}.json */
export type MergeRecord = {
  mergeHash: string           // Hash of merge result
  branchSessionID: string     // Which branch was merged
  baseCommitHash: string      // Common ancestor
  branchCommitHash: string    // Branch HEAD at merge time
  mainCommitHash: string      // Main HEAD at merge time
  timestamp: string
  conflicts: ConflictResolution[]
  discoveries: string[]       // Merged discoveries
  corrections: string[]       // Merged correction IDs
}

/** Conflict resolution record */
export type ConflictResolution = {
  field: keyof CommitState
  resolution: "take-main" | "take-branch" | "merge"
  mainValue: any
  branchValue: any
  resolvedValue: any
}
