import { describe, expect, test, beforeEach } from "bun:test"
import type { PatternSkill, PatternMatch, SkillContext, SkillResult, Pattern } from "../../src/cyxcode/types"

/**
 * SkillRouter Tests
 *
 * Tests the core routing logic that matches errors to patterns
 * and tracks statistics.
 */

// Mock skill for testing
class MockSkill implements PatternSkill {
  name: string
  description = "Mock skill for testing"
  version = "1.0.0"
  triggers = ["error", "failed"]
  patterns: Pattern[]

  constructor(name: string, patterns: Pattern[]) {
    this.name = name
    this.patterns = patterns
  }

  match(error: string): PatternMatch | null {
    for (const pattern of this.patterns) {
      const regexMatch = pattern.regex.exec(error)
      if (regexMatch) {
        return {
          pattern,
          captures: regexMatch.slice(1),
          extracted: {},
        }
      }
    }
    return null
  }

  async execute(ctx: SkillContext, match: PatternMatch): Promise<SkillResult> {
    return {
      handled: true,
      success: true,
      message: `Fixed by ${this.name}`,
      shouldRetry: true,
      tokensSaved: 800,
    }
  }
}

// Create a fresh router for each test (since the real one is a singleton)
class TestableSkillRouter {
  private skills: Map<string, PatternSkill> = new Map()
  private matchCount = 0
  private missCount = 0
  private tokensSaved = 0

  register(skill: PatternSkill): void {
    this.skills.set(skill.name, skill)
  }

  all(): PatternSkill[] {
    return Array.from(this.skills.values())
  }

  get(name: string): PatternSkill | undefined {
    return this.skills.get(name)
  }

  findMatching(error: string): Array<{ skill: PatternSkill; match: PatternMatch }> {
    const matches: Array<{ skill: PatternSkill; match: PatternMatch }> = []
    for (const skill of this.skills.values()) {
      const match = skill.match(error)
      if (match) {
        matches.push({ skill, match })
      }
    }
    return matches
  }

  async route(ctx: SkillContext): Promise<SkillResult | null> {
    const matches = this.findMatching(ctx.errorOutput)
    if (matches.length === 0) {
      this.missCount++
      return null
    }
    this.matchCount++
    const { skill, match } = matches[0]
    const result = await skill.execute(ctx, match)
    if (result.success && result.tokensSaved) {
      this.tokensSaved += result.tokensSaved
    }
    return result
  }

  stats() {
    let totalPatterns = 0
    const byCategory: Record<string, number> = {}
    for (const skill of this.skills.values()) {
      for (const pattern of skill.patterns) {
        totalPatterns++
        byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1
      }
    }
    return { totalSkills: this.skills.size, totalPatterns, byCategory }
  }

  routerStats() {
    const total = this.matchCount + this.missCount
    return {
      matches: this.matchCount,
      misses: this.missCount,
      hitRate: total > 0 ? this.matchCount / total : 0,
      tokensSaved: this.tokensSaved,
    }
  }

  resetSessionStats() {
    this.matchCount = 0
    this.missCount = 0
    this.tokensSaved = 0
  }
}

describe("SkillRouter", () => {
  let router: TestableSkillRouter

  beforeEach(() => {
    router = new TestableSkillRouter()
  })

  describe("register", () => {
    test("should register a skill", () => {
      const skill = new MockSkill("test-skill", [])
      router.register(skill)

      expect(router.all()).toHaveLength(1)
      expect(router.get("test-skill")).toBe(skill)
    })

    test("should overwrite existing skill with same name", () => {
      const skill1 = new MockSkill("test-skill", [])
      const skill2 = new MockSkill("test-skill", [])

      router.register(skill1)
      router.register(skill2)

      expect(router.all()).toHaveLength(1)
      expect(router.get("test-skill")).toBe(skill2)
    })

    test("should register multiple skills", () => {
      router.register(new MockSkill("skill-1", []))
      router.register(new MockSkill("skill-2", []))
      router.register(new MockSkill("skill-3", []))

      expect(router.all()).toHaveLength(3)
    })
  })

  describe("findMatching", () => {
    test("should find matching patterns", () => {
      const patterns: Pattern[] = [{
        id: "npm-not-found",
        regex: /npm ERR! 404 Not Found.*'([^']+)'/,
        category: "node",
        description: "Package not found",
        fixes: [{ id: "fix-1", description: "Install package", priority: 1 }],
      }]

      router.register(new MockSkill("recovery", patterns))

      const matches = router.findMatching("npm ERR! 404 Not Found - GET https://registry.npmjs.org/fake-pkg - 'fake-pkg'")

      expect(matches).toHaveLength(1)
      expect(matches[0].skill.name).toBe("recovery")
      expect(matches[0].match.captures[0]).toBe("fake-pkg")
    })

    test("should return empty array for no matches", () => {
      const patterns: Pattern[] = [{
        id: "npm-not-found",
        regex: /npm ERR! 404/,
        category: "node",
        description: "Package not found",
        fixes: [],
      }]

      router.register(new MockSkill("recovery", patterns))

      const matches = router.findMatching("git: command not found")

      expect(matches).toHaveLength(0)
    })

    test("should match multiple skills", () => {
      const nodePatterns: Pattern[] = [{
        id: "node-error",
        regex: /Error: Cannot find module/,
        category: "node",
        description: "Module not found",
        fixes: [],
      }]

      const genericPatterns: Pattern[] = [{
        id: "generic-error",
        regex: /Error:/,
        category: "generic",
        description: "Generic error",
        fixes: [],
      }]

      router.register(new MockSkill("node", nodePatterns))
      router.register(new MockSkill("generic", genericPatterns))

      const matches = router.findMatching("Error: Cannot find module 'express'")

      expect(matches).toHaveLength(2)
    })
  })

  describe("route", () => {
    test("should route to matching skill and execute fix", async () => {
      const patterns: Pattern[] = [{
        id: "test-pattern",
        regex: /test error/,
        category: "test",
        description: "Test pattern",
        fixes: [{ id: "fix-1", description: "Test fix", priority: 1 }],
      }]

      router.register(new MockSkill("test", patterns))

      const ctx: SkillContext = {
        cwd: "/test",
        errorOutput: "test error occurred",
        env: {},
        approve: async () => true,
        execute: async () => ({ success: true, exitCode: 0, stdout: "", stderr: "" }),
      }

      const result = await router.route(ctx)

      expect(result).not.toBeNull()
      expect(result!.handled).toBe(true)
      expect(result!.success).toBe(true)
    })

    test("should return null for no match", async () => {
      router.register(new MockSkill("test", []))

      const ctx: SkillContext = {
        cwd: "/test",
        errorOutput: "unknown error",
        env: {},
        approve: async () => true,
        execute: async () => ({ success: true, exitCode: 0, stdout: "", stderr: "" }),
      }

      const result = await router.route(ctx)

      expect(result).toBeNull()
    })

    test("should track tokens saved", async () => {
      const patterns: Pattern[] = [{
        id: "test-pattern",
        regex: /test error/,
        category: "test",
        description: "Test pattern",
        fixes: [],
      }]

      router.register(new MockSkill("test", patterns))

      const ctx: SkillContext = {
        cwd: "/test",
        errorOutput: "test error",
        env: {},
        approve: async () => true,
        execute: async () => ({ success: true, exitCode: 0, stdout: "", stderr: "" }),
      }

      await router.route(ctx)
      await router.route(ctx)

      const stats = router.routerStats()
      expect(stats.tokensSaved).toBe(1600) // 800 * 2
    })
  })

  describe("stats", () => {
    test("should count patterns by category", () => {
      const patterns: Pattern[] = [
        { id: "p1", regex: /a/, category: "node", description: "", fixes: [] },
        { id: "p2", regex: /b/, category: "node", description: "", fixes: [] },
        { id: "p3", regex: /c/, category: "git", description: "", fixes: [] },
      ]

      router.register(new MockSkill("test", patterns))

      const stats = router.stats()

      expect(stats.totalSkills).toBe(1)
      expect(stats.totalPatterns).toBe(3)
      expect(stats.byCategory["node"]).toBe(2)
      expect(stats.byCategory["git"]).toBe(1)
    })
  })

  describe("routerStats", () => {
    test("should track matches and misses", async () => {
      const patterns: Pattern[] = [{
        id: "test-pattern",
        regex: /match this/,
        category: "test",
        description: "Test",
        fixes: [],
      }]

      router.register(new MockSkill("test", patterns))

      const matchCtx: SkillContext = {
        cwd: "/test",
        errorOutput: "match this",
        env: {},
        approve: async () => true,
        execute: async () => ({ success: true, exitCode: 0, stdout: "", stderr: "" }),
      }

      const missCtx: SkillContext = {
        cwd: "/test",
        errorOutput: "no match",
        env: {},
        approve: async () => true,
        execute: async () => ({ success: true, exitCode: 0, stdout: "", stderr: "" }),
      }

      await router.route(matchCtx)
      await router.route(matchCtx)
      await router.route(missCtx)

      const stats = router.routerStats()

      expect(stats.matches).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(0.667, 2)
    })

    test("should reset stats", async () => {
      const patterns: Pattern[] = [{
        id: "test",
        regex: /test/,
        category: "test",
        description: "",
        fixes: [],
      }]

      router.register(new MockSkill("test", patterns))

      const ctx: SkillContext = {
        cwd: "/",
        errorOutput: "test",
        env: {},
        approve: async () => true,
        execute: async () => ({ success: true, exitCode: 0, stdout: "", stderr: "" }),
      }

      await router.route(ctx)
      router.resetSessionStats()

      const stats = router.routerStats()
      expect(stats.matches).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.tokensSaved).toBe(0)
    })
  })
})
