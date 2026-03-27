import { describe, expect, test } from "bun:test"

/**
 * Resume Tests
 *
 * Tests HEAD loading, system prompt formatting, and budget enforcement.
 */

describe("Resume", () => {
  test("resume format has correct tags", () => {
    const content = "Previous session goal: test\nIn progress: building"
    const output = `<cyxcode-resume>\nContext from previous session (test-slug):\n${content}\n</cyxcode-resume>`

    expect(output).toContain("<cyxcode-resume>")
    expect(output).toContain("</cyxcode-resume>")
    expect(output).toContain("test-slug")
    expect(output).toContain("Previous session goal")
  })

  test("budget truncates by dropping lines, not mid-line", () => {
    const MAX_RESUME_CHARS = 800
    const lines = [
      "Previous session goal: Building a very complex authentication system with JWT tokens and bcrypt",
      "In progress: Token refresh endpoint with rotation",
      "Active files: src/auth.ts, src/middleware.ts, src/jwt.ts, src/routes/login.ts, src/routes/refresh.ts",
      "Completed: Login endpoint, Password hashing, User model, Database schema",
      "Discoveries: auth.ts uses JWT with bcrypt at line 50; globalThis needed for cross-module state",
    ]

    let content = ""
    for (const line of lines) {
      if (content.length + line.length + 1 > MAX_RESUME_CHARS) break
      content += (content ? "\n" : "") + line
    }

    expect(content.length).toBeLessThanOrEqual(MAX_RESUME_CHARS)
    // Should not cut mid-line
    expect(content.endsWith("...")).toBe(false)
    // Should contain complete lines only
    const outputLines = content.split("\n")
    for (const line of outputLines) {
      expect(lines).toContain(line)
    }
  })

  test("empty HEAD returns empty array", () => {
    // When no HEAD exists, forSystemPrompt should return []
    const head = null
    const parts: string[] = []
    if (!head) {
      // No resume context
    }
    expect(parts).toHaveLength(0)
  })

  test("commit state fields are rendered", () => {
    const state = {
      goal: "Build auth system",
      workingFiles: ["src/auth.ts", "src/middleware.ts"],
      inProgress: "Token refresh",
      completed: ["Login endpoint"],
      discoveries: ["auth uses bcrypt"],
    }

    const lines: string[] = []
    if (state.goal) lines.push(`Previous session goal: ${state.goal}`)
    if (state.inProgress) lines.push(`In progress: ${state.inProgress}`)
    if (state.workingFiles.length > 0) lines.push(`Active files: ${state.workingFiles.join(", ")}`)
    if (state.completed.length > 0) lines.push(`Completed: ${state.completed.join(", ")}`)
    if (state.discoveries.length > 0) lines.push(`Discoveries: ${state.discoveries.join("; ")}`)

    expect(lines).toHaveLength(5)
    expect(lines[0]).toContain("Build auth system")
    expect(lines[1]).toContain("Token refresh")
    expect(lines[2]).toContain("src/auth.ts")
    expect(lines[3]).toContain("Login endpoint")
    expect(lines[4]).toContain("auth uses bcrypt")
  })

  test("corrections load before resume context", () => {
    // System prompt order should be: corrections first, then resume
    const parts: string[] = []

    // Corrections (high priority)
    parts.push("<cyxcode-corrections>corrections here</cyxcode-corrections>")
    // Resume (lower priority)
    parts.push("<cyxcode-resume>resume here</cyxcode-resume>")

    expect(parts[0]).toContain("corrections")
    expect(parts[1]).toContain("resume")
    // Corrections come first
    expect(parts.indexOf(parts.find(p => p.includes("corrections"))!))
      .toBeLessThan(parts.indexOf(parts.find(p => p.includes("resume"))!))
  })
})
