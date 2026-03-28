/**
 * CyxCode State Versioning — Public API
 *
 * Git for AI state. Auto-commits on compaction and session end.
 * Events only, no hooks, no blocking.
 */

import { MessageV2 } from "@/session/message-v2"
import { Session } from "@/session"
import { Log } from "@/util/log"
import { Commits } from "./commit"
import { Changelog } from "./changelog"
import type { CommitState } from "./types"

const log = Log.create({ service: "cyxcode-versioning" })

export { Commits } from "./commit"
export { Changelog } from "./changelog"
export { Branch } from "./branch"
export type * from "./types"

// Track last active session for process exit handler
let lastSessionID: string | undefined

export namespace StateVersioning {

  export function trackSession(sessionID: string) {
    lastSessionID = sessionID
  }

  export async function autoCommit(
    sessionID: string,
    trigger: "compaction" | "session-end" | "manual",
  ): Promise<void> {
    try {
      const state = await extractState(sessionID)

      // Skip empty state
      if (!state.goal && state.workingFiles.length === 0) return

      const session = await Session.get(sessionID)

      // Check if this is a subagent session (has parent)
      // If so, commit to the branch instead of main
      const branchSessionID = session.parentID ? sessionID : undefined

      const commit = await Commits.create(state, trigger, {
        slug: session.slug,
        timestamp: new Date(session.time.created).toISOString(),
      }, branchSessionID)

      // Only log to changelog for main branch commits
      // Branch commits are tracked via branch-merge event
      if (!branchSessionID) {
        await Changelog.append({
          type: "commit",
          timestamp: commit.timestamp,
          data: {
            hash: commit.hash,
            trigger,
            session: session.slug,
            files: state.workingFiles.length,
          },
        })
      }

      log.debug("Auto-committed state", {
        hash: commit.hash,
        trigger,
        files: state.workingFiles.length,
        branch: branchSessionID,
      })
    } catch (e) {
      log.warn("Auto-commit failed", { error: e })
    }
  }
}

// --- State extraction from session messages ---

async function extractState(sessionID: string): Promise<CommitState> {
  const msgs: MessageV2.WithParts[] = []
  for await (const msg of MessageV2.stream(sessionID as any)) {
    msgs.push(msg)
  }

  // Load active memories and patterns
  let memoryIds: string[] = []
  let patternIds: string[] = []
  try {
    const { Memory } = await import("@/cyxcode/memory")
    const idx = await Memory.readIndex()
    memoryIds = idx.entries.filter(e => e.accessCount > 0).map(e => e.id).slice(0, 10)
  } catch {}
  try {
    const { LearnedPatterns } = await import("@/cyxcode/learned")
    const data = await LearnedPatterns.read()
    patternIds = data.approved.map((p: any) => ((p as any).generatedPattern || p).id).slice(0, 10)
  } catch {}

  return {
    goal: extractGoal(msgs),
    workingFiles: extractFiles(msgs),
    inProgress: extractInProgress(msgs),
    completed: [],
    discoveries: extractDiscoveries(msgs),
    activeMemories: memoryIds,
    activePatterns: patternIds,
  }
}

function extractGoal(msgs: MessageV2.WithParts[]): string {
  // First user message is typically the goal
  for (const msg of msgs) {
    if (msg.info.role === "user") {
      const text = msg.parts.find((p): p is MessageV2.TextPart => p.type === "text" && !p.synthetic)
      if (text) return text.text.slice(0, 200)
    }
  }
  return ""
}

function extractFiles(msgs: MessageV2.WithParts[]): string[] {
  const files = new Set<string>()
  for (const msg of msgs) {
    for (const part of msg.parts) {
      if (part.type === "tool" && part.state.status === "completed") {
        const input = part.state.input as Record<string, any>
        if (input?.file_path) files.add(String(input.file_path))
        if (input?.path && typeof input.path === "string" && input.path.length > 0) {
          files.add(input.path)
        }
      }
    }
  }
  return [...files].slice(0, 20)
}

function extractInProgress(msgs: MessageV2.WithParts[]): string {
  // Last user message is likely the current task
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].info.role === "user") {
      const text = msgs[i].parts.find((p): p is MessageV2.TextPart => p.type === "text" && !p.synthetic)
      if (text) return text.text.slice(0, 200)
    }
  }
  return ""
}

function extractDiscoveries(msgs: MessageV2.WithParts[]): string[] {
  // Extract notable findings from AI responses (look for key phrases)
  const discoveries: string[] = []
  const patterns = [/found that/i, /note that/i, /the issue was/i, /discovered/i, /turns out/i, /important:/i]

  for (const msg of msgs) {
    if (msg.info.role !== "assistant") continue
    for (const part of msg.parts) {
      if (part.type !== "text" || part.synthetic) continue
      const lines = part.text.split("\n")
      for (const line of lines) {
        if (patterns.some(p => p.test(line)) && line.length > 20 && line.length < 200) {
          discoveries.push(line.trim())
          if (discoveries.length >= 5) return discoveries
        }
      }
    }
  }
  return discoveries
}

// --- Process exit handler ---
// Catches Ctrl+C, SIGTERM, and normal exit to commit state

let exitHandlerRegistered = false

export function registerExitHandler() {
  if (exitHandlerRegistered) return
  exitHandlerRegistered = true

  const handler = async () => {
    if (lastSessionID) {
      try {
        await StateVersioning.autoCommit(lastSessionID, "session-end")
      } catch {}
    }
  }

  // beforeExit fires on clean exit (not on SIGINT/SIGTERM)
  process.on("beforeExit", () => {
    handler()
  })

  // SIGINT (Ctrl+C) — keep process alive until commit completes
  process.on("SIGINT", () => {
    // Prevent immediate exit
    setTimeout(() => process.exit(0), 5000) // hard timeout 5s
    handler().then(() => process.exit(0)).catch(() => process.exit(0))
  })

  // SIGTERM
  process.on("SIGTERM", () => {
    setTimeout(() => process.exit(0), 5000)
    handler().then(() => process.exit(0)).catch(() => process.exit(0))
  })

  // SIGHUP (terminal closed)
  process.on("SIGHUP", () => {
    setTimeout(() => process.exit(0), 5000)
    handler().then(() => process.exit(0)).catch(() => process.exit(0))
  })

  // Normal exit
  process.on("exit", () => {
    // Sync write as last resort — exit handler can't be async
    if (lastSessionID) {
      try {
        const fs = require("fs")
        const path = require("path")
        let dir = process.cwd()
        for (let i = 0; i < 10; i++) {
          const candidate = path.join(dir, ".opencode", "history")
          try { fs.accessSync(candidate); break } catch {}
          dir = path.dirname(dir)
        }
        const exitMarker = path.join(dir, ".opencode", "history", "pending-commit.json")
        fs.writeFileSync(exitMarker, JSON.stringify({ sessionID: lastSessionID, timestamp: new Date().toISOString() }))
      } catch {}
    }
  })
}
