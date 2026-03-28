/**
 * @fileoverview CyxCode Audit Module
 *
 * Token accountability built on existing infrastructure.
 * Extends governance/audit patterns for CyxCode-specific event tracking.
 *
 * ## Features
 *
 * - **Event Journal**: Track pattern matches, corrections, drift events
 * - **Privacy Guard**: Redact secrets before storage
 * - **Token Accounting**: Calculate savings from pattern matches
 * - **Reports**: Generate token savings reports
 *
 * ## Storage
 *
 * Uses the existing Storage namespace with key format:
 * ["cyxcode", "audit", projectId, entryId]
 *
 * ## Events
 *
 * Publishes to existing Bus infrastructure for real-time notifications.
 *
 * @module cyxcode/audit
 */

import { Storage } from "../storage/storage"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import { BusEvent } from "../bus/bus-event"
import { Log } from "../util/log"
import z from "zod"

const log = Log.create({ service: "cyxcode.audit" })

// ============================================================================
// Privacy Guard
// ============================================================================

/**
 * Patterns for detecting secrets that should be redacted.
 * Covers common API keys, tokens, and credentials.
 */
const SECRET_PATTERNS: Record<string, RegExp> = {
  openai: /sk-[a-zA-Z0-9]{32,}/g,
  anthropic: /sk-ant-[a-zA-Z0-9-]{32,}/g,
  generic: /(?:api[_-]?key|token|secret|password)\s*[=:]\s*["']?([^\s"']+)/gi,
  jwt: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  hex: /\b[a-fA-F0-9]{32,}\b/g,
  urlCreds: /:\/\/[^:]+:[^@]+@/g,
  aws: /AKIA[0-9A-Z]{16}/g,
  github: /ghp_[a-zA-Z0-9]{36}/g,
  npm: /npm_[a-zA-Z0-9]{36}/g,
}

/**
 * Redact secrets from text before storage.
 *
 * @param text - Text that may contain secrets
 * @returns Text with secrets replaced by [REDACTED:type]
 *
 * @example
 * ```typescript
 * const clean = redactSecrets("API key: sk-ant-abc123...")
 * // Returns: "API key: [REDACTED:anthropic]"
 * ```
 */
export function redactSecrets(text: string): string {
  let clean = text
  for (const [name, pattern] of Object.entries(SECRET_PATTERNS)) {
    clean = clean.replace(pattern, `[REDACTED:${name}]`)
  }
  return clean
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * CyxCode event types for audit logging.
 */
export type CyxEventType =
  | "cyxcode.pattern.match" // Pattern matched, tokens saved
  | "cyxcode.pattern.miss" // No match, AI handled
  | "cyxcode.pattern.learned" // New pattern generated
  | "cyxcode.correction.added" // User ran /correct
  | "cyxcode.correction.reinforced" // Strength increased
  | "cyxcode.correction.promoted" // Strength >= 3, added to system
  | "cyxcode.drift.detected" // AI violated correction
  | "cyxcode.drift.reminded" // Auto-reminder injected
  | "cyxcode.memory.loaded" // Memory matched context
  | "cyxcode.commit.created" // State snapshot
  | "cyxcode.session.start" // New session began
  | "cyxcode.session.end" // Session ended

/**
 * Audit entry data structure.
 */
export type CyxAuditEntry = {
  id: string
  timestamp: number
  type: CyxEventType
  sessionID?: string
  data: {
    // Pattern events
    patternId?: string
    skill?: string
    tokensSaved?: number
    tokensUsed?: number
    errorOutput?: string // Redacted
    // Correction events
    correctionId?: string
    rule?: string
    strength?: number
    // Memory events
    memoryId?: string
    tags?: string[]
    chars?: number
    // Commit events
    commitHash?: string
    trigger?: string
    // Generic
    message?: string
  }
}

// ============================================================================
// Bus Events
// ============================================================================

/**
 * Bus event definitions for CyxCode audit events.
 * These enable real-time notifications and integrations.
 */
export namespace CyxEvents {
  export const PatternMatch = BusEvent.define(
    "cyxcode.pattern.match",
    z.object({
      patternId: z.string(),
      skill: z.string(),
      tokensSaved: z.number(),
    })
  )

  export const PatternMiss = BusEvent.define(
    "cyxcode.pattern.miss",
    z.object({
      tokensUsed: z.number(),
      errorLength: z.number(),
    })
  )

  export const PatternLearned = BusEvent.define(
    "cyxcode.pattern.learned",
    z.object({
      patternId: z.string(),
      source: z.string(),
    })
  )

  export const CorrectionAdded = BusEvent.define(
    "cyxcode.correction.added",
    z.object({
      correctionId: z.string(),
      rule: z.string(),
      strength: z.number(),
    })
  )

  export const CorrectionReinforced = BusEvent.define(
    "cyxcode.correction.reinforced",
    z.object({
      correctionId: z.string(),
      rule: z.string(),
      strength: z.number(),
    })
  )

  export const CorrectionPromoted = BusEvent.define(
    "cyxcode.correction.promoted",
    z.object({
      correctionId: z.string(),
      rule: z.string(),
    })
  )

  export const DriftDetected = BusEvent.define(
    "cyxcode.drift.detected",
    z.object({
      correctionId: z.string(),
      rule: z.string(),
      violation: z.string(),
    })
  )

  export const DriftReminded = BusEvent.define(
    "cyxcode.drift.reminded",
    z.object({
      correctionId: z.string(),
      rule: z.string(),
    })
  )

  export const MemoryLoaded = BusEvent.define(
    "cyxcode.memory.loaded",
    z.object({
      memoryId: z.string(),
      tags: z.array(z.string()),
      chars: z.number(),
    })
  )

  export const CommitCreated = BusEvent.define(
    "cyxcode.commit.created",
    z.object({
      hash: z.string(),
      trigger: z.string(),
    })
  )

  export const SessionStart = BusEvent.define(
    "cyxcode.session.start",
    z.object({
      sessionId: z.string(),
    })
  )

  export const SessionEnd = BusEvent.define(
    "cyxcode.session.end",
    z.object({
      sessionId: z.string(),
      tokensSaved: z.number(),
      tokensUsed: z.number(),
    })
  )
}

// ============================================================================
// CyxAudit Namespace
// ============================================================================

export namespace CyxAudit {
  /**
   * In-memory buffer for audit entries.
   * Used for fast access and testing.
   */
  const memoryBuffer: CyxAuditEntry[] = []
  const MAX_MEMORY_ENTRIES = 1000

  /**
   * Generate a unique audit entry ID.
   */
  function generateId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 8)
    return `cyx_${timestamp}_${random}`
  }

  /**
   * Record an audit entry.
   *
   * @param type - Event type
   * @param data - Event data (secrets will be redacted)
   * @param sessionID - Optional session ID
   * @returns The recorded entry
   *
   * @example
   * ```typescript
   * await CyxAudit.record("cyxcode.pattern.match", {
   *   patternId: "npm-404",
   *   skill: "recovery",
   *   tokensSaved: 800
   * })
   * ```
   */
  export async function record(
    type: CyxEventType,
    data: CyxAuditEntry["data"],
    sessionID?: string
  ): Promise<CyxAuditEntry> {
    // Redact any secrets in the data
    const cleanData = { ...data }
    if (cleanData.errorOutput) {
      cleanData.errorOutput = redactSecrets(cleanData.errorOutput)
    }
    if (cleanData.rule) {
      cleanData.rule = redactSecrets(cleanData.rule)
    }
    if (cleanData.message) {
      cleanData.message = redactSecrets(cleanData.message)
    }

    const entry: CyxAuditEntry = {
      id: generateId(),
      timestamp: Date.now(),
      type,
      sessionID,
      data: cleanData,
    }

    // Store in memory buffer
    memoryBuffer.push(entry)
    if (memoryBuffer.length > MAX_MEMORY_ENTRIES) {
      memoryBuffer.shift()
    }

    // Store to file via Storage namespace
    try {
      const key = ["cyxcode", "audit", Instance.project.id, entry.id]
      await Storage.write(key, entry)
      log.debug("Audit entry stored", { id: entry.id, type })
    } catch (err) {
      log.error("Failed to write audit entry", {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // Publish bus event
    try {
      await publishEvent(entry)
    } catch (err) {
      log.error("Failed to publish audit event", {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return entry
  }

  /**
   * Publish the appropriate bus event for an audit entry.
   */
  async function publishEvent(entry: CyxAuditEntry): Promise<void> {
    switch (entry.type) {
      case "cyxcode.pattern.match":
        await Bus.publish(CyxEvents.PatternMatch, {
          patternId: entry.data.patternId || "",
          skill: entry.data.skill || "",
          tokensSaved: entry.data.tokensSaved || 0,
        })
        break
      case "cyxcode.pattern.miss":
        await Bus.publish(CyxEvents.PatternMiss, {
          tokensUsed: entry.data.tokensUsed || 0,
          errorLength: entry.data.errorOutput?.length || 0,
        })
        break
      case "cyxcode.pattern.learned":
        await Bus.publish(CyxEvents.PatternLearned, {
          patternId: entry.data.patternId || "",
          source: entry.data.message || "unknown",
        })
        break
      case "cyxcode.correction.added":
        await Bus.publish(CyxEvents.CorrectionAdded, {
          correctionId: entry.data.correctionId || "",
          rule: entry.data.rule || "",
          strength: entry.data.strength || 1,
        })
        break
      case "cyxcode.correction.reinforced":
        await Bus.publish(CyxEvents.CorrectionReinforced, {
          correctionId: entry.data.correctionId || "",
          rule: entry.data.rule || "",
          strength: entry.data.strength || 1,
        })
        break
      case "cyxcode.correction.promoted":
        await Bus.publish(CyxEvents.CorrectionPromoted, {
          correctionId: entry.data.correctionId || "",
          rule: entry.data.rule || "",
        })
        break
      case "cyxcode.drift.detected":
        await Bus.publish(CyxEvents.DriftDetected, {
          correctionId: entry.data.correctionId || "",
          rule: entry.data.rule || "",
          violation: entry.data.message || "",
        })
        break
      case "cyxcode.drift.reminded":
        await Bus.publish(CyxEvents.DriftReminded, {
          correctionId: entry.data.correctionId || "",
          rule: entry.data.rule || "",
        })
        break
      case "cyxcode.memory.loaded":
        await Bus.publish(CyxEvents.MemoryLoaded, {
          memoryId: entry.data.memoryId || "",
          tags: entry.data.tags || [],
          chars: entry.data.chars || 0,
        })
        break
      case "cyxcode.commit.created":
        await Bus.publish(CyxEvents.CommitCreated, {
          hash: entry.data.commitHash || "",
          trigger: entry.data.trigger || "",
        })
        break
      case "cyxcode.session.start":
        await Bus.publish(CyxEvents.SessionStart, {
          sessionId: entry.sessionID || "",
        })
        break
      case "cyxcode.session.end":
        await Bus.publish(CyxEvents.SessionEnd, {
          sessionId: entry.sessionID || "",
          tokensSaved: entry.data.tokensSaved || 0,
          tokensUsed: entry.data.tokensUsed || 0,
        })
        break
    }
  }

  /**
   * List audit entries with optional filters.
   *
   * @param options - Query options
   * @returns Array of matching entries (most recent last)
   */
  export async function list(options?: {
    limit?: number
    since?: number
    type?: CyxEventType
    sessionID?: string
  }): Promise<CyxAuditEntry[]> {
    const limit = options?.limit || 100
    const since = options?.since || 0

    try {
      const keys = await Storage.list(["cyxcode", "audit", Instance.project.id])
      const entries: CyxAuditEntry[] = []

      // Read entries (most recent based on limit)
      const keysToRead = keys.slice(-limit * 2) // Read extra to filter

      for (const key of keysToRead) {
        try {
          const entry = await Storage.read<CyxAuditEntry>(key)

          // Apply filters
          if (entry.timestamp < since) continue
          if (options?.type && entry.type !== options.type) continue
          if (options?.sessionID && entry.sessionID !== options.sessionID) continue

          entries.push(entry)
        } catch {
          // Skip corrupted entries
        }
      }

      // Sort by timestamp and limit
      return entries
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-limit)
    } catch {
      // Fall back to memory buffer
      let entries = [...memoryBuffer]
      if (since) entries = entries.filter((e) => e.timestamp >= since)
      if (options?.type) entries = entries.filter((e) => e.type === options.type)
      if (options?.sessionID) entries = entries.filter((e) => e.sessionID === options.sessionID)
      return entries.slice(-limit)
    }
  }

  /**
   * Get a single audit entry by ID.
   */
  export async function get(id: string): Promise<CyxAuditEntry | undefined> {
    // Check memory buffer first
    const memoryEntry = memoryBuffer.find((e) => e.id === id)
    if (memoryEntry) return memoryEntry

    // Try file storage
    try {
      const keys = await Storage.list(["cyxcode", "audit", Instance.project.id])
      const matchingKey = keys.find((k) => k[k.length - 1] === id)
      if (matchingKey) {
        return await Storage.read<CyxAuditEntry>(matchingKey)
      }
    } catch {
      // Entry not found
    }

    return undefined
  }

  /**
   * Get recent entries from memory buffer (fast, no I/O).
   */
  export function recent(count: number = 10): CyxAuditEntry[] {
    return memoryBuffer.slice(-count)
  }

  /**
   * Clear memory buffer (for testing).
   */
  export function clearMemory(): void {
    memoryBuffer.length = 0
  }

  /**
   * Get memory buffer count.
   */
  export function memoryCount(): number {
    return memoryBuffer.length
  }

  /**
   * Prune old audit entries.
   * Called by /dream to clean up old data.
   *
   * @param maxAge - Maximum age in days (default: 30)
   * @returns Number of entries pruned
   */
  export async function prune(maxAge: number = 30): Promise<number> {
    const cutoff = Date.now() - maxAge * 24 * 60 * 60 * 1000
    let pruned = 0

    try {
      const keys = await Storage.list(["cyxcode", "audit", Instance.project.id])

      for (const key of keys) {
        try {
          const entry = await Storage.read<CyxAuditEntry>(key)
          if (entry.timestamp < cutoff) {
            await Storage.remove(key)
            pruned++
          }
        } catch {
          // Skip unreadable entries
        }
      }

      log.info("Pruned audit entries", { pruned, maxAge })
    } catch (err) {
      log.error("Failed to prune audit entries", {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return pruned
  }

  /**
   * Get aggregate statistics for a time period.
   *
   * @param since - Start timestamp (default: 24 hours ago)
   * @returns Aggregated stats
   */
  export async function stats(since?: number): Promise<{
    tokensSaved: number
    tokensUsed: number
    patternMatches: number
    patternMisses: number
    hitRate: number
    correctionsAdded: number
    driftEvents: number
    patternsLearned: number
  }> {
    const entries = await list({ since: since || Date.now() - 24 * 60 * 60 * 1000, limit: 10000 })

    let tokensSaved = 0
    let tokensUsed = 0
    let patternMatches = 0
    let patternMisses = 0
    let correctionsAdded = 0
    let driftEvents = 0
    let patternsLearned = 0

    for (const entry of entries) {
      switch (entry.type) {
        case "cyxcode.pattern.match":
          patternMatches++
          tokensSaved += entry.data.tokensSaved || 0
          break
        case "cyxcode.pattern.miss":
          patternMisses++
          tokensUsed += entry.data.tokensUsed || 0
          break
        case "cyxcode.correction.added":
          correctionsAdded++
          break
        case "cyxcode.drift.detected":
          driftEvents++
          break
        case "cyxcode.pattern.learned":
          patternsLearned++
          break
      }
    }

    const total = patternMatches + patternMisses
    const hitRate = total > 0 ? patternMatches / total : 0

    return {
      tokensSaved,
      tokensUsed,
      patternMatches,
      patternMisses,
      hitRate,
      correctionsAdded,
      driftEvents,
      patternsLearned,
    }
  }
}
