/**
 * @fileoverview Governance Policy Module
 *
 * This module implements the policy evaluation engine for the Governance system.
 * Policies define rules that determine what action to take for specific tool
 * executions based on tool name, command patterns, and target patterns.
 *
 * ## Policy Actions
 *
 * Each policy specifies one of three actions:
 *
 * - **auto-approve**: Allow the tool to execute without user confirmation
 * - **require-approval**: Defer to the existing permission system for user approval
 * - **blocked**: Deny the tool execution entirely
 *
 * ## Policy Matching
 *
 * Policies are evaluated in order - **first match wins**. This allows for
 * specific rules to override general ones when placed earlier in the list.
 *
 * A policy matches when ALL specified conditions are met (AND logic):
 * - `tools`: Tool name matches at least one pattern
 * - `commands`: For bash tools, command matches at least one pattern
 * - `targets`: At least one extracted target matches at least one pattern
 *
 * ## Example Scenarios
 *
 * 1. Auto-approve all read-only tools
 * 2. Block SSH to production servers
 * 3. Require approval for any bash command
 * 4. Auto-approve internal API calls
 *
 * @module governance/policy
 */

import { GovernanceTypes } from "./types"
import { GovernanceMatcher } from "./matcher"
import { Wildcard } from "../util/wildcard"
import { Log } from "../util/log"

export namespace GovernancePolicy {
  const log = Log.create({ service: "governance.policy" })

  /**
   * Policy action types.
   *
   * - `auto-approve`: Execute without user confirmation
   * - `require-approval`: Ask user for permission (default behavior)
   * - `blocked`: Deny execution entirely
   *
   * @example
   * ```typescript
   * const action: PolicyAction = "auto-approve"
   * ```
   */
  export type PolicyAction = "auto-approve" | "require-approval" | "blocked"

  /**
   * Policy configuration structure.
   *
   * Defines a single policy rule with conditions and an action.
   * All condition fields are optional - if not specified, they match everything.
   *
   * @property action - What to do when this policy matches
   * @property tools - Tool name patterns to match (supports wildcards)
   * @property commands - Command patterns for bash tool (supports wildcards)
   * @property targets - Target patterns to match (supports wildcards and CIDR)
   * @property description - Human-readable description for logs and auditing
   *
   * @example
   * ```typescript
   * // Block SSH to production
   * const policy: PolicyConfig = {
   *   action: "blocked",
   *   tools: ["bash"],
   *   commands: ["ssh *"],
   *   targets: ["*.prod.*"],
   *   description: "Block SSH to production servers"
   * }
   *
   * // Auto-approve read tools
   * const readPolicy: PolicyConfig = {
   *   action: "auto-approve",
   *   tools: ["read", "glob", "grep"],
   *   description: "Auto-approve read-only tools"
   * }
   * ```
   */
  export interface PolicyConfig {
    action: PolicyAction
    tools?: string[]
    commands?: string[]
    targets?: string[]
    description?: string
  }

  /**
   * Result of policy evaluation.
   *
   * @property action - The determined action for this tool execution
   * @property matchedPolicy - Name/description of the policy that matched
   * @property reason - Human-readable explanation of the decision
   *
   * @example
   * ```typescript
   * const result: PolicyResult = {
   *   action: "blocked",
   *   matchedPolicy: "Block SSH to production",
   *   reason: "Matched policy: Block SSH to production"
   * }
   * ```
   */
  export interface PolicyResult {
    action: PolicyAction
    matchedPolicy?: string
    reason?: string
  }

  /**
   * Evaluate policies against a tool execution.
   *
   * Policies are evaluated in order - **first matching policy wins**.
   * This allows specific rules to be placed before general ones.
   *
   * If no policy matches, the default action is applied.
   *
   * @param tool - The tool name being executed
   * @param args - The tool arguments
   * @param targets - Network targets extracted from arguments
   * @param policies - Array of policies to evaluate (order matters!)
   * @param defaultAction - Action to use if no policy matches
   * @returns The policy result with action and explanation
   *
   * @example
   * ```typescript
   * const policies = [
   *   { action: "blocked", tools: ["bash"], commands: ["rm -rf *"], description: "Block dangerous commands" },
   *   { action: "auto-approve", tools: ["read", "glob"], description: "Auto-approve read tools" },
   *   { action: "require-approval", tools: ["bash"], description: "Review all bash commands" }
   * ]
   *
   * // Read tool - matches second policy
   * evaluate("read", { file: "test.ts" }, [], policies, "require-approval")
   * // => { action: "auto-approve", matchedPolicy: "Auto-approve read tools", ... }
   *
   * // Dangerous bash - matches first policy
   * evaluate("bash", { command: "rm -rf /" }, [], policies, "require-approval")
   * // => { action: "blocked", matchedPolicy: "Block dangerous commands", ... }
   *
   * // Safe bash - matches third policy
   * evaluate("bash", { command: "ls -la" }, [], policies, "require-approval")
   * // => { action: "require-approval", matchedPolicy: "Review all bash commands", ... }
   * ```
   */
  export function evaluate(
    tool: string,
    args: Record<string, any>,
    targets: GovernanceTypes.Target[],
    policies: PolicyConfig[] | undefined,
    defaultAction: PolicyAction
  ): PolicyResult {
    // No policies defined - use default
    if (!policies || policies.length === 0) {
      return {
        action: defaultAction,
        reason: "No policies defined, using default action",
      }
    }

    // Evaluate policies in order - first match wins
    for (let i = 0; i < policies.length; i++) {
      const policy = policies[i]
      if (matchesPolicy(tool, args, targets, policy)) {
        const policyName = policy.description || `Policy #${i + 1}`
        log.info("Policy matched", {
          tool,
          policy: policyName,
          action: policy.action,
        })
        return {
          action: policy.action,
          matchedPolicy: policyName,
          reason: `Matched policy: ${policyName}`,
        }
      }
    }

    // No policy matched - use default
    return {
      action: defaultAction,
      reason: "No policy matched, using default action",
    }
  }

  /**
   * Check if a tool execution matches a policy.
   *
   * All specified conditions must match (AND logic).
   * Unspecified conditions are considered to match everything.
   *
   * Matching rules:
   * - `tools`: Tool name must match at least one pattern
   * - `commands`: For bash only - command must match at least one pattern
   * - `targets`: At least one target must match at least one pattern
   *
   * @param tool - Tool name being executed
   * @param args - Tool arguments
   * @param targets - Extracted network targets
   * @param policy - Policy to check against
   * @returns true if all specified conditions match
   *
   * @example
   * ```typescript
   * // Policy with tools only - matches any read tool
   * matchesPolicy("read", {}, [], { action: "auto-approve", tools: ["read", "glob"] })
   * // => true
   *
   * // Policy with tools and commands - must match both
   * matchesPolicy("bash", { command: "ls" }, [], {
   *   action: "blocked",
   *   tools: ["bash"],
   *   commands: ["rm *"]
   * })
   * // => false (command doesn't match)
   * ```
   */
  function matchesPolicy(
    tool: string,
    args: Record<string, any>,
    targets: GovernanceTypes.Target[],
    policy: PolicyConfig
  ): boolean {
    // Check tool pattern if specified
    if (policy.tools && policy.tools.length > 0) {
      const toolMatches = policy.tools.some((pattern) => Wildcard.match(tool, pattern))
      if (!toolMatches) {
        return false
      }
    }

    // Check command pattern if specified (only applies to bash tool)
    if (policy.commands && policy.commands.length > 0) {
      if (tool !== "bash") {
        // Commands filter only applies to bash, so if tool isn't bash, no match
        return false
      }
      const command = args.command || ""
      const commandMatches = policy.commands.some((pattern) => Wildcard.match(command, pattern))
      if (!commandMatches) {
        return false
      }
    }

    // Check target patterns if specified
    if (policy.targets && policy.targets.length > 0) {
      // If no targets were extracted, this policy doesn't apply
      if (targets.length === 0) {
        return false
      }
      // At least one target must match at least one pattern
      const targetMatches = targets.some((target) =>
        policy.targets!.some((pattern) => GovernanceMatcher.matchTarget(target, pattern))
      )
      if (!targetMatches) {
        return false
      }
    }

    // All specified conditions matched
    return true
  }

  /**
   * Get a human-readable description of a policy.
   *
   * Useful for displaying policy information in logs, UI, or audit reports.
   *
   * @param policy - The policy to describe
   * @returns Formatted string describing the policy
   *
   * @example
   * ```typescript
   * describe({
   *   action: "blocked",
   *   tools: ["bash"],
   *   commands: ["ssh *"],
   *   targets: ["*.prod.*"],
   *   description: "Block SSH to production"
   * })
   * // => "Block SSH to production | Action: blocked | Tools: bash | Commands: ssh * | Targets: *.prod.*"
   * ```
   */
  export function describe(policy: PolicyConfig): string {
    const parts: string[] = []

    if (policy.description) {
      parts.push(policy.description)
    }

    parts.push(`Action: ${policy.action}`)

    if (policy.tools && policy.tools.length > 0) {
      parts.push(`Tools: ${policy.tools.join(", ")}`)
    }

    if (policy.commands && policy.commands.length > 0) {
      parts.push(`Commands: ${policy.commands.join(", ")}`)
    }

    if (policy.targets && policy.targets.length > 0) {
      parts.push(`Targets: ${policy.targets.join(", ")}`)
    }

    return parts.join(" | ")
  }
}
