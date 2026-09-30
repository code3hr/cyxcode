/**
 * CyxCode Centralized Path Resolution
 *
 * Single source of truth for all cyxcode state paths.
 * Replaces duplicated walk-up-directory logic across learned.ts, memory.ts, dream.ts, versioning/types.ts.
 *
 * Supports two modes:
 *   - "cyxcode": .cyxcode/ directory exists (after `cyxcode init`)
 *   - "opencode": fallback to .opencode/ (current/legacy behavior)
 *
 * Uses globalThis cache to survive Bun --conditions=browser module duplication.
 */

import path from "path"
import os from "os"
import fs from "fs"
import { context } from "../project/context"

type Root = {
  root: string
  mode: "cyxcode" | "opencode"
}

// A single cached result is bounded and keyed by its complete resolution context.
const state = globalThis as typeof globalThis & { __cyxcode_paths?: { key: string; value: Root } }

// --- Walk-up directory resolution ---

function workspace(dir: string): boolean {
  try {
    const pkg: unknown = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"))
    return typeof pkg === "object" && pkg !== null && "workspaces" in pkg
  } catch (err) {
    if (err instanceof SyntaxError || (err instanceof Error && "code" in err && err.code === "ENOENT")) return false
    throw err
  }
}

function resolve(start: string, limit: string | undefined, homes: string[]): Root {
  let dir = start
  let cyx: Root | undefined
  let legacy: Root | undefined
  let nearest: Root | undefined
  while (true) {
    // Home state is global unless the user explicitly opened home as the project.
    if (dir !== start && homes.some((home) => path.relative(dir, home) === "")) break
    if (!cyx && fs.statSync(path.join(dir, ".cyxcode"), { throwIfNoEntry: false })?.isDirectory()) {
      cyx = { root: dir, mode: "cyxcode" }
      nearest ??= cyx
    }
    if (!legacy && fs.statSync(path.join(dir, ".opencode"), { throwIfNoEntry: false })?.isDirectory()) {
      legacy = { root: dir, mode: "opencode" }
      nearest ??= legacy
    }
    // Repository/workspace boundaries apply even before a state directory exists.
    if (
      (limit !== undefined && path.relative(dir, limit) === "") ||
      fs.existsSync(path.join(dir, ".git")) ||
      workspace(dir)
    ) {
      return cyx ?? legacy ?? { root: dir, mode: "opencode" }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return nearest ?? { root: start, mode: "opencode" }
}

function findProjectRoot(): Root {
  const scope = context.get()
  const start = path.resolve(scope?.directory ?? process.cwd())
  const limit = scope?.worktree && scope.worktree !== path.parse(scope.worktree).root ? scope.worktree : undefined
  const homes = [path.resolve(homeDir()), path.resolve(os.homedir())]
  const key = JSON.stringify([start, limit, homes])
  if (state.__cyxcode_paths?.key === key) return state.__cyxcode_paths.value
  const value = resolve(start, limit, homes)
  state.__cyxcode_paths = { key, value }
  return value
}

// --- Global paths ---

function homeDir(): string {
  // Respect test home override (from global/index.ts pattern)
  return process.env.CYXWIZ_TEST_HOME || process.env.CYXCODE_TEST_HOME || os.homedir()
}

// --- Public API ---

export namespace CyxPaths {
  /** Detect whether .cyxcode/ or .opencode/ is active */
  export function detectMode(): "cyxcode" | "opencode" {
    return findProjectRoot().mode
  }

  /** The project root directory (where .cyxcode/ or .opencode/ lives) */
  export function projectRoot(): string {
    return findProjectRoot().root
  }

  /** The project state directory (.cyxcode/ or .opencode/) */
  export function projectDir(): string {
    const { root, mode } = findProjectRoot()
    return path.join(root, mode === "cyxcode" ? ".cyxcode" : ".opencode")
  }

  // --- Project-level paths ---

  /** Learned patterns file */
  export function learnedPath(): string {
    const { root, mode } = findProjectRoot()
    if (mode === "cyxcode") {
      return path.join(root, ".cyxcode", "patterns", "learned.json")
    }
    return path.join(root, ".opencode", "cyxcode-learned.json")
  }

  /** Memory directory */
  export function memoryDir(): string {
    const { root, mode } = findProjectRoot()
    return path.join(root, mode === "cyxcode" ? ".cyxcode" : ".opencode", "memory")
  }

  /** Command directory (slash commands) */
  export function commandDir(): string {
    const { root, mode } = findProjectRoot()
    return path.join(root, mode === "cyxcode" ? ".cyxcode" : ".opencode", "command")
  }
  /** State versioning history directory */
  export function historyDir(): string {
    const { root, mode } = findProjectRoot()
    return path.join(root, mode === "cyxcode" ? ".cyxcode" : ".opencode", "history")
  }

  /** Router stats file */
  export function statsPath(): string {
    const { root, mode } = findProjectRoot()
    if (mode === "cyxcode") {
      return path.join(root, ".cyxcode", "stats.json")
    }
    return path.join(root, ".opencode", "cyxcode-stats.json")
  }

  /** Corrections directory (inside history) */
  export function correctionsDir(): string {
    return path.join(historyDir(), "corrections")
  }

  /** Wiki directory */
  export function wikiDir(): string {
    const { root, mode } = findProjectRoot()
    return path.join(root, mode === "cyxcode" ? ".cyxcode" : ".opencode", "wiki")
  }

  /** Code graph directory */
  export function codegraphDir(): string {
    const { root, mode } = findProjectRoot()
    return path.join(root, mode === "cyxcode" ? ".cyxcode" : ".opencode", "codegraph")
  }

  // --- Global-level paths (~/.cyxcode/) ---

  /** Global cyxcode directory */
  export function globalDir(): string {
    return path.join(homeDir(), ".cyxcode")
  }

  /** Global learned patterns */
  export function globalLearnedPath(): string {
    return path.join(homeDir(), ".cyxcode", "patterns", "learned.json")
  }

  /** Global memory directory */
  export function globalMemoryDir(): string {
    return path.join(homeDir(), ".cyxcode", "memory")
  }

  /** Global corrections directory */
  export function globalCorrectionsDir(): string {
    return path.join(homeDir(), ".cyxcode", "corrections")
  }

  /** Global community patterns directory */
  export function globalCommunityDir(): string {
    return path.join(homeDir(), ".cyxcode", "community")
  }

  /** Global stats file */
  export function globalStatsPath(): string {
    return path.join(homeDir(), ".cyxcode", "stats.json")
  }

  /** Global config file */
  export function globalConfigPath(): string {
    return path.join(homeDir(), ".cyxcode", "config.json")
  }

  /** Clear all cached paths (call after cyxcode init or migration) */
  export function invalidateCache(): void {
    delete state.__cyxcode_paths
  }
}
