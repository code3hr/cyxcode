/**
 * @fileoverview Governance Scope Module
 *
 * This module enforces network scope restrictions for tool executions.
 * It provides the first line of defense in the governance system,
 * ensuring that tools can only interact with allowed network targets.
 *
 * ## Scope Configuration
 *
 * Scope is configured with allow/deny lists for two target categories:
 *
 * - **IP scope**: Controls access to IP addresses and CIDR ranges
 * - **Domain scope**: Controls access to domain names and URLs
 *
 * ## Evaluation Order
 *
 * For each target, scope is evaluated as follows:
 *
 * 1. **Deny list check**: If the target matches any deny pattern, it's blocked
 * 2. **Allow list check**: If an allow list exists and the target doesn't match, it's blocked
 * 3. **Default allow**: If no rules apply, the target is allowed
 *
 * This means deny lists always take precedence over allow lists.
 *
 * ## Use Cases
 *
 * - Restrict AI to internal network only (e.g., `10.0.0.0/8`)
 * - Block access to production systems (e.g., `*.prod.company.com`)
 * - Allow only specific external APIs (e.g., `api.github.com`)
 *
 * @module governance/scope
 */

import { GovernanceTypes } from "./types"
import { GovernanceMatcher } from "./matcher"
import { Log } from "../util/log"

export namespace GovernanceScope {
  const log = Log.create({ service: "governance.scope" })

  /**
   * Scope configuration structure.
   *
   * Defines allow/deny lists for IP and domain targets.
   * All fields are optional - if not specified, no restrictions apply.
   *
   * @property ip - IP address and CIDR scope rules
   * @property ip.allow - IP patterns that are allowed (CIDR notation supported)
   * @property ip.deny - IP patterns that are blocked (checked first)
   * @property domain - Domain and URL scope rules
   * @property domain.allow - Domain patterns that are allowed (wildcards supported)
   * @property domain.deny - Domain patterns that are blocked (checked first)
   *
   * @example
   * ```typescript
   * const scope: GovernanceScope.ScopeConfig = {
   *   ip: {
   *     allow: ["10.0.0.0/8", "192.168.0.0/16"],  // Internal networks only
   *     deny: ["10.0.0.1/32"]                      // But not the gateway
   *   },
   *   domain: {
   *     allow: ["*.company.com", "github.com"],   // Company domains + GitHub
   *     deny: ["*.prod.company.com"]              // But not production
   *   }
   * }
   * ```
   */
  export interface ScopeConfig {
    ip?: {
      allow?: string[]
      deny?: string[]
    }
    domain?: {
      allow?: string[]
      deny?: string[]
    }
  }

  /**
   * Result of a scope check.
   *
   * @property allowed - Whether all targets passed scope checks
   * @property reason - Explanation of why the check failed (if applicable)
   *
   * @example
   * ```typescript
   * // Successful check
   * const success: ScopeResult = { allowed: true }
   *
   * // Failed check
   * const failure: ScopeResult = {
   *   allowed: false,
   *   reason: "IP 8.8.8.8 not in allowed scope: [10.0.0.0/8]"
   * }
   * ```
   */
  export interface ScopeResult {
    allowed: boolean
    reason?: string
  }

  /**
   * Check if all targets are within the allowed scope.
   *
   * This is the main entry point for scope checking. It iterates through
   * all extracted targets and validates each against the scope configuration.
   *
   * Returns early on first violation for efficiency.
   *
   * @param targets - Network targets extracted from tool arguments
   * @param scope - Scope configuration (allow/deny lists)
   * @returns Result indicating if all targets are allowed
   *
   * @example
   * ```typescript
   * const targets = [
   *   { raw: "10.0.0.5", type: "ip", normalized: "10.0.0.5" },
   *   { raw: "api.company.com", type: "domain", normalized: "api.company.com" }
   * ]
   *
   * const scope = {
   *   ip: { allow: ["10.0.0.0/8"] },
   *   domain: { allow: ["*.company.com"] }
   * }
   *
   * const result = GovernanceScope.check(targets, scope)
   * // => { allowed: true }
   * ```
   */
  export function check(targets: GovernanceTypes.Target[], scope: ScopeConfig | undefined): ScopeResult {
    // If no scope configured, allow everything
    if (!scope) {
      return { allowed: true, reason: "No scope restrictions configured" }
    }

    // If no targets extracted, allow (nothing to check)
    if (targets.length === 0) {
      return { allowed: true, reason: "No network targets detected" }
    }

    // Check each target against scope rules
    for (const target of targets) {
      const result = checkTarget(target, scope)
      if (!result.allowed) {
        log.info("Scope violation", { target: target.normalized, reason: result.reason })
        return result
      }
    }

    return { allowed: true }
  }

  /**
   * Check a single target against scope rules.
   *
   * Evaluation order for each target type:
   * 1. Check deny list first (if matches, immediately deny)
   * 2. Check allow list (if exists and doesn't match, deny)
   * 3. Default to allow
   *
   * @param target - Single network target to check
   * @param scope - Scope configuration
   * @returns Result for this specific target
   *
   * @example
   * ```typescript
   * // IP target against IP scope
   * checkTarget(
   *   { raw: "10.0.0.5", type: "ip", normalized: "10.0.0.5" },
   *   { ip: { allow: ["10.0.0.0/8"] } }
   * )
   * // => { allowed: true }
   *
   * // Domain target blocked by deny list
   * checkTarget(
   *   { raw: "prod.company.com", type: "domain", normalized: "prod.company.com" },
   *   { domain: { deny: ["*.prod.*"] } }
   * )
   * // => { allowed: false, reason: "Domain prod.company.com matches deny pattern: *.prod.*" }
   * ```
   */
  function checkTarget(target: GovernanceTypes.Target, scope: ScopeConfig): ScopeResult {
    // Check IP/CIDR rules for IP targets
    if ((target.type === "ip" || target.type === "cidr") && scope.ip) {
      // Deny list takes precedence - check first
      if (scope.ip.deny) {
        for (const pattern of scope.ip.deny) {
          if (GovernanceMatcher.matchTarget(target, pattern)) {
            return {
              allowed: false,
              reason: `IP ${target.normalized} matches deny pattern: ${pattern}`,
            }
          }
        }
      }

      // If allow list exists and is non-empty, target must match at least one
      if (scope.ip.allow && scope.ip.allow.length > 0) {
        const matches = scope.ip.allow.some((p) => GovernanceMatcher.matchTarget(target, p))
        if (!matches) {
          return {
            allowed: false,
            reason: `IP ${target.normalized} not in allowed scope: [${scope.ip.allow.join(", ")}]`,
          }
        }
      }
    }

    // Check domain rules for domain/URL targets
    if ((target.type === "domain" || target.type === "url") && scope.domain) {
      // Deny list takes precedence - check first
      if (scope.domain.deny) {
        for (const pattern of scope.domain.deny) {
          if (GovernanceMatcher.matchTarget(target, pattern)) {
            return {
              allowed: false,
              reason: `Domain ${target.normalized} matches deny pattern: ${pattern}`,
            }
          }
        }
      }

      // If allow list exists and is non-empty, target must match at least one
      if (scope.domain.allow && scope.domain.allow.length > 0) {
        const matches = scope.domain.allow.some((p) => GovernanceMatcher.matchTarget(target, p))
        if (!matches) {
          return {
            allowed: false,
            reason: `Domain ${target.normalized} not in allowed scope: [${scope.domain.allow.join(", ")}]`,
          }
        }
      }
    }

    return { allowed: true }
  }
}
