import { describe, expect, test } from "bun:test"

/**
 * Drift Detection Tests
 *
 * Tests violation pattern matching for "use X, not Y" and "don't X" rules.
 */

describe("Drift Detection", () => {
  // Simulate the violation checking logic from drift.ts

  function checkUseNotViolation(rule: string, commands: string[]): boolean {
    const match = rule.match(/(?:always\s+)?use\s+(\w+)[\s,]+not\s+(\w+)/i)
    if (!match) return false
    const preferred = match[1].toLowerCase()
    const forbidden = match[2].toLowerCase()

    const usedForbidden = commands.some(c => c.toLowerCase().includes(forbidden))
    const usedPreferred = commands.some(c => c.toLowerCase().includes(preferred))

    return usedForbidden && !usedPreferred
  }

  function checkDontViolation(rule: string, commands: string[]): boolean {
    const match = rule.match(/(?:don'?t|never|stop)\s+(.+)/i)
    if (!match) return false
    const forbidden = match[1].toLowerCase().trim()
    return commands.some(c => c.toLowerCase().includes(forbidden))
  }

  describe("use X, not Y pattern", () => {
    test("detects npm when rule says use bun", () => {
      expect(checkUseNotViolation("use bun, not npm", ["npm install express"])).toBe(true)
    })

    test("no drift when AI uses bun correctly", () => {
      expect(checkUseNotViolation("use bun, not npm", ["bun add express"])).toBe(false)
    })

    test("no drift when AI uses both (preferred wins)", () => {
      expect(checkUseNotViolation("use bun, not npm", ["npm install express", "bun add express"])).toBe(false)
    })

    test("no drift when no package commands used", () => {
      expect(checkUseNotViolation("use bun, not npm", ["ls -la", "cat file.txt"])).toBe(false)
    })

    test("handles 'always use' prefix", () => {
      expect(checkUseNotViolation("always use bun, not npm", ["npm install express"])).toBe(true)
    })

    test("case insensitive", () => {
      expect(checkUseNotViolation("use Bun, not NPM", ["NPM INSTALL express"])).toBe(true)
    })
  })

  describe("don't X pattern", () => {
    test("detects forbidden action when content includes forbidden phrase", () => {
      // "don't use npm" → forbidden = "use npm" → checks if any command includes "use npm"
      expect(checkDontViolation("don't use npm", ["use npm to install express"])).toBe(true)
    })

    test("no drift when forbidden phrase not present", () => {
      expect(checkDontViolation("don't use npm", ["bun run dev"])).toBe(false)
    })

    test("handles 'never' prefix", () => {
      // "never sudo" → forbidden = "sudo"
      expect(checkDontViolation("never sudo", ["sudo apt install"])).toBe(true)
    })

    test("handles 'stop' prefix", () => {
      // "stop npm" → forbidden = "npm"
      expect(checkDontViolation("stop npm", ["ran npm install"])).toBe(true)
    })
  })

  describe("unmatched rules", () => {
    test("use X, not Y returns false for unrelated rules", () => {
      expect(checkUseNotViolation("keep responses short", ["npm install"])).toBe(false)
    })

    test("don't X returns false for unrelated rules", () => {
      expect(checkDontViolation("use bun, not npm", ["npm install"])).toBe(false)
    })
  })
})
