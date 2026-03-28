/**
 * CyxCode State Versioning — Multi-Agent Branching
 *
 * Git-like branching for subagent workflows.
 * Each subagent gets an isolated branch, merges back on completion.
 */

import fs from "fs/promises"
import path from "path"
import { createHash } from "crypto"
import { Log } from "@/util/log"
import { historyBasePath } from "./types"
import type { BranchRef, MergeRecord, ConflictResolution, Commit, CommitState } from "./types"
import { Commits } from "./commit"
import { Changelog } from "./changelog"
import { Corrections } from "./corrections"

const log = Log.create({ service: "cyxcode-versioning-branch" })

const MAX_BRANCH_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// --- Path resolution ---

function branchesDir(): string {
  return path.join(historyBasePath(), "branches")
}

function branchPath(sessionID: string): string {
  return path.join(branchesDir(), sessionID + ".json")
}

function mergesDir(): string {
  return path.join(historyBasePath(), "merges")
}

function mergePath(mergeHash: string): string {
  return path.join(mergesDir(), mergeHash + ".json")
}

// --- Write lock for concurrent merges ---

let mergeLock: Promise<void> = Promise.resolve()

// --- Branch namespace ---

export namespace Branch {
  /**
   * Create a new branch when a subagent spawns.
   */
  export async function create(input: {
    sessionID: string
    parentSessionID: string
  }): Promise<BranchRef> {
    const mainHead = await Commits.readHead()
    const baseHash = mainHead?.hash ?? "root"

    const branch: BranchRef = {
      sessionID: input.sessionID,
      parentSessionID: input.parentSessionID,
      baseCommitHash: baseHash,
      created: new Date().toISOString(),
      status: "active",
      headHash: null,
    }

    await fs.mkdir(branchesDir(), { recursive: true })
    await fs.writeFile(branchPath(input.sessionID), JSON.stringify(branch, null, 2))

    await Changelog.append({
      type: "branch-create",
      timestamp: branch.created,
      data: {
        sessionID: input.sessionID,
        parentSessionID: input.parentSessionID,
        baseHash,
      },
    })

    log.debug("Created branch", { sessionID: input.sessionID, baseHash })

    return branch
  }

  /**
   * Get a branch reference by session ID.
   */
  export async function get(sessionID: string): Promise<BranchRef | null> {
    try {
      const content = await fs.readFile(branchPath(sessionID), "utf-8")
      return JSON.parse(content) as BranchRef
    } catch {
      return null
    }
  }

  /**
   * Update a branch's HEAD pointer.
   */
  export async function updateHead(sessionID: string, hash: string): Promise<void> {
    const branch = await get(sessionID)
    if (!branch) return

    branch.headHash = hash
    await fs.writeFile(branchPath(sessionID), JSON.stringify(branch, null, 2))
  }

  /**
   * Merge a branch back to main when subagent completes.
   */
  export async function merge(branchSessionID: string): Promise<MergeRecord | null> {
    // Serialize merges to prevent race conditions
    let result: MergeRecord | null = null
    mergeLock = mergeLock.then(async () => {
      result = await doMerge(branchSessionID)
    }).catch(e => log.warn("Merge failed", { error: e, branchSessionID }))
    await mergeLock
    return result
  }

  async function doMerge(branchSessionID: string): Promise<MergeRecord | null> {
    const branch = await get(branchSessionID)
    if (!branch || branch.status !== "active") {
      log.debug("Branch not found or not active", { branchSessionID, status: branch?.status })
      return null
    }

    // Empty branch - just mark as merged
    if (!branch.headHash) {
      branch.status = "merged"
      await fs.writeFile(branchPath(branchSessionID), JSON.stringify(branch, null, 2))

      await Changelog.append({
        type: "branch-merge",
        timestamp: new Date().toISOString(),
        data: {
          branchSessionID,
          empty: true,
        },
      })

      log.debug("Merged empty branch", { branchSessionID })
      return null
    }

    // Get commits for three-way merge
    const mainHead = await Commits.readHead()
    const branchCommit = await Commits.read(branch.headHash)
    const baseCommit = branch.baseCommitHash !== "root"
      ? await Commits.read(branch.baseCommitHash)
      : null

    if (!branchCommit) {
      log.warn("Branch commit not found", { hash: branch.headHash })
      return null
    }

    // Three-way merge
    const mainCommit = mainHead ? await Commits.read(mainHead.hash) : null
    const { mergedState, conflicts } = threeWayMerge(
      baseCommit?.state ?? null,
      mainCommit?.state ?? null,
      branchCommit.state,
    )

    // Create merge commit on main
    const mergeCommit = await Commits.create(
      mergedState,
      "branch-merge",
      branchCommit.session,
    )

    // Merge corrections discovered on branch
    const mergedCorrections = await mergeCorrections(branchSessionID)

    // Create merge record
    const mergeHash = createHash("sha256")
      .update(JSON.stringify({ branchSessionID, timestamp: new Date().toISOString() }))
      .digest("hex")
      .slice(0, 16)

    const mergeRecord: MergeRecord = {
      mergeHash,
      branchSessionID,
      baseCommitHash: branch.baseCommitHash,
      branchCommitHash: branch.headHash,
      mainCommitHash: mainHead?.hash ?? "root",
      timestamp: new Date().toISOString(),
      conflicts,
      discoveries: mergedState.discoveries,
      corrections: mergedCorrections,
    }

    await fs.mkdir(mergesDir(), { recursive: true })
    await fs.writeFile(mergePath(mergeHash), JSON.stringify(mergeRecord, null, 2))

    // Mark branch as merged
    branch.status = "merged"
    await fs.writeFile(branchPath(branchSessionID), JSON.stringify(branch, null, 2))

    await Changelog.append({
      type: "branch-merge",
      timestamp: mergeRecord.timestamp,
      data: {
        branchSessionID,
        mergeHash: mergeCommit.hash,
        conflicts: conflicts.length,
        discoveries: mergedState.discoveries.length,
      },
    })

    log.info("Merged branch", {
      branchSessionID,
      mergeHash: mergeCommit.hash,
      conflicts: conflicts.length,
    })

    return mergeRecord
  }

  /**
   * Abandon a branch (subagent crashed or cancelled).
   */
  export async function abandon(branchSessionID: string): Promise<void> {
    const branch = await get(branchSessionID)
    if (!branch) return

    branch.status = "abandoned"
    await fs.writeFile(branchPath(branchSessionID), JSON.stringify(branch, null, 2))

    await Changelog.append({
      type: "branch-abandon",
      timestamp: new Date().toISOString(),
      data: { sessionID: branchSessionID },
    })

    log.debug("Abandoned branch", { branchSessionID })
  }

  /**
   * List all branches.
   */
  export async function all(): Promise<BranchRef[]> {
    try {
      await fs.mkdir(branchesDir(), { recursive: true })
      const files = await fs.readdir(branchesDir())
      const branches: BranchRef[] = []

      for (const file of files) {
        if (!file.endsWith(".json")) continue
        try {
          const content = await fs.readFile(path.join(branchesDir(), file), "utf-8")
          branches.push(JSON.parse(content) as BranchRef)
        } catch {}
      }

      return branches
    } catch {
      return []
    }
  }

  /**
   * Garbage collect old merged/abandoned branches.
   */
  export async function gc(): Promise<number> {
    const branches = await all()
    const now = Date.now()
    let removed = 0

    for (const branch of branches) {
      if (branch.status === "active") continue

      const age = now - new Date(branch.created).getTime()
      if (age > MAX_BRANCH_AGE_MS) {
        try {
          await fs.unlink(branchPath(branch.sessionID))
          removed++
        } catch {}
      }
    }

    if (removed > 0) {
      log.debug("GC: removed old branches", { count: removed })
    }

    return removed
  }
}

// --- Three-way merge logic ---

function threeWayMerge(
  base: CommitState | null,
  main: CommitState | null,
  branch: CommitState | null,
): { mergedState: CommitState; conflicts: ConflictResolution[] } {
  const conflicts: ConflictResolution[] = []

  const empty: CommitState = {
    goal: "",
    workingFiles: [],
    inProgress: "",
    completed: [],
    discoveries: [],
    activeMemories: [],
    activePatterns: [],
  }

  const b = base ?? empty
  const m = main ?? empty
  const br = branch ?? empty

  const merged: CommitState = {
    // Goal: prefer main (subagent works on subtask)
    goal: m.goal || br.goal,

    // workingFiles: union of all
    workingFiles: mergeArraysUnique(b.workingFiles, m.workingFiles, br.workingFiles).slice(0, 20),

    // inProgress: take main
    inProgress: m.inProgress || br.inProgress,

    // completed: union
    completed: mergeArraysUnique(b.completed, m.completed, br.completed),

    // discoveries: append branch to main (cap at 10)
    discoveries: mergeDiscoveries(m.discoveries, br.discoveries, b.discoveries, conflicts),

    // activeMemories: union
    activeMemories: mergeArraysUnique(b.activeMemories, m.activeMemories, br.activeMemories).slice(0, 10),

    // activePatterns: union
    activePatterns: mergeArraysUnique(b.activePatterns, m.activePatterns, br.activePatterns).slice(0, 10),
  }

  return { mergedState: merged, conflicts }
}

function mergeArraysUnique<T>(...arrays: T[][]): T[] {
  const set = new Set<T>()
  for (const arr of arrays) {
    for (const item of arr) set.add(item)
  }
  return [...set]
}

function mergeDiscoveries(
  mainDiscoveries: string[],
  branchDiscoveries: string[],
  baseDiscoveries: string[],
  conflicts: ConflictResolution[],
): string[] {
  // Find new discoveries from branch (not in base or main)
  const existing = new Set([
    ...baseDiscoveries.map(d => d.toLowerCase()),
    ...mainDiscoveries.map(d => d.toLowerCase()),
  ])

  const newDiscoveries: string[] = []
  for (const discovery of branchDiscoveries) {
    if (!existing.has(discovery.toLowerCase())) {
      newDiscoveries.push(discovery)
    }
  }

  const merged = [...mainDiscoveries, ...newDiscoveries].slice(0, 10)

  if (newDiscoveries.length > 0) {
    conflicts.push({
      field: "discoveries",
      resolution: "merge",
      mainValue: mainDiscoveries,
      branchValue: branchDiscoveries,
      resolvedValue: merged,
    })
  }

  return merged
}

// --- Corrections merge ---

async function mergeCorrections(branchSessionID: string): Promise<string[]> {
  // Get corrections created during this session
  // For now, corrections are global - they auto-merge
  // Future: session-scoped corrections
  const corrections = await Corrections.all()
  return corrections.map(c => c.id)
}
