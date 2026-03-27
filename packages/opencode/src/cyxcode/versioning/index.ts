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
export type * from "./types"

export namespace StateVersioning {

  export async function autoCommit(
    sessionID: string,
    trigger: "compaction" | "session-end" | "manual",
  ): Promise<void> {
    try {
      const state = await extractState(sessionID)

      // Skip empty state
      if (!state.goal && state.workingFiles.length === 0) return

      const session = await Session.get(sessionID)
      const commit = await Commits.create(state, trigger, {
        slug: session.slug,
        timestamp: new Date(session.time.created).toISOString(),
      })

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

      log.debug("Auto-committed state", {
        hash: commit.hash,
        trigger,
        files: state.workingFiles.length,
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

  return {
    goal: extractGoal(msgs),
    workingFiles: extractFiles(msgs),
    inProgress: extractInProgress(msgs),
    completed: [],
    discoveries: [],
    activeMemories: [],
    activePatterns: [],
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
        if (input?.path && typeof input.path === "string" && input.path.includes("/")) {
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
