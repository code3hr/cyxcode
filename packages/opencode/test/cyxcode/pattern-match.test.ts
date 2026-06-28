import { describe, expect, test } from "bun:test"
import { shouldSkipPatternMatch, shouldSkipPatternMatchFromMessages } from "../../src/cyxcode/pattern-match"

describe("pattern-match", () => {
  async function flag(value: string | undefined) {
    const env = { ...process.env }
    if (value === undefined) delete env.CYXCODE_SHORT_CIRCUIT
    else env.CYXCODE_SHORT_CIRCUIT = value
    const proc = Bun.spawn({
      cmd: [
        process.execPath,
        "-e",
        "import { Flag } from './src/flag/flag.ts'; console.log(String(Flag.CYXCODE_SHORT_CIRCUIT))",
      ],
      cwd: process.cwd(),
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await proc.exited).toBe(0)
    return (await new Response(proc.stdout).text()).trim()
  }

  test("imports short-circuit flag as enabled by default", async () => {
    expect(await flag(undefined)).toBe("true")
  })

  test("imports short-circuit flag as disabled for falsey env values", async () => {
    expect(await flag("false")).toBe("false")
    expect(await flag("0")).toBe("false")
  })

  test("returns true for environment disable flag", () => {
    const prev = process.env.CYXCODE_DISABLE_PATTERN_MATCHING
    process.env.CYXCODE_DISABLE_PATTERN_MATCHING = "1"

    try {
      expect(shouldSkipPatternMatch([{ type: "text", text: "normal message" }])).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.CYXCODE_DISABLE_PATTERN_MATCHING
      else process.env.CYXCODE_DISABLE_PATTERN_MATCHING = prev
    }
  })

  test("returns false for disabled environment disable flag", () => {
    const prev = process.env.CYXCODE_DISABLE_PATTERN_MATCHING
    process.env.CYXCODE_DISABLE_PATTERN_MATCHING = "0"

    try {
      expect(shouldSkipPatternMatch([{ type: "text", text: "normal message" }])).toBe(false)
    } finally {
      if (prev === undefined) delete process.env.CYXCODE_DISABLE_PATTERN_MATCHING
      else process.env.CYXCODE_DISABLE_PATTERN_MATCHING = prev
    }
  })

  test("returns true for user intent phrase", () => {
    expect(shouldSkipPatternMatch([{ type: "text", text: "please no pattern matching for this run" }])).toBe(true)
    expect(shouldSkipPatternMatch([{ type: "text", text: "could you skip cyxcode recovery now" }])).toBe(true)
    expect(shouldSkipPatternMatch([{ type: "text", text: "I want to turn off short-circuit behavior" }])).toBe(true)
  })

  test("returns false when intent phrase is synthetic text", () => {
    expect(
      shouldSkipPatternMatch([
        { type: "text", text: "please don't disable pattern matching", synthetic: true },
        { type: "text", text: "run ls" },
      ]),
    ).toBe(false)
  })

  test("uses the last user message when scanning from history", () => {
    expect(
      shouldSkipPatternMatchFromMessages([
        { info: { role: "assistant" }, parts: [{ type: "text", text: "please disable cyxcode" }] },
        { info: { role: "user" }, parts: [{ type: "text", text: "run tests" }] },
      ] as any),
    ).toBe(false)

    expect(
      shouldSkipPatternMatchFromMessages([
        { info: { role: "user" }, parts: [{ type: "text", text: "run tests" }] },
        { info: { role: "assistant" }, parts: [{ type: "text", text: "ignored" }] },
        { info: { role: "user" }, parts: [{ type: "text", text: "never run cyxcode matching again" }] },
      ] as any),
    ).toBe(true)
  })
})
