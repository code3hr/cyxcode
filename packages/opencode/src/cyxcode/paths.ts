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

type PathCache = {
  mode?: "cyxcode" | "opencode"
  projectRoot?: string
  projectDir?: string
}

// Use globalThis to share cache across module instances (Bun --conditions=browser)
const g = globalThis as any
if (!g.__cyxcode_paths_cache) g.__cyxcode_paths_cache = {} as PathCache
const cache: PathCache = g.__cyxcode_paths_cache

// --- Walk-up directory resolution ---

function findProjectRoot(): { root: string; mode: "cyxcode" | "opencode" } {
  if (cache.projectRoot && cache.mode) {
    return { root: cache.projectRoot, mode: cache.mode }
  }

  let dir = process.cwd()
  let foundOpencode: string | undefined
  let foundCyxcode: string | undefined

  for (let i = 0; i < 10; i++) {
    // Check for .cyxcode/ first (higher priority)
    if (!foundCyxcode) {
      const cyxCandidate = path.join(dir, ".cyxcode")
      try {
        require("fs").accessSync(cyxCandidate)
        foundCyxcode = dir
      } catch {}
    }

    // Check for .opencode/ as fallback
    if (!foundOpencode) {
      const ocCandidate = path.join(dir, ".opencode")
      try {
        require("fs").accessSync(ocCandidate)
        foundOpencode = dir
      } catch {}
    }

    // Prefer root that has .git or workspace package.json
    if (foundCyxcode || foundOpencode) {
      const hasGit = (() => { try { require("fs").accessSync(path.join(dir, ".git")); return true } catch { return false } })()
      const hasRootPkg = (() => { try { const p = JSON.parse(require("fs").readFileSync(path.join(dir, "package.json"), "utf-8")); return p.workspaces !== undefined } catch { return false } })()
      if (hasGit || hasRootPkg) {
        // Found a definitive project root — use whichever mode is available here
        if (foundCyxcode) {
          cache.projectRoot = foundCyxcode
          cache.mode = "cyxcode"
        } else {
          cache.projectRoot = foundOpencode!
          cache.mode = "opencode"
        }
        return { root: cache.projectRoot, mode: cache.mode }
      }
    }

    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  // No .git or workspace root found — use whatever we found
  if (foundCyxcode) {
    cache.projectRoot = foundCyxcode
    cache.mode = "cyxcode"
  } else if (foundOpencode) {
    cache.projectRoot = foundOpencode
    cache.mode = "opencode"
  } else {
    // Nothing found — default to cwd with opencode mode
    cache.projectRoot = process.cwd()
    cache.mode = "opencode"
  }

  return { root: cache.projectRoot, mode: cache.mode }
}

// --- Global paths ---

function homeDir(): string {
  // Respect test home override (from global/index.ts pattern)
  return process.env.CYXWIZ_TEST_HOME || os.homedir()
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
    if (cache.projectDir) return cache.projectDir
    const { root, mode } = findProjectRoot()
    cache.projectDir = path.join(root, mode === "cyxcode" ? ".cyxcode" : ".opencode")
    return cache.projectDir
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
    cache.mode = undefined
    cache.projectRoot = undefined
    cache.projectDir = undefined
  }
}
