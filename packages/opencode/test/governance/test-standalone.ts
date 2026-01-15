/**
 * Standalone Governance Test Script
 *
 * Run with: bun run test/governance/test-standalone.ts
 * Or: npx tsx test/governance/test-standalone.ts
 *
 * This script tests the governance module without requiring a test framework.
 */

import { GovernanceMatcher } from "../../src/governance/matcher"
import { GovernanceScope } from "../../src/governance/scope"
import { GovernancePolicy } from "../../src/governance/policy"
import { GovernanceAudit } from "../../src/governance/audit"
import { GovernanceTypes } from "../../src/governance/types"

// Simple test utilities
let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed++
  } catch (err) {
    console.log(`✗ ${name}`)
    console.log(`  Error: ${err instanceof Error ? err.message : err}`)
    failed++
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    },
    toContain(expected: string) {
      if (typeof actual !== "string" || !actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`)
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) {
        throw new Error(`Expected ${actual} >= ${expected}`)
      }
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

console.log("\n=== GovernanceMatcher Tests ===\n")

test("classifyTarget: IPv4 address", () => {
  const target = GovernanceMatcher.classifyTarget("192.168.1.1")
  expect(target.type).toBe("ip")
  expect(target.normalized).toBe("192.168.1.1")
})

test("classifyTarget: CIDR notation", () => {
  const target = GovernanceMatcher.classifyTarget("10.0.0.0/8")
  expect(target.type).toBe("cidr")
})

test("classifyTarget: domain", () => {
  const target = GovernanceMatcher.classifyTarget("example.com")
  expect(target.type).toBe("domain")
})

test("classifyTarget: URL extracts hostname", () => {
  const target = GovernanceMatcher.classifyTarget("https://API.Example.COM/v1")
  expect(target.type).toBe("url")
  expect(target.normalized).toBe("api.example.com")
})

test("extractTargets: bash curl command", () => {
  const targets = GovernanceMatcher.extractTargets("bash", {
    command: "curl https://api.example.com/data"
  })
  expect(targets.length).toBeGreaterThanOrEqual(1)
  expect(targets[0].normalized).toBe("api.example.com")
})

test("extractTargets: bash SSH command", () => {
  const targets = GovernanceMatcher.extractTargets("bash", {
    command: "ssh admin@server.company.com"
  })
  expect(targets.length).toBeGreaterThanOrEqual(1)
})

test("extractTargets: webfetch URL", () => {
  const targets = GovernanceMatcher.extractTargets("webfetch", {
    url: "https://api.github.com"
  })
  expect(targets.length).toBe(1)
  expect(targets[0].normalized).toBe("api.github.com")
})

test("ipInCidr: IP in /8 range", () => {
  expect(GovernanceMatcher.ipInCidr("10.1.2.3", "10.0.0.0/8")).toBe(true)
  expect(GovernanceMatcher.ipInCidr("11.0.0.0", "10.0.0.0/8")).toBe(false)
})

test("ipInCidr: IP in /24 range", () => {
  expect(GovernanceMatcher.ipInCidr("192.168.1.100", "192.168.1.0/24")).toBe(true)
  expect(GovernanceMatcher.ipInCidr("192.168.2.1", "192.168.1.0/24")).toBe(false)
})

console.log("\n=== GovernanceScope Tests ===\n")

test("scope: allows when no config", () => {
  const targets: GovernanceTypes.Target[] = [
    { raw: "10.0.0.1", type: "ip", normalized: "10.0.0.1" }
  ]
  const result = GovernanceScope.check(targets, undefined)
  expect(result.allowed).toBe(true)
})

test("scope: allows IP in allowed CIDR", () => {
  const targets: GovernanceTypes.Target[] = [
    { raw: "10.0.0.5", type: "ip", normalized: "10.0.0.5" }
  ]
  const result = GovernanceScope.check(targets, {
    ip: { allow: ["10.0.0.0/8"] }
  })
  expect(result.allowed).toBe(true)
})

test("scope: denies IP not in allowed range", () => {
  const targets: GovernanceTypes.Target[] = [
    { raw: "8.8.8.8", type: "ip", normalized: "8.8.8.8" }
  ]
  const result = GovernanceScope.check(targets, {
    ip: { allow: ["10.0.0.0/8"] }
  })
  expect(result.allowed).toBe(false)
})

test("scope: deny takes precedence over allow", () => {
  const targets: GovernanceTypes.Target[] = [
    { raw: "10.0.0.1", type: "ip", normalized: "10.0.0.1" }
  ]
  const result = GovernanceScope.check(targets, {
    ip: { allow: ["10.0.0.0/8"], deny: ["10.0.0.1/32"] }
  })
  expect(result.allowed).toBe(false)
})

test("scope: allows domain matching pattern", () => {
  const targets: GovernanceTypes.Target[] = [
    { raw: "api.company.com", type: "domain", normalized: "api.company.com" }
  ]
  const result = GovernanceScope.check(targets, {
    domain: { allow: ["*.company.com"] }
  })
  expect(result.allowed).toBe(true)
})

console.log("\n=== GovernancePolicy Tests ===\n")

test("policy: default action when no policies", () => {
  const result = GovernancePolicy.evaluate("bash", {}, [], undefined, "require-approval")
  expect(result.action).toBe("require-approval")
})

test("policy: matches by tool name", () => {
  const policies: GovernancePolicy.PolicyConfig[] = [
    { action: "auto-approve", tools: ["read", "glob"] }
  ]
  const result = GovernancePolicy.evaluate("read", {}, [], policies, "require-approval")
  expect(result.action).toBe("auto-approve")
})

test("policy: matches bash command pattern", () => {
  const policies: GovernancePolicy.PolicyConfig[] = [
    { action: "blocked", tools: ["bash"], commands: ["rm -rf *"] }
  ]
  const result = GovernancePolicy.evaluate(
    "bash",
    { command: "rm -rf /tmp" },
    [],
    policies,
    "require-approval"
  )
  expect(result.action).toBe("blocked")
})

test("policy: first match wins", () => {
  const policies: GovernancePolicy.PolicyConfig[] = [
    { action: "blocked", tools: ["bash"], commands: ["rm *"], description: "Block rm" },
    { action: "auto-approve", tools: ["bash"], description: "Allow bash" }
  ]

  const result1 = GovernancePolicy.evaluate(
    "bash",
    { command: "rm -rf /" },
    [],
    policies,
    "require-approval"
  )
  expect(result1.action).toBe("blocked")

  const result2 = GovernancePolicy.evaluate(
    "bash",
    { command: "ls -la" },
    [],
    policies,
    "require-approval"
  )
  expect(result2.action).toBe("auto-approve")
})

console.log("\n=== GovernanceAudit Tests ===\n")

test("audit: records to memory", async () => {
  GovernanceAudit.clearMemory()

  const entry = await GovernanceAudit.record(
    {
      sessionID: "test",
      callID: "test",
      tool: "bash",
      targets: [],
      outcome: "allowed",
      duration: 5
    },
    { storage: "memory" }
  )

  expect(entry.tool).toBe("bash")
  expect(GovernanceAudit.memoryCount()).toBe(1)
})

test("audit: strips args when include_args=false", async () => {
  GovernanceAudit.clearMemory()

  const entry = await GovernanceAudit.record(
    {
      sessionID: "test",
      callID: "test",
      tool: "bash",
      targets: [],
      outcome: "allowed",
      args: { command: "secret" },
      duration: 5
    },
    { storage: "memory", include_args: false }
  )

  expect(entry.args).toBe(undefined)
})

// ============================================================================
// Summary
// ============================================================================

console.log("\n" + "=".repeat(50))
console.log(`\nResults: ${passed} passed, ${failed} failed`)
console.log("")

if (failed > 0) {
  process.exit(1)
}
