import { test, expect, describe, beforeEach } from "bun:test"
import { GovernanceMatcher } from "../../src/governance/matcher"
import { GovernanceScope } from "../../src/governance/scope"
import { GovernancePolicy } from "../../src/governance/policy"
import { GovernanceAudit } from "../../src/governance/audit"
import { GovernanceTypes } from "../../src/governance/types"

describe("GovernanceMatcher", () => {
  describe("classifyTarget", () => {
    test("classifies IPv4 addresses", () => {
      const target = GovernanceMatcher.classifyTarget("192.168.1.1")
      expect(target.type).toBe("ip")
      expect(target.normalized).toBe("192.168.1.1")
    })

    test("classifies CIDR notation", () => {
      const target = GovernanceMatcher.classifyTarget("10.0.0.0/8")
      expect(target.type).toBe("cidr")
      expect(target.normalized).toBe("10.0.0.0/8")
    })

    test("classifies domain names", () => {
      const target = GovernanceMatcher.classifyTarget("example.com")
      expect(target.type).toBe("domain")
      expect(target.normalized).toBe("example.com")
    })

    test("classifies URLs and extracts hostname", () => {
      const target = GovernanceMatcher.classifyTarget("https://API.Example.COM/v1/users")
      expect(target.type).toBe("url")
      expect(target.normalized).toBe("api.example.com")
    })

    test("returns unknown for unrecognized strings", () => {
      const target = GovernanceMatcher.classifyTarget("not-a-target")
      expect(target.type).toBe("unknown")
    })

    test("validates IP octets are 0-255", () => {
      const invalid = GovernanceMatcher.classifyTarget("999.999.999.999")
      expect(invalid.type).toBe("unknown")
    })
  })

  describe("extractTargets", () => {
    test("extracts URL from bash curl command", () => {
      const targets = GovernanceMatcher.extractTargets("bash", {
        command: "curl https://api.example.com/data"
      })
      expect(targets.length).toBe(1)
      expect(targets[0].type).toBe("url")
      expect(targets[0].normalized).toBe("api.example.com")
    })

    test("extracts IP from bash ping command", () => {
      const targets = GovernanceMatcher.extractTargets("bash", {
        command: "ping 192.168.1.1"
      })
      expect(targets.length).toBe(1)
      expect(targets[0].type).toBe("ip")
      expect(targets[0].normalized).toBe("192.168.1.1")
    })

    test("extracts host from SSH command", () => {
      const targets = GovernanceMatcher.extractTargets("bash", {
        command: "ssh admin@server.company.com"
      })
      expect(targets.length).toBeGreaterThanOrEqual(1)
      expect(targets.some(t => t.normalized === "server.company.com")).toBe(true)
    })

    test("extracts URL from webfetch tool", () => {
      const targets = GovernanceMatcher.extractTargets("webfetch", {
        url: "https://api.github.com/repos"
      })
      expect(targets.length).toBe(1)
      expect(targets[0].normalized).toBe("api.github.com")
    })

    test("returns empty for websearch", () => {
      const targets = GovernanceMatcher.extractTargets("websearch", {
        query: "how to code"
      })
      expect(targets.length).toBe(0)
    })

    test("deduplicates targets by normalized value", () => {
      const targets = GovernanceMatcher.extractTargets("bash", {
        command: "curl https://api.example.com && curl https://API.EXAMPLE.COM/other"
      })
      expect(targets.length).toBe(1)
    })

    test("extracts multiple different targets", () => {
      const targets = GovernanceMatcher.extractTargets("bash", {
        command: "curl https://api.example.com && ping 10.0.0.1"
      })
      expect(targets.length).toBe(2)
    })
  })

  describe("ipInCidr", () => {
    test("matches IP in /8 network", () => {
      expect(GovernanceMatcher.ipInCidr("10.1.2.3", "10.0.0.0/8")).toBe(true)
      expect(GovernanceMatcher.ipInCidr("10.255.255.255", "10.0.0.0/8")).toBe(true)
      expect(GovernanceMatcher.ipInCidr("11.0.0.0", "10.0.0.0/8")).toBe(false)
    })

    test("matches IP in /24 network", () => {
      expect(GovernanceMatcher.ipInCidr("192.168.1.100", "192.168.1.0/24")).toBe(true)
      expect(GovernanceMatcher.ipInCidr("192.168.1.255", "192.168.1.0/24")).toBe(true)
      expect(GovernanceMatcher.ipInCidr("192.168.2.1", "192.168.1.0/24")).toBe(false)
    })

    test("matches IP in /32 (single host)", () => {
      expect(GovernanceMatcher.ipInCidr("192.168.1.1", "192.168.1.1/32")).toBe(true)
      expect(GovernanceMatcher.ipInCidr("192.168.1.2", "192.168.1.1/32")).toBe(false)
    })

    test("matches IP in /0 (all IPs)", () => {
      expect(GovernanceMatcher.ipInCidr("1.2.3.4", "0.0.0.0/0")).toBe(true)
      expect(GovernanceMatcher.ipInCidr("255.255.255.255", "0.0.0.0/0")).toBe(true)
    })
  })

  describe("matchTarget", () => {
    test("matches IP against CIDR pattern", () => {
      const target: GovernanceTypes.Target = {
        raw: "10.0.0.5",
        type: "ip",
        normalized: "10.0.0.5"
      }
      expect(GovernanceMatcher.matchTarget(target, "10.0.0.0/8")).toBe(true)
      expect(GovernanceMatcher.matchTarget(target, "192.168.0.0/16")).toBe(false)
    })

    test("matches domain against wildcard pattern", () => {
      const target: GovernanceTypes.Target = {
        raw: "api.example.com",
        type: "domain",
        normalized: "api.example.com"
      }
      expect(GovernanceMatcher.matchTarget(target, "*.example.com")).toBe(true)
      expect(GovernanceMatcher.matchTarget(target, "*.other.com")).toBe(false)
    })

    test("matches exact domain", () => {
      const target: GovernanceTypes.Target = {
        raw: "example.com",
        type: "domain",
        normalized: "example.com"
      }
      expect(GovernanceMatcher.matchTarget(target, "example.com")).toBe(true)
      expect(GovernanceMatcher.matchTarget(target, "*.example.com")).toBe(false)
    })
  })
})

describe("GovernanceScope", () => {
  test("allows when no scope configured", () => {
    const targets: GovernanceTypes.Target[] = [
      { raw: "10.0.0.1", type: "ip", normalized: "10.0.0.1" }
    ]
    const result = GovernanceScope.check(targets, undefined)
    expect(result.allowed).toBe(true)
  })

  test("allows when no targets extracted", () => {
    const result = GovernanceScope.check([], { ip: { allow: ["10.0.0.0/8"] } })
    expect(result.allowed).toBe(true)
  })

  test("allows IP in allowed CIDR range", () => {
    const targets: GovernanceTypes.Target[] = [
      { raw: "10.0.0.5", type: "ip", normalized: "10.0.0.5" }
    ]
    const result = GovernanceScope.check(targets, {
      ip: { allow: ["10.0.0.0/8"] }
    })
    expect(result.allowed).toBe(true)
  })

  test("denies IP not in allowed range", () => {
    const targets: GovernanceTypes.Target[] = [
      { raw: "8.8.8.8", type: "ip", normalized: "8.8.8.8" }
    ]
    const result = GovernanceScope.check(targets, {
      ip: { allow: ["10.0.0.0/8"] }
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("not in allowed scope")
  })

  test("denies IP matching deny list even if in allow list", () => {
    const targets: GovernanceTypes.Target[] = [
      { raw: "10.0.0.1", type: "ip", normalized: "10.0.0.1" }
    ]
    const result = GovernanceScope.check(targets, {
      ip: {
        allow: ["10.0.0.0/8"],
        deny: ["10.0.0.1/32"]
      }
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("matches deny pattern")
  })

  test("allows domain in allowed list", () => {
    const targets: GovernanceTypes.Target[] = [
      { raw: "api.company.com", type: "domain", normalized: "api.company.com" }
    ]
    const result = GovernanceScope.check(targets, {
      domain: { allow: ["*.company.com"] }
    })
    expect(result.allowed).toBe(true)
  })

  test("denies domain matching deny list", () => {
    const targets: GovernanceTypes.Target[] = [
      { raw: "prod.company.com", type: "domain", normalized: "prod.company.com" }
    ]
    const result = GovernanceScope.check(targets, {
      domain: {
        allow: ["*.company.com"],
        deny: ["prod.*"]
      }
    })
    expect(result.allowed).toBe(false)
  })

  test("checks multiple targets and fails on first violation", () => {
    const targets: GovernanceTypes.Target[] = [
      { raw: "10.0.0.5", type: "ip", normalized: "10.0.0.5" },
      { raw: "8.8.8.8", type: "ip", normalized: "8.8.8.8" }
    ]
    const result = GovernanceScope.check(targets, {
      ip: { allow: ["10.0.0.0/8"] }
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("8.8.8.8")
  })
})

describe("GovernancePolicy", () => {
  test("returns default action when no policies defined", () => {
    const result = GovernancePolicy.evaluate(
      "bash",
      { command: "ls" },
      [],
      undefined,
      "require-approval"
    )
    expect(result.action).toBe("require-approval")
  })

  test("matches policy by tool name", () => {
    const policies: GovernancePolicy.PolicyConfig[] = [
      { action: "auto-approve", tools: ["read", "glob", "grep"] }
    ]
    const result = GovernancePolicy.evaluate("read", {}, [], policies, "require-approval")
    expect(result.action).toBe("auto-approve")
  })

  test("matches policy by tool wildcard", () => {
    const policies: GovernancePolicy.PolicyConfig[] = [
      { action: "auto-approve", tools: ["mcp_*"] }
    ]
    const result = GovernancePolicy.evaluate("mcp_slack", {}, [], policies, "require-approval")
    expect(result.action).toBe("auto-approve")
  })

  test("matches policy by bash command pattern", () => {
    const policies: GovernancePolicy.PolicyConfig[] = [
      { action: "blocked", tools: ["bash"], commands: ["rm -rf *"] }
    ]
    const result = GovernancePolicy.evaluate(
      "bash",
      { command: "rm -rf /tmp/foo" },
      [],
      policies,
      "require-approval"
    )
    expect(result.action).toBe("blocked")
  })

  test("does not match command pattern for non-bash tools", () => {
    const policies: GovernancePolicy.PolicyConfig[] = [
      { action: "blocked", commands: ["rm *"] }
    ]
    const result = GovernancePolicy.evaluate("read", {}, [], policies, "require-approval")
    expect(result.action).toBe("require-approval")
  })

  test("matches policy by target pattern", () => {
    const targets: GovernanceTypes.Target[] = [
      { raw: "prod.company.com", type: "domain", normalized: "prod.company.com" }
    ]
    const policies: GovernancePolicy.PolicyConfig[] = [
      { action: "blocked", targets: ["*.prod.*", "prod.*"] }
    ]
    const result = GovernancePolicy.evaluate("bash", {}, targets, policies, "require-approval")
    expect(result.action).toBe("blocked")
  })

  test("first matching policy wins", () => {
    const policies: GovernancePolicy.PolicyConfig[] = [
      { action: "blocked", tools: ["bash"], commands: ["rm -rf *"], description: "Block dangerous" },
      { action: "auto-approve", tools: ["bash"], description: "Allow bash" }
    ]

    // Dangerous command matches first policy
    const result1 = GovernancePolicy.evaluate(
      "bash",
      { command: "rm -rf /" },
      [],
      policies,
      "require-approval"
    )
    expect(result1.action).toBe("blocked")
    expect(result1.matchedPolicy).toBe("Block dangerous")

    // Safe command matches second policy
    const result2 = GovernancePolicy.evaluate(
      "bash",
      { command: "ls -la" },
      [],
      policies,
      "require-approval"
    )
    expect(result2.action).toBe("auto-approve")
    expect(result2.matchedPolicy).toBe("Allow bash")
  })

  test("requires ALL conditions to match (AND logic)", () => {
    const policies: GovernancePolicy.PolicyConfig[] = [
      { action: "blocked", tools: ["bash"], commands: ["ssh *"], targets: ["*.prod.*"] }
    ]

    // Has tool and command but no matching target
    const targets: GovernanceTypes.Target[] = [
      { raw: "dev.company.com", type: "domain", normalized: "dev.company.com" }
    ]
    const result = GovernancePolicy.evaluate(
      "bash",
      { command: "ssh user@dev.company.com" },
      targets,
      policies,
      "require-approval"
    )
    expect(result.action).toBe("require-approval") // Doesn't match because target doesn't match
  })

  test("describe formats policy correctly", () => {
    const policy: GovernancePolicy.PolicyConfig = {
      action: "blocked",
      tools: ["bash"],
      commands: ["ssh *"],
      description: "Block SSH"
    }
    const desc = GovernancePolicy.describe(policy)
    expect(desc).toContain("Block SSH")
    expect(desc).toContain("blocked")
    expect(desc).toContain("bash")
    expect(desc).toContain("ssh *")
  })
})

describe("GovernanceAudit", () => {
  beforeEach(() => {
    GovernanceAudit.clearMemory()
  })

  test("records entry to memory", async () => {
    const entry = await GovernanceAudit.record(
      {
        sessionID: "test-session",
        callID: "test-call",
        tool: "bash",
        targets: [],
        outcome: "allowed",
        reason: "Test",
        args: { command: "ls" },
        duration: 5
      },
      { storage: "memory", include_args: true }
    )

    expect(entry.id).toBeDefined()
    expect(entry.timestamp).toBeDefined()
    expect(entry.tool).toBe("bash")
    expect(entry.outcome).toBe("allowed")
    expect(entry.args).toEqual({ command: "ls" })
  })

  test("strips args when include_args is false", async () => {
    const entry = await GovernanceAudit.record(
      {
        sessionID: "test-session",
        callID: "test-call",
        tool: "bash",
        targets: [],
        outcome: "allowed",
        args: { command: "secret-command" },
        duration: 5
      },
      { storage: "memory", include_args: false }
    )

    expect(entry.args).toBeUndefined()
  })

  test("lists entries from memory", async () => {
    await GovernanceAudit.record(
      { sessionID: "s1", callID: "c1", tool: "read", targets: [], outcome: "allowed", duration: 1 },
      { storage: "memory" }
    )
    await GovernanceAudit.record(
      { sessionID: "s1", callID: "c2", tool: "bash", targets: [], outcome: "denied", duration: 2 },
      { storage: "memory" }
    )

    const all = await GovernanceAudit.list({ storage: "memory" })
    expect(all.length).toBe(2)

    const denied = await GovernanceAudit.list({ storage: "memory" }, { outcome: "denied" })
    expect(denied.length).toBe(1)
    expect(denied[0].tool).toBe("bash")
  })

  test("memoryCount returns correct count", async () => {
    expect(GovernanceAudit.memoryCount()).toBe(0)

    await GovernanceAudit.record(
      { sessionID: "s1", callID: "c1", tool: "read", targets: [], outcome: "allowed", duration: 1 },
      { storage: "memory" }
    )

    expect(GovernanceAudit.memoryCount()).toBe(1)
  })

  test("clearMemory resets buffer", async () => {
    await GovernanceAudit.record(
      { sessionID: "s1", callID: "c1", tool: "read", targets: [], outcome: "allowed", duration: 1 },
      { storage: "memory" }
    )
    expect(GovernanceAudit.memoryCount()).toBe(1)

    GovernanceAudit.clearMemory()
    expect(GovernanceAudit.memoryCount()).toBe(0)
  })
})
