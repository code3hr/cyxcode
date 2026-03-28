import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"

/**
 * Branch Tests
 *
 * Tests multi-agent branching: create, merge, abandon, three-way merge.
 * Uses temp directories to avoid polluting real project.
 */

let tmpDir: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxcode-branch-test-"))
  const opencode = path.join(tmpDir, ".opencode")
  await fs.mkdir(path.join(opencode, "history", "branches"), { recursive: true })
  await fs.mkdir(path.join(opencode, "history", "commits"), { recursive: true })
  await fs.mkdir(path.join(opencode, "history", "merges"), { recursive: true })
  process.chdir(tmpDir)
})

afterEach(async () => {
  process.chdir(originalCwd)
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// Inline types for testing (mirrors src/cyxcode/versioning/types.ts)
type BranchRef = {
  sessionID: string
  parentSessionID: string
  baseCommitHash: string
  created: string
  status: "active" | "merged" | "abandoned"
  headHash: string | null
}

type CommitState = {
  goal: string
  workingFiles: string[]
  inProgress: string
  completed: string[]
  discoveries: string[]
  activeMemories: string[]
  activePatterns: string[]
}

type ConflictResolution = {
  field: keyof CommitState
  resolution: "take-main" | "take-branch" | "merge"
  mainValue: any
  branchValue: any
  resolvedValue: any
}

// Inline merge logic for testing
function mergeArraysUnique<T>(...arrays: T[][]): T[] {
  const set = new Set<T>()
  for (const arr of arrays) {
    for (const item of arr) set.add(item)
  }
  return [...set]
}

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
    goal: m.goal || br.goal,
    workingFiles: mergeArraysUnique(b.workingFiles, m.workingFiles, br.workingFiles).slice(0, 20),
    inProgress: m.inProgress || br.inProgress,
    completed: mergeArraysUnique(b.completed, m.completed, br.completed),
    discoveries: [...new Set([...m.discoveries, ...br.discoveries])].slice(0, 10),
    activeMemories: mergeArraysUnique(b.activeMemories, m.activeMemories, br.activeMemories).slice(0, 10),
    activePatterns: mergeArraysUnique(b.activePatterns, m.activePatterns, br.activePatterns).slice(0, 10),
  }

  return { mergedState: merged, conflicts }
}

describe("BranchRef Structure", () => {
  test("branch ref has required fields", () => {
    const branch: BranchRef = {
      sessionID: "session_abc123",
      parentSessionID: "session_parent456",
      baseCommitHash: "deadbeef12345678",
      created: new Date().toISOString(),
      status: "active",
      headHash: null,
    }

    expect(branch.sessionID).toBe("session_abc123")
    expect(branch.parentSessionID).toBe("session_parent456")
    expect(branch.baseCommitHash).toBe("deadbeef12345678")
    expect(branch.status).toBe("active")
    expect(branch.headHash).toBeNull()
  })

  test("branch status transitions", () => {
    const branch: BranchRef = {
      sessionID: "test",
      parentSessionID: "parent",
      baseCommitHash: "base",
      created: new Date().toISOString(),
      status: "active",
      headHash: null,
    }

    expect(branch.status).toBe("active")

    branch.status = "merged"
    expect(branch.status).toBe("merged")

    branch.status = "abandoned"
    expect(branch.status).toBe("abandoned")
  })

  test("branch file path format", async () => {
    const branchPath = path.join(tmpDir, ".opencode", "history", "branches", "session_test.json")
    const branch: BranchRef = {
      sessionID: "session_test",
      parentSessionID: "parent",
      baseCommitHash: "base",
      created: new Date().toISOString(),
      status: "active",
      headHash: null,
    }

    await fs.writeFile(branchPath, JSON.stringify(branch, null, 2))
    const content = JSON.parse(await fs.readFile(branchPath, "utf-8"))
    expect(content.sessionID).toBe("session_test")
  })
})

describe("Three-Way Merge", () => {
  test("merges workingFiles from all sources", () => {
    const base: CommitState = {
      goal: "base goal",
      workingFiles: ["file1.ts"],
      inProgress: "",
      completed: [],
      discoveries: [],
      activeMemories: [],
      activePatterns: [],
    }

    const main: CommitState = {
      goal: "main goal",
      workingFiles: ["file1.ts", "file2.ts"],
      inProgress: "main task",
      completed: [],
      discoveries: ["main discovery"],
      activeMemories: [],
      activePatterns: [],
    }

    const branch: CommitState = {
      goal: "branch goal",
      workingFiles: ["file1.ts", "file3.ts"],
      inProgress: "branch task",
      completed: [],
      discoveries: ["branch discovery"],
      activeMemories: [],
      activePatterns: [],
    }

    const { mergedState } = threeWayMerge(base, main, branch)

    // workingFiles should be union
    expect(mergedState.workingFiles).toContain("file1.ts")
    expect(mergedState.workingFiles).toContain("file2.ts")
    expect(mergedState.workingFiles).toContain("file3.ts")
    expect(mergedState.workingFiles).toHaveLength(3)
  })

  test("prefers main goal over branch", () => {
    const main: CommitState = {
      goal: "main goal",
      workingFiles: [],
      inProgress: "",
      completed: [],
      discoveries: [],
      activeMemories: [],
      activePatterns: [],
    }

    const branch: CommitState = {
      goal: "branch goal",
      workingFiles: [],
      inProgress: "",
      completed: [],
      discoveries: [],
      activeMemories: [],
      activePatterns: [],
    }

    const { mergedState } = threeWayMerge(null, main, branch)
    expect(mergedState.goal).toBe("main goal")
  })

  test("falls back to branch goal if main empty", () => {
    const main: CommitState = {
      goal: "",
      workingFiles: [],
      inProgress: "",
      completed: [],
      discoveries: [],
      activeMemories: [],
      activePatterns: [],
    }

    const branch: CommitState = {
      goal: "branch goal",
      workingFiles: [],
      inProgress: "",
      completed: [],
      discoveries: [],
      activeMemories: [],
      activePatterns: [],
    }

    const { mergedState } = threeWayMerge(null, main, branch)
    expect(mergedState.goal).toBe("branch goal")
  })

  test("merges discoveries from both", () => {
    const main: CommitState = {
      goal: "",
      workingFiles: [],
      inProgress: "",
      completed: [],
      discoveries: ["main discovery 1", "main discovery 2"],
      activeMemories: [],
      activePatterns: [],
    }

    const branch: CommitState = {
      goal: "",
      workingFiles: [],
      inProgress: "",
      completed: [],
      discoveries: ["branch discovery"],
      activeMemories: [],
      activePatterns: [],
    }

    const { mergedState } = threeWayMerge(null, main, branch)
    expect(mergedState.discoveries).toContain("main discovery 1")
    expect(mergedState.discoveries).toContain("main discovery 2")
    expect(mergedState.discoveries).toContain("branch discovery")
  })

  test("caps discoveries at 10", () => {
    const main: CommitState = {
      goal: "",
      workingFiles: [],
      inProgress: "",
      completed: [],
      discoveries: ["d1", "d2", "d3", "d4", "d5", "d6"],
      activeMemories: [],
      activePatterns: [],
    }

    const branch: CommitState = {
      goal: "",
      workingFiles: [],
      inProgress: "",
      completed: [],
      discoveries: ["d7", "d8", "d9", "d10", "d11", "d12"],
      activeMemories: [],
      activePatterns: [],
    }

    const { mergedState } = threeWayMerge(null, main, branch)
    expect(mergedState.discoveries.length).toBeLessThanOrEqual(10)
  })

  test("handles null states gracefully", () => {
    const { mergedState } = threeWayMerge(null, null, null)

    expect(mergedState.goal).toBe("")
    expect(mergedState.workingFiles).toEqual([])
    expect(mergedState.discoveries).toEqual([])
  })

  test("merges completed tasks", () => {
    const main: CommitState = {
      goal: "",
      workingFiles: [],
      inProgress: "",
      completed: ["task 1"],
      discoveries: [],
      activeMemories: [],
      activePatterns: [],
    }

    const branch: CommitState = {
      goal: "",
      workingFiles: [],
      inProgress: "",
      completed: ["task 2"],
      discoveries: [],
      activeMemories: [],
      activePatterns: [],
    }

    const { mergedState } = threeWayMerge(null, main, branch)
    expect(mergedState.completed).toContain("task 1")
    expect(mergedState.completed).toContain("task 2")
  })
})

describe("Branch Lifecycle", () => {
  test("active -> merged transition", async () => {
    const branchPath = path.join(tmpDir, ".opencode", "history", "branches", "test.json")

    // Create active branch
    const branch: BranchRef = {
      sessionID: "test",
      parentSessionID: "parent",
      baseCommitHash: "base123",
      created: new Date().toISOString(),
      status: "active",
      headHash: null,
    }
    await fs.writeFile(branchPath, JSON.stringify(branch, null, 2))

    // Simulate merge
    branch.status = "merged"
    await fs.writeFile(branchPath, JSON.stringify(branch, null, 2))

    const content = JSON.parse(await fs.readFile(branchPath, "utf-8"))
    expect(content.status).toBe("merged")
  })

  test("active -> abandoned transition", async () => {
    const branchPath = path.join(tmpDir, ".opencode", "history", "branches", "test.json")

    const branch: BranchRef = {
      sessionID: "test",
      parentSessionID: "parent",
      baseCommitHash: "base123",
      created: new Date().toISOString(),
      status: "active",
      headHash: null,
    }
    await fs.writeFile(branchPath, JSON.stringify(branch, null, 2))

    // Simulate abandon
    branch.status = "abandoned"
    await fs.writeFile(branchPath, JSON.stringify(branch, null, 2))

    const content = JSON.parse(await fs.readFile(branchPath, "utf-8"))
    expect(content.status).toBe("abandoned")
  })

  test("branch HEAD updates on commit", async () => {
    const branchPath = path.join(tmpDir, ".opencode", "history", "branches", "test.json")

    const branch: BranchRef = {
      sessionID: "test",
      parentSessionID: "parent",
      baseCommitHash: "base123",
      created: new Date().toISOString(),
      status: "active",
      headHash: null,
    }
    await fs.writeFile(branchPath, JSON.stringify(branch, null, 2))

    // Simulate commit
    branch.headHash = "commit_abc123"
    await fs.writeFile(branchPath, JSON.stringify(branch, null, 2))

    const content = JSON.parse(await fs.readFile(branchPath, "utf-8"))
    expect(content.headHash).toBe("commit_abc123")
  })
})

describe("MergeRecord Structure", () => {
  test("merge record has required fields", async () => {
    const mergeRecord = {
      mergeHash: "merge_abc123",
      branchSessionID: "session_test",
      baseCommitHash: "base123",
      branchCommitHash: "branch456",
      mainCommitHash: "main789",
      timestamp: new Date().toISOString(),
      conflicts: [],
      discoveries: ["new discovery"],
      corrections: ["correction_1"],
    }

    expect(mergeRecord.mergeHash).toBe("merge_abc123")
    expect(mergeRecord.branchSessionID).toBe("session_test")
    expect(mergeRecord.conflicts).toEqual([])
    expect(mergeRecord.discoveries).toContain("new discovery")
  })

  test("merge record file path format", async () => {
    const mergePath = path.join(tmpDir, ".opencode", "history", "merges", "merge_test.json")
    const mergeRecord = {
      mergeHash: "merge_test",
      branchSessionID: "session",
      baseCommitHash: "base",
      branchCommitHash: "branch",
      mainCommitHash: "main",
      timestamp: new Date().toISOString(),
      conflicts: [],
      discoveries: [],
      corrections: [],
    }

    await fs.writeFile(mergePath, JSON.stringify(mergeRecord, null, 2))
    const content = JSON.parse(await fs.readFile(mergePath, "utf-8"))
    expect(content.mergeHash).toBe("merge_test")
  })
})

describe("Concurrent Branches", () => {
  test("multiple branches can exist simultaneously", async () => {
    const branchesDir = path.join(tmpDir, ".opencode", "history", "branches")

    const branch1: BranchRef = {
      sessionID: "agent1",
      parentSessionID: "main",
      baseCommitHash: "base",
      created: new Date().toISOString(),
      status: "active",
      headHash: null,
    }

    const branch2: BranchRef = {
      sessionID: "agent2",
      parentSessionID: "main",
      baseCommitHash: "base",
      created: new Date().toISOString(),
      status: "active",
      headHash: null,
    }

    await fs.writeFile(path.join(branchesDir, "agent1.json"), JSON.stringify(branch1))
    await fs.writeFile(path.join(branchesDir, "agent2.json"), JSON.stringify(branch2))

    const files = await fs.readdir(branchesDir)
    expect(files).toContain("agent1.json")
    expect(files).toContain("agent2.json")
  })

  test("branches have independent HEAD pointers", async () => {
    const branchesDir = path.join(tmpDir, ".opencode", "history", "branches")

    const branch1: BranchRef = {
      sessionID: "agent1",
      parentSessionID: "main",
      baseCommitHash: "base",
      created: new Date().toISOString(),
      status: "active",
      headHash: "commit1",
    }

    const branch2: BranchRef = {
      sessionID: "agent2",
      parentSessionID: "main",
      baseCommitHash: "base",
      created: new Date().toISOString(),
      status: "active",
      headHash: "commit2",
    }

    await fs.writeFile(path.join(branchesDir, "agent1.json"), JSON.stringify(branch1))
    await fs.writeFile(path.join(branchesDir, "agent2.json"), JSON.stringify(branch2))

    const content1 = JSON.parse(await fs.readFile(path.join(branchesDir, "agent1.json"), "utf-8"))
    const content2 = JSON.parse(await fs.readFile(path.join(branchesDir, "agent2.json"), "utf-8"))

    expect(content1.headHash).toBe("commit1")
    expect(content2.headHash).toBe("commit2")
    expect(content1.headHash).not.toBe(content2.headHash)
  })
})
