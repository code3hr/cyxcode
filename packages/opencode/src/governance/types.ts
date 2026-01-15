/**
 * @fileoverview Governance Types Module
 *
 * This module defines the core types and Zod schemas used throughout the
 * Governance Engine. All types are defined as Zod schemas for runtime
 * validation and TypeScript type inference.
 *
 * ## Type Hierarchy
 *
 * - **Outcome**: Result of a governance check (allowed, denied, pending-approval, error)
 * - **TargetType**: Classification of extracted targets (ip, cidr, domain, url, unknown)
 * - **Target**: A network target extracted from tool arguments
 * - **AuditEntry**: Complete audit log record of a governance check
 * - **CheckRequest**: Input to the governance check function
 * - **CheckResult**: Output from the governance check function
 *
 * ## Bus Events
 *
 * The module also defines governance-related bus events for real-time
 * notification of governance checks and policy violations.
 *
 * @module governance/types
 */

import z from "zod"
import { BusEvent } from "../bus/bus-event"

export namespace GovernanceTypes {
  /**
   * Outcome of a governance check.
   *
   * - `allowed`: Tool execution can proceed without additional approval
   * - `denied`: Tool execution is blocked by governance policy
   * - `pending-approval`: Tool execution requires user approval (defers to permission system)
   * - `error`: An error occurred during governance check
   *
   * @example
   * ```typescript
   * const outcome: GovernanceTypes.Outcome = "allowed"
   * ```
   */
  export const Outcome = z.enum(["allowed", "denied", "pending-approval", "error"])
  export type Outcome = z.infer<typeof Outcome>

  /**
   * Classification of a network target extracted from tool arguments.
   *
   * - `ip`: IPv4 address (e.g., "192.168.1.1")
   * - `cidr`: CIDR notation (e.g., "10.0.0.0/8")
   * - `domain`: Domain name (e.g., "example.com")
   * - `url`: Full URL (e.g., "https://example.com/path")
   * - `unknown`: Could not be classified
   *
   * @example
   * ```typescript
   * const targetType: GovernanceTypes.TargetType = "domain"
   * ```
   */
  export const TargetType = z.enum(["ip", "cidr", "domain", "url", "unknown"])
  export type TargetType = z.infer<typeof TargetType>

  /**
   * A network target extracted from tool arguments.
   *
   * Targets are extracted by the Matcher module and represent potential
   * network endpoints that the tool might interact with.
   *
   * @property raw - Original string that was classified
   * @property type - Detected target type (ip, cidr, domain, url, unknown)
   * @property normalized - Normalized form for consistent matching
   *   - URLs: hostname is extracted and lowercased
   *   - Domains: lowercased
   *   - IPs/CIDRs: kept as-is
   *
   * @example
   * ```typescript
   * const target: GovernanceTypes.Target = {
   *   raw: "https://API.Example.COM/v1/users",
   *   type: "url",
   *   normalized: "api.example.com"
   * }
   * ```
   */
  export const Target = z.object({
    raw: z.string().describe("Original string that was classified"),
    type: TargetType.describe("Detected target type"),
    normalized: z.string().describe("Normalized form (e.g., hostname from URL, lowercase domain)"),
  })
  export type Target = z.infer<typeof Target>

  /**
   * Complete audit log entry for a governance check.
   *
   * Audit entries are created for every governance check, regardless of outcome.
   * They provide a complete audit trail of tool executions and governance decisions.
   *
   * @property id - Unique audit entry ID (ascending for chronological ordering)
   * @property timestamp - Unix timestamp in milliseconds when the check occurred
   * @property sessionID - Session that executed the tool
   * @property callID - Unique tool call ID for correlation with tool execution
   * @property tool - Name of the tool that was checked
   * @property targets - Network targets extracted from tool arguments
   * @property outcome - Result of the governance check
   * @property policy - Name of the policy that matched (if any)
   * @property reason - Human-readable explanation of the decision
   * @property args - Tool arguments (only included if audit.include_args is true)
   * @property duration - Time taken for governance check in milliseconds
   *
   * @example
   * ```typescript
   * const entry: GovernanceTypes.AuditEntry = {
   *   id: "tool_01ABC123",
   *   timestamp: 1705312800000,
   *   sessionID: "session_xyz",
   *   callID: "call_456",
   *   tool: "bash",
   *   targets: [{ raw: "10.0.0.1", type: "ip", normalized: "10.0.0.1" }],
   *   outcome: "allowed",
   *   policy: "Allow internal network",
   *   reason: "Matched policy: Allow internal network",
   *   duration: 5
   * }
   * ```
   */
  export const AuditEntry = z.object({
    id: z.string().describe("Unique audit entry ID"),
    timestamp: z.number().describe("Unix timestamp in milliseconds"),
    sessionID: z.string().describe("Session that executed the tool"),
    callID: z.string().describe("Unique tool call ID"),
    tool: z.string().describe("Tool name that was executed"),
    targets: z.array(Target).describe("Targets extracted from tool arguments"),
    outcome: Outcome.describe("Result of governance check"),
    policy: z.string().optional().describe("Name of matched policy"),
    reason: z.string().optional().describe("Human-readable explanation"),
    args: z.record(z.string(), z.any()).optional().describe("Tool arguments (if audit.include_args is true)"),
    duration: z.number().optional().describe("Time taken for governance check in ms"),
  })
  export type AuditEntry = z.infer<typeof AuditEntry>

  /**
   * Input to the governance check function.
   *
   * @property sessionID - Current session ID for audit logging
   * @property callID - Unique tool call ID for correlation
   * @property tool - Name of the tool being executed
   * @property args - Tool arguments to analyze for network targets
   *
   * @example
   * ```typescript
   * const request: GovernanceTypes.CheckRequest = {
   *   sessionID: "session_abc",
   *   callID: "call_123",
   *   tool: "bash",
   *   args: { command: "curl https://api.example.com" }
   * }
   * ```
   */
  export const CheckRequest = z.object({
    sessionID: z.string().describe("Session ID"),
    callID: z.string().describe("Tool call ID"),
    tool: z.string().describe("Tool name"),
    args: z.record(z.string(), z.any()).describe("Tool arguments"),
  })
  export type CheckRequest = z.infer<typeof CheckRequest>

  /**
   * Output from the governance check function.
   *
   * @property allowed - Whether tool execution should proceed
   * @property outcome - Detailed outcome classification
   * @property targets - Network targets that were extracted and checked
   * @property matchedPolicy - Name of the policy that determined the outcome
   * @property reason - Human-readable explanation of the decision
   *
   * @example
   * ```typescript
   * const result: GovernanceTypes.CheckResult = {
   *   allowed: true,
   *   outcome: "allowed",
   *   targets: [{ raw: "10.0.0.1", type: "ip", normalized: "10.0.0.1" }],
   *   matchedPolicy: "Allow internal network",
   *   reason: "Matched policy: Allow internal network"
   * }
   * ```
   */
  export const CheckResult = z.object({
    allowed: z.boolean().describe("Whether execution should proceed"),
    outcome: Outcome.describe("Detailed outcome"),
    targets: z.array(Target).describe("Extracted targets"),
    matchedPolicy: z.string().optional().describe("Policy that matched"),
    reason: z.string().optional().describe("Explanation"),
  })
  export type CheckResult = z.infer<typeof CheckResult>

  /**
   * Bus events for governance notifications.
   *
   * These events are published after each governance check, enabling
   * real-time monitoring and alerting on governance decisions.
   *
   * @property Checked - Published after every governance check
   * @property PolicyViolation - Published when a tool is denied by governance
   *
   * @example
   * ```typescript
   * // Subscribe to all governance checks
   * Bus.subscribe(GovernanceTypes.Event.Checked, ({ entry }) => {
   *   console.log(`Tool ${entry.tool} was ${entry.outcome}`)
   * })
   *
   * // Subscribe to policy violations only
   * Bus.subscribe(GovernanceTypes.Event.PolicyViolation, ({ entry, policy }) => {
   *   alert(`Policy violation: ${policy}`)
   * })
   * ```
   */
  export const Event = {
    /** Published after every governance check completes */
    Checked: BusEvent.define(
      "governance.checked",
      z.object({
        entry: AuditEntry,
      })
    ),
    /** Published when a tool execution is denied by governance */
    PolicyViolation: BusEvent.define(
      "governance.policy_violation",
      z.object({
        entry: AuditEntry,
        policy: z.string(),
      })
    ),
  }
}
