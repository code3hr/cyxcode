/**
 * @fileoverview Governance Engine - Main Entry Point
 *
 * The Governance Engine provides comprehensive control over tool executions
 * in cyxcode. It enforces scope restrictions, policy-based rules, and
 * comprehensive audit logging for all AI tool operations.
 *
 * ## Architecture Overview
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     Tool Execution Request                      │
 * └─────────────────────────────────────────────────────────────────┘
 *                                 │
 *                                 ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    Governance.check()                           │
 * │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
 * │  │   Matcher   │→ │    Scope    │→ │   Policy    │             │
 * │  │  (extract)  │  │  (enforce)  │  │ (evaluate)  │             │
 * │  └─────────────┘  └─────────────┘  └─────────────┘             │
 * │                          │                │                     │
 * │                          ▼                ▼                     │
 * │                    ┌─────────────────────────┐                  │
 * │                    │         Audit           │                  │
 * │                    │   (record & publish)    │                  │
 * │                    └─────────────────────────┘                  │
 * └─────────────────────────────────────────────────────────────────┘
 *                                 │
 *                                 ▼
 *              ┌──────────────────┴──────────────────┐
 *              │                                     │
 *        ┌─────▼─────┐                        ┌─────▼─────┐
 *        │  Allowed  │                        │  Denied   │
 *        │(proceed)  │                        │(DeniedErr)│
 *        └───────────┘                        └───────────┘
 * ```
 *
 * ## Execution Flow
 *
 * 1. **Target Extraction** (Matcher): Analyze tool arguments for network targets
 * 2. **Scope Check** (Scope): Verify targets are within allowed IP/domain ranges
 * 3. **Policy Evaluation** (Policy): Match against policy rules for action
 * 4. **Audit Logging** (Audit): Record the check result and publish events
 * 5. **Result**: Allow execution, require approval, or throw DeniedError
 *
 * ## Integration
 *
 * The governance engine integrates with the plugin system via the
 * `tool.execute.before` hook. When governance denies a tool, it throws
 * `Governance.DeniedError` which is caught and handled gracefully by
 * the session prompt handler.
 *
 * ## Configuration
 *
 * Governance is configured in the project's `opencode.jsonc` file:
 *
 * ```jsonc
 * {
 *   "governance": {
 *     "enabled": true,
 *     "scope": { ... },
 *     "policies": [ ... ],
 *     "default_action": "require-approval",
 *     "audit": { ... }
 *   }
 * }
 * ```
 *
 * @module governance
 *
 * @example
 * ```typescript
 * import { Governance } from "./governance"
 *
 * // Check if a tool execution is allowed
 * const result = await Governance.check(
 *   {
 *     sessionID: "session_abc",
 *     callID: "call_123",
 *     tool: "bash",
 *     args: { command: "curl https://api.example.com" }
 *   },
 *   config.governance
 * )
 *
 * if (!result.allowed) {
 *   throw new Governance.DeniedError(result)
 * }
 * ```
 */

import { GovernanceTypes } from "./types"
import { GovernanceScope } from "./scope"
import { GovernancePolicy } from "./policy"
import { GovernanceAudit } from "./audit"
import { GovernanceMatcher } from "./matcher"
import { Log } from "../util/log"

export namespace Governance {
  const log = Log.create({ service: "governance" })

  // ============================================================================
  // Re-exports for convenient access
  // ============================================================================

  /**
   * Re-export of GovernanceTypes namespace.
   * Contains all type definitions, Zod schemas, and bus events.
   *
   * @see {@link GovernanceTypes}
   */
  export import Types = GovernanceTypes

  /**
   * Re-export of GovernanceScope namespace.
   * Contains scope checking functionality for IP/domain restrictions.
   *
   * @see {@link GovernanceScope}
   */
  export import Scope = GovernanceScope

  /**
   * Re-export of GovernancePolicy namespace.
   * Contains policy evaluation functionality.
   *
   * @see {@link GovernancePolicy}
   */
  export import Policy = GovernancePolicy

  /**
   * Re-export of GovernanceAudit namespace.
   * Contains audit logging functionality.
   *
   * @see {@link GovernanceAudit}
   */
  export import Audit = GovernanceAudit

  /**
   * Re-export of GovernanceMatcher namespace.
   * Contains target extraction and matching utilities.
   *
   * @see {@link GovernanceMatcher}
   */
  export import Matcher = GovernanceMatcher

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Governance configuration structure.
   *
   * This interface mirrors the governance section in the Config schema.
   * All fields are optional - governance is disabled by default.
   *
   * @property enabled - Master switch for governance (default: false)
   * @property scope - IP and domain allow/deny lists
   * @property policies - Array of policy rules (order matters!)
   * @property default_action - Action when no policy matches (default: require-approval)
   * @property audit - Audit logging configuration
   *
   * @example
   * ```typescript
   * const config: Governance.Config = {
   *   enabled: true,
   *   scope: {
   *     ip: { allow: ["10.0.0.0/8"] },
   *     domain: { deny: ["*.prod.*"] }
   *   },
   *   policies: [
   *     { action: "auto-approve", tools: ["read", "glob", "grep"] },
   *     { action: "blocked", tools: ["bash"], commands: ["rm -rf *"] }
   *   ],
   *   default_action: "require-approval",
   *   audit: { enabled: true, storage: "file" }
   * }
   * ```
   */
  export interface Config {
    enabled?: boolean
    scope?: GovernanceScope.ScopeConfig
    policies?: GovernancePolicy.PolicyConfig[]
    default_action?: GovernancePolicy.PolicyAction
    audit?: GovernanceAudit.AuditConfig
  }

  // ============================================================================
  // Core Functions
  // ============================================================================

  /**
   * Check if governance is enabled in the given config.
   *
   * Governance must be explicitly enabled - it's off by default.
   *
   * @param config - Governance configuration
   * @returns true if governance is enabled
   *
   * @example
   * ```typescript
   * if (Governance.isEnabled(config.governance)) {
   *   // Run governance checks
   * }
   * ```
   */
  export function isEnabled(config: Config | undefined): boolean {
    return config?.enabled === true
  }

  /**
   * Main governance check function.
   *
   * This is the primary entry point for all governance checks. It orchestrates
   * the full governance pipeline:
   *
   * 1. **Early exit**: If governance is disabled, allow immediately
   * 2. **Target extraction**: Analyze tool arguments for network targets
   * 3. **Scope check**: Verify targets are within allowed ranges
   * 4. **Policy evaluation**: Match against policy rules
   * 5. **Audit logging**: Record the result and publish events
   *
   * Called by the plugin system before tool execution (`tool.execute.before` hook).
   *
   * @param request - The governance check request
   * @param request.sessionID - Current session ID
   * @param request.callID - Unique tool call ID
   * @param request.tool - Name of the tool being executed
   * @param request.args - Tool arguments to analyze
   * @param config - Governance configuration
   * @returns Check result with allowed status, outcome, and metadata
   *
   * @example
   * ```typescript
   * const result = await Governance.check(
   *   {
   *     sessionID: "session_abc",
   *     callID: "call_123",
   *     tool: "bash",
   *     args: { command: "ssh user@prod.example.com" }
   *   },
   *   config.governance
   * )
   *
   * if (!result.allowed) {
   *   console.log(`Blocked: ${result.reason}`)
   *   // result.outcome === "denied"
   *   // result.matchedPolicy === "Block SSH to production"
   * }
   * ```
   */
  export async function check(
    request: GovernanceTypes.CheckRequest,
    config: Config | undefined
  ): Promise<GovernanceTypes.CheckResult> {
    // If governance is disabled, allow everything
    if (!isEnabled(config)) {
      return {
        allowed: true,
        outcome: "allowed",
        targets: [],
        reason: "Governance disabled",
      }
    }

    const startTime = Date.now()

    // Step 1: Extract network targets from tool arguments
    const targets = GovernanceMatcher.extractTargets(request.tool, request.args)

    log.info("Governance check", {
      tool: request.tool,
      targetCount: targets.length,
      targets: targets.map((t) => t.normalized),
    })

    // Step 2: Check scope restrictions (IP/domain allow/deny lists)
    const scopeResult = GovernanceScope.check(targets, config!.scope)
    if (!scopeResult.allowed) {
      const result: GovernanceTypes.CheckResult = {
        allowed: false,
        outcome: "denied",
        targets,
        reason: scopeResult.reason,
      }

      // Record audit entry for the denial
      await GovernanceAudit.record(
        {
          sessionID: request.sessionID,
          callID: request.callID,
          tool: request.tool,
          targets,
          outcome: "denied",
          reason: scopeResult.reason,
          args: request.args,
          duration: Date.now() - startTime,
        },
        config!.audit
      )

      log.warn("Governance denied (scope violation)", {
        tool: request.tool,
        reason: scopeResult.reason,
      })

      return result
    }

    // Step 3: Evaluate policies to determine action
    const policyResult = GovernancePolicy.evaluate(
      request.tool,
      request.args,
      targets,
      config!.policies,
      config!.default_action || "require-approval"
    )

    // Step 4: Determine outcome based on policy action
    let outcome: GovernanceTypes.Outcome
    let allowed: boolean

    switch (policyResult.action) {
      case "auto-approve":
        // Tool can proceed without user confirmation
        outcome = "allowed"
        allowed = true
        break
      case "blocked":
        // Tool is explicitly blocked
        outcome = "denied"
        allowed = false
        break
      case "require-approval":
        // Defer to existing permission system for user approval
        outcome = "pending-approval"
        allowed = true
        break
    }

    // Step 5: Record audit entry
    await GovernanceAudit.record(
      {
        sessionID: request.sessionID,
        callID: request.callID,
        tool: request.tool,
        targets,
        outcome,
        policy: policyResult.matchedPolicy,
        reason: policyResult.reason,
        args: request.args,
        duration: Date.now() - startTime,
      },
      config!.audit
    )

    // Log the result
    if (!allowed) {
      log.warn("Governance denied (policy blocked)", {
        tool: request.tool,
        policy: policyResult.matchedPolicy,
        reason: policyResult.reason,
      })
    } else {
      log.info("Governance result", {
        tool: request.tool,
        outcome,
        policy: policyResult.matchedPolicy,
      })
    }

    return {
      allowed,
      outcome,
      targets,
      matchedPolicy: policyResult.matchedPolicy,
      reason: policyResult.reason,
    }
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  /**
   * Error thrown when governance denies a tool execution.
   *
   * This error is thrown by the plugin trigger function when a governance
   * check returns `allowed: false`. It's caught by the session prompt
   * handler and converted to a user-friendly message.
   *
   * @property result - The full governance check result with details
   *
   * @example
   * ```typescript
   * const result = await Governance.check(request, config)
   *
   * if (!result.allowed) {
   *   throw new Governance.DeniedError(result)
   * }
   *
   * // Catching the error
   * try {
   *   await Plugin.trigger("tool.execute.before", input, output)
   * } catch (err) {
   *   if (err instanceof Governance.DeniedError) {
   *     return {
   *       output: `Blocked by governance: ${err.result.reason}`,
   *       metadata: { governance: err.result }
   *     }
   *   }
   *   throw err
   * }
   * ```
   */
  export class DeniedError extends Error {
    /**
     * Create a new DeniedError.
     *
     * @param result - The governance check result that caused the denial
     */
    constructor(public readonly result: GovernanceTypes.CheckResult) {
      super(`Governance denied: ${result.reason}`)
      this.name = "GovernanceDeniedError"
    }
  }
}
