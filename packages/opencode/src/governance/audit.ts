/**
 * @fileoverview Governance Audit Module
 *
 * This module provides comprehensive audit logging for all governance checks.
 * Every tool execution that passes through the governance system is recorded,
 * creating a complete audit trail for compliance, debugging, and monitoring.
 *
 * ## Storage Options
 *
 * Audit entries can be stored in two ways:
 *
 * - **file**: Persisted to disk via the Storage namespace (default)
 * - **memory**: Kept in an in-memory buffer (useful for testing or ephemeral sessions)
 *
 * ## Event Publishing
 *
 * The module publishes bus events for real-time notification:
 *
 * - `governance.checked`: Published for every governance check
 * - `governance.policy_violation`: Published when a tool is denied
 *
 * These events enable integrations like Slack alerts, metrics dashboards,
 * or custom monitoring solutions.
 *
 * ## Retention
 *
 * For memory storage, entries are automatically pruned when exceeding
 * MAX_MEMORY_ENTRIES (1000). File storage retention is handled externally.
 *
 * @module governance/audit
 */

import { GovernanceTypes } from "./types"
import { Storage } from "../storage/storage"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import { Identifier } from "../id/id"
import { Log } from "../util/log"

export namespace GovernanceAudit {
  const log = Log.create({ service: "governance.audit" })

  /**
   * Audit configuration options.
   *
   * @property enabled - Whether audit logging is active (default: true)
   * @property storage - Where to store entries: "file" or "memory" (default: "file")
   * @property retention - Days to retain audit entries (for external cleanup)
   * @property include_args - Whether to include tool arguments in audit entries
   *
   * @example
   * ```typescript
   * const config: AuditConfig = {
   *   enabled: true,
   *   storage: "file",
   *   retention: 30,        // Keep for 30 days
   *   include_args: false   // Don't log sensitive arguments
   * }
   * ```
   */
  export interface AuditConfig {
    enabled?: boolean
    storage?: "file" | "memory"
    retention?: number
    include_args?: boolean
  }

  /**
   * In-memory buffer for audit entries.
   * Used when storage = "memory" for testing or ephemeral sessions.
   */
  const memoryBuffer: GovernanceTypes.AuditEntry[] = []

  /**
   * Maximum number of entries to keep in memory buffer.
   * Oldest entries are removed when this limit is exceeded.
   */
  const MAX_MEMORY_ENTRIES = 1000

  /**
   * Record an audit entry for a governance check.
   *
   * This function is called by the main governance check function after
   * every evaluation, regardless of outcome. It:
   *
   * 1. Generates a unique ID and timestamp
   * 2. Optionally strips tool arguments (based on config)
   * 3. Stores the entry (file or memory)
   * 4. Publishes bus events for real-time notifications
   *
   * @param entry - Audit entry data (without id and timestamp)
   * @param config - Audit configuration
   * @returns The complete audit entry with id and timestamp
   *
   * @example
   * ```typescript
   * const entry = await GovernanceAudit.record(
   *   {
   *     sessionID: "session_abc",
   *     callID: "call_123",
   *     tool: "bash",
   *     targets: [{ raw: "10.0.0.1", type: "ip", normalized: "10.0.0.1" }],
   *     outcome: "allowed",
   *     policy: "Allow internal network",
   *     reason: "Matched policy: Allow internal network",
   *     args: { command: "ping 10.0.0.1" },
   *     duration: 5
   *   },
   *   { enabled: true, storage: "file", include_args: true }
   * )
   *
   * console.log(entry.id)        // "tool_01ABC123..."
   * console.log(entry.timestamp) // 1705312800000
   * ```
   */
  export async function record(
    entry: Omit<GovernanceTypes.AuditEntry, "id" | "timestamp">,
    config: AuditConfig | undefined
  ): Promise<GovernanceTypes.AuditEntry> {
    // Create the complete entry with generated id and timestamp
    const fullEntry: GovernanceTypes.AuditEntry = {
      ...entry,
      id: Identifier.ascending("tool"),
      timestamp: Date.now(),
      // Remove args if not configured to include them (privacy/security)
      args: config?.include_args ? entry.args : undefined,
    }

    // If audit is disabled, just return the entry without storing
    if (config?.enabled === false) {
      log.debug("Audit logging disabled, skipping storage")
      return fullEntry
    }

    // Store the entry based on configured storage type
    try {
      if (config?.storage === "memory") {
        // Store in memory buffer with automatic pruning
        memoryBuffer.push(fullEntry)
        if (memoryBuffer.length > MAX_MEMORY_ENTRIES) {
          memoryBuffer.shift() // Remove oldest entry
        }
        log.debug("Audit entry stored in memory", { id: fullEntry.id })
      } else {
        // File storage via Storage namespace
        // Key format: ["governance", "audit", projectId, entryId]
        const key = ["governance", "audit", Instance.project.id, fullEntry.id]
        await Storage.write(key, fullEntry)
        log.debug("Audit entry stored to file", { id: fullEntry.id })
      }
    } catch (err) {
      // Don't fail the governance check if audit storage fails
      log.error("Failed to write audit entry", {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // Publish bus events for real-time notifications
    try {
      // Always publish the general "checked" event
      await Bus.publish(GovernanceTypes.Event.Checked, { entry: fullEntry })

      // Publish policy violation event for denied outcomes
      if (fullEntry.outcome === "denied") {
        await Bus.publish(GovernanceTypes.Event.PolicyViolation, {
          entry: fullEntry,
          policy: fullEntry.policy || "scope-violation",
        })
      }
    } catch (err) {
      // Don't fail if event publishing fails
      log.error("Failed to publish audit event", {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return fullEntry
  }

  /**
   * List audit entries with optional filters.
   *
   * Retrieves audit entries from the configured storage (file or memory)
   * with optional filtering by session ID or outcome.
   *
   * @param config - Audit configuration (determines storage type)
   * @param options - Query options
   * @param options.limit - Maximum entries to return (default: 100)
   * @param options.sessionID - Filter by session ID
   * @param options.outcome - Filter by outcome (allowed, denied, etc.)
   * @returns Array of matching audit entries (most recent last)
   *
   * @example
   * ```typescript
   * // Get last 50 denied entries
   * const denied = await GovernanceAudit.list(config, {
   *   limit: 50,
   *   outcome: "denied"
   * })
   *
   * // Get all entries for a specific session
   * const sessionEntries = await GovernanceAudit.list(config, {
   *   sessionID: "session_abc"
   * })
   * ```
   */
  export async function list(
    config: AuditConfig | undefined,
    options?: {
      limit?: number
      sessionID?: string
      outcome?: GovernanceTypes.Outcome
    }
  ): Promise<GovernanceTypes.AuditEntry[]> {
    const limit = options?.limit || 100

    // Memory storage - filter and return from buffer
    if (config?.storage === "memory") {
      let entries = [...memoryBuffer]

      // Apply filters
      if (options?.sessionID) {
        entries = entries.filter((e) => e.sessionID === options.sessionID)
      }
      if (options?.outcome) {
        entries = entries.filter((e) => e.outcome === options.outcome)
      }

      // Apply limit (take most recent)
      return entries.slice(-limit)
    }

    // File storage - read from Storage namespace
    try {
      const keys = await Storage.list(["governance", "audit", Instance.project.id])
      const entries: GovernanceTypes.AuditEntry[] = []

      // Read entries (most recent first based on limit)
      const keysToRead = keys.slice(-limit)

      for (const key of keysToRead) {
        try {
          const entry = await Storage.read<GovernanceTypes.AuditEntry>(key)

          // Apply filters
          if (options?.sessionID && entry.sessionID !== options.sessionID) continue
          if (options?.outcome && entry.outcome !== options.outcome) continue

          entries.push(entry)
        } catch {
          // Skip entries that fail to read (corrupted, etc.)
        }
      }

      return entries
    } catch {
      return []
    }
  }

  /**
   * Get a single audit entry by ID.
   *
   * Searches both memory buffer and file storage for the entry.
   *
   * @param id - The audit entry ID to find
   * @returns The audit entry if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const entry = await GovernanceAudit.get("tool_01ABC123")
   * if (entry) {
   *   console.log(`Tool ${entry.tool} was ${entry.outcome}`)
   * }
   * ```
   */
  export async function get(id: string): Promise<GovernanceTypes.AuditEntry | undefined> {
    // Check memory buffer first (faster)
    const memoryEntry = memoryBuffer.find((e) => e.id === id)
    if (memoryEntry) return memoryEntry

    // Try file storage
    try {
      const keys = await Storage.list(["governance", "audit", Instance.project.id])
      const matchingKey = keys.find((k) => k[k.length - 1] === id)
      if (matchingKey) {
        return await Storage.read<GovernanceTypes.AuditEntry>(matchingKey)
      }
    } catch {
      // Entry not found in file storage
    }

    return undefined
  }

  /**
   * Clear all audit entries from memory buffer.
   *
   * Useful for testing or resetting state. Only affects memory storage,
   * not file-based entries.
   *
   * @example
   * ```typescript
   * // In tests
   * beforeEach(() => {
   *   GovernanceAudit.clearMemory()
   * })
   * ```
   */
  export function clearMemory(): void {
    memoryBuffer.length = 0
  }

  /**
   * Get the count of audit entries in memory buffer.
   *
   * Useful for testing or monitoring memory usage.
   *
   * @returns Number of entries currently in memory
   *
   * @example
   * ```typescript
   * const count = GovernanceAudit.memoryCount()
   * console.log(`${count} entries in memory`)
   * ```
   */
  export function memoryCount(): number {
    return memoryBuffer.length
  }
}
