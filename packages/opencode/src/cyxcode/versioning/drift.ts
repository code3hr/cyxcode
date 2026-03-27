/**
 * CyxCode State Versioning — Drift Detection
 *
 * Detects when AI stops following learned corrections.
 * If drift detected, correction strength increases automatically.
 */

import { Log } from "@/util/log"
import { MessageV2 } from "@/session/message-v2"
import { Corrections } from "./corrections"
import { Changelog } from "./changelog"
import type { Correction } from "./corrections"

const log = Log.create({ service: "cyxcode-versioning-drift" })

// Keywords that suggest the AI violated a correction
const VIOLATION_PATTERNS: Record<string, RegExp[]> = {
  "npm": [/\bnpm\s+install\b/i, /\bnpm\s+run\b/i, /\bnpm\s+i\b/i, /\bnpm\s+add\b/i],
  "yarn": [/\byarn\s+add\b/i, /\byarn\s+install\b/i],
  "bun": [/\bbun\s+add\b/i, /\bbun\s+install\b/i, /\bbun\s+run\b/i],
  "pnpm": [/\bpnpm\s+add\b/i, /\bpnpm\s+install\b/i],
  "git commit": [/\bgit\s+commit\b/i],
  "git push": [/\bgit\s+push\b/i],
}

export namespace Drift {
  /**
   * Check session messages for drift against active corrections.
   * Returns list of corrections that were violated.
   */
  export async function detect(sessionID: string): Promise<Correction[]> {
    const corrections = await Corrections.active()
    if (corrections.length === 0) return []

    // Get session messages
    const msgs: MessageV2.WithParts[] = []
    for await (const msg of MessageV2.stream(sessionID as any)) {
      msgs.push(msg)
    }

    // Extract AI actions from tool calls and text
    const aiActions = extractAIActions(msgs)
    const drifted: Correction[] = []

    for (const correction of corrections) {
      const violated = checkViolation(correction, aiActions)
      if (violated) {
        drifted.push(correction)
      }
    }

    return drifted
  }

  /**
   * Run drift detection and reinforce violated corrections.
   */
  export async function detectAndReinforce(sessionID: string): Promise<{
    drifted: number
    reinforced: string[]
  }> {
    try {
      const violations = await detect(sessionID)

      if (violations.length === 0) return { drifted: 0, reinforced: [] }

      const reinforced: string[] = []
      for (const correction of violations) {
        await Corrections.reinforce(correction)
        reinforced.push(correction.rule)

        await Changelog.append({
          type: "drift",
          timestamp: new Date().toISOString(),
          data: {
            id: correction.id,
            rule: correction.rule,
            strength: correction.strength + 1,
            sessionID,
          },
        })
      }

      log.info("Drift detected", {
        violations: violations.length,
        rules: reinforced,
      })

      return { drifted: violations.length, reinforced }
    } catch (e) {
      log.warn("Drift detection failed", { error: e })
      return { drifted: 0, reinforced: [] }
    }
  }
}

// --- Internal helpers ---

type AIAction = {
  type: "tool-command" | "tool-file" | "text"
  content: string
}

function extractAIActions(msgs: MessageV2.WithParts[]): AIAction[] {
  const actions: AIAction[] = []

  for (const msg of msgs) {
    if (msg.info.role !== "assistant") continue

    for (const part of msg.parts) {
      // Tool commands (bash)
      if (part.type === "tool" && part.state.status === "completed") {
        const input = part.state.input as Record<string, any>
        if (input?.command) {
          actions.push({ type: "tool-command", content: String(input.command) })
        }
        if (input?.file_path) {
          actions.push({ type: "tool-file", content: String(input.file_path) })
        }
      }

      // AI text responses
      if (part.type === "text" && !part.synthetic) {
        actions.push({ type: "text", content: part.text })
      }
    }
  }

  return actions
}

function checkViolation(correction: Correction, actions: AIAction[]): boolean {
  const rule = correction.rule.toLowerCase()

  // Parse "use X, not Y" pattern
  const useNotMatch = rule.match(/(?:always\s+)?use\s+(\w+)[\s,]+not\s+(\w+)/i)
  if (useNotMatch) {
    const preferred = useNotMatch[1].toLowerCase()
    const forbidden = useNotMatch[2].toLowerCase()

    // Check if AI used the forbidden tool
    const forbiddenPatterns = VIOLATION_PATTERNS[forbidden] || [new RegExp(`\\b${escapeRegex(forbidden)}\\b`, "i")]

    for (const action of actions) {
      if (action.type !== "tool-command") continue
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(action.content)) {
          // AI used forbidden tool — check if it also used preferred
          const preferredPatterns = VIOLATION_PATTERNS[preferred] || [new RegExp(`\\b${escapeRegex(preferred)}\\b`, "i")]
          const usedPreferred = actions.some(a =>
            a.type === "tool-command" && preferredPatterns.some(p => p.test(a.content))
          )
          // Only flag as drift if AI used forbidden WITHOUT also using preferred
          if (!usedPreferred) return true
        }
      }
    }
  }

  // Parse "don't X" / "never X" pattern
  const dontMatch = rule.match(/(?:don'?t|never|stop)\s+(.+)/i)
  if (dontMatch) {
    const forbidden = dontMatch[1].toLowerCase().trim()
    for (const action of actions) {
      if (action.content.toLowerCase().includes(forbidden)) {
        return true
      }
    }
  }

  return false
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
