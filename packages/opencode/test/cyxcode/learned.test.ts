import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { generatePattern, PendingCapture } from "../../src/cyxcode/learned"

/**
 * Learned Patterns Tests
 *
 * Tests pattern generation, regex escaping, and generalization.
 */

describe("generatePattern", () => {
  describe("basic pattern generation", () => {
    test("should generate pattern from error with key line", () => {
      const errorOutput = "npm ERR! 404 Not Found - GET https://registry.npmjs.org/fake-package"
      const aiFixText = "The package doesn't exist. Try `npm install real-package` instead."
      const failedCommand = "npm install fake-package"

      const result = generatePattern(errorOutput, aiFixText, failedCommand)

      expect(result).not.toBeNull()
      expect(result!.id).toMatch(/^learned-/)
      expect(result!.category).toBe("learned")
      expect(result!.fixes).toHaveLength(1)
    })

    test("should extract command from fenced code block", () => {
      const errorOutput = "Error: Module not found"
      const aiFixText = `
You need to install the missing module:

\`\`\`bash
npm install express
\`\`\`

This will fix the issue.
`
      const result = generatePattern(errorOutput, aiFixText, "node app.js")

      expect(result).not.toBeNull()
      expect(result!.fixes[0].command).toBe("npm install express")
    })

    test("should extract command from inline backticks", () => {
      const errorOutput = "Error: command not found: python3"
      const aiFixText = "Run `sudo apt install python3` to install Python."

      const result = generatePattern(errorOutput, aiFixText, "python3 script.py")

      expect(result).not.toBeNull()
      expect(result!.fixes[0].command).toBe("sudo apt install python3")
    })

    test("should use description when no command found", () => {
      const errorOutput = "Error: Permission denied"
      const aiFixText = "You need to contact your system administrator to get access."

      const result = generatePattern(errorOutput, aiFixText, "cat /etc/shadow")

      expect(result).not.toBeNull()
      expect(result!.fixes[0].command).toBeUndefined()
      expect(result!.fixes[0].description).toContain("administrator")
    })

    test("should return null for empty error", () => {
      const result = generatePattern("", "fix text", "cmd")
      expect(result).toBeNull()
    })

    test("should return null for very short patterns", () => {
      const result = generatePattern("err", "fix", "cmd")
      expect(result).toBeNull()
    })
  })

  describe("regex escaping", () => {
    test("should escape special regex characters", () => {
      const errorOutput = "Error: expected [1, 2, 3] but got (none)"
      const result = generatePattern(errorOutput, "Fix it", "cmd")

      expect(result).not.toBeNull()
      // The regex should not throw when created
      expect(() => new RegExp(result!.regex, "i")).not.toThrow()
    })

    test("should escape dots in error messages", () => {
      const errorOutput = "Error: Cannot find file.txt"
      const result = generatePattern(errorOutput, "Create the file", "cat file.txt")

      expect(result).not.toBeNull()
      const regex = new RegExp(result!.regex, "i")
      expect(regex.test("Error: Cannot find file.txt")).toBe(true)
      expect(regex.test("Error: Cannot find fileXtxt")).toBe(false) // Dot should not match any char
    })

    test("should escape pipe characters", () => {
      const errorOutput = "Error: expected a | b"
      const result = generatePattern(errorOutput, "Fix", "cmd")

      expect(result).not.toBeNull()
      const regex = new RegExp(result!.regex, "i")
      expect(regex.test("Error: expected a | b")).toBe(true)
    })
  })

  describe("regex generalization", () => {
    test("should generalize version numbers", () => {
      const errorOutput = "Error: requires typescript@4.5.2 but found 4.0.0"
      const result = generatePattern(errorOutput, "npm install typescript", "tsc")

      expect(result).not.toBeNull()
      const regex = new RegExp(result!.regex, "i")
      // Should match different versions
      expect(regex.test("Error: requires typescript@5.0.0 but found 3.9.0")).toBe(true)
    })

    test("should generalize absolute paths", () => {
      const errorOutput = "Error: Cannot read file /home/user/project/src/index.ts"
      const result = generatePattern(errorOutput, "Create the file", "cat /home/user/file")

      expect(result).not.toBeNull()
      const regex = new RegExp(result!.regex, "i")
      // Should match the original error at minimum
      expect(regex.test(errorOutput)).toBe(true)
    })

    test("should generalize quoted strings", () => {
      const errorOutput = "Error: Module 'express' not found"
      const result = generatePattern(errorOutput, "npm install express", "node app.js")

      expect(result).not.toBeNull()
      const regex = new RegExp(result!.regex, "i")
      // Should match different module names
      expect(regex.test("Error: Module 'lodash' not found")).toBe(true)
    })

    test("should generalize hex hashes", () => {
      const errorOutput = "Error: commit abc1234def not found"
      const result = generatePattern(errorOutput, "git fetch", "git show abc1234def")

      expect(result).not.toBeNull()
      const regex = new RegExp(result!.regex, "i")
      // Should match different hashes
      expect(regex.test("Error: commit 9876543210 not found")).toBe(true)
    })
  })

  describe("key line detection", () => {
    test("should find line with error keyword", () => {
      const errorOutput = `
Running build...
Compiling files...
Error: Failed to compile module
Build process terminated
`
      const result = generatePattern(errorOutput, "Fix compilation", "npm run build")

      expect(result).not.toBeNull()
      expect(result!.description).toContain("Error: Failed to compile")
    })

    test("should find line with failed keyword", () => {
      const errorOutput = `
Step 1: OK
Step 2: OK
Step 3: FAILED - connection refused
Done.
`
      const result = generatePattern(errorOutput, "Check connection", "deploy.sh")

      expect(result).not.toBeNull()
      expect(result!.description).toContain("FAILED")
    })

    test("should use last line as fallback", () => {
      const errorOutput = `
Processing...
Something happened
Final status: incomplete
`
      const result = generatePattern(errorOutput, "Fix", "cmd")

      expect(result).not.toBeNull()
      expect(result!.description).toContain("Final status")
    })
  })
})

describe("PendingCapture", () => {
  beforeEach(() => {
    // Clear the buffer before each test
    const g = globalThis as any
    if (g.__cyxcode_capture_buffer) g.__cyxcode_capture_buffer.clear()
    if (g.__cyxcode_capture_order) g.__cyxcode_capture_order.length = 0
  })

  describe("record", () => {
    test("should record error for a message ID", () => {
      PendingCapture.record("msg-1", "Error: test", "cmd", 1)

      const entries = PendingCapture.drain("msg-1")
      expect(entries).toHaveLength(1)
      expect(entries[0].errorOutput).toBe("Error: test")
      expect(entries[0].failedCommand).toBe("cmd")
      expect(entries[0].exitCode).toBe(1)
    })

    test("should accumulate multiple errors for same message", () => {
      PendingCapture.record("msg-1", "Error 1", "cmd1", 1)
      PendingCapture.record("msg-1", "Error 2", "cmd2", 2)

      const entries = PendingCapture.drain("msg-1")
      expect(entries).toHaveLength(2)
    })

    test("should truncate long error output", () => {
      const longError = "x".repeat(5000)
      PendingCapture.record("msg-1", longError, "cmd", 1)

      const entries = PendingCapture.drain("msg-1")
      expect(entries[0].errorOutput.length).toBeLessThanOrEqual(2000)
    })
  })

  describe("drain", () => {
    test("should return and clear entries for message ID", () => {
      PendingCapture.record("msg-1", "Error", "cmd", 1)

      const entries1 = PendingCapture.drain("msg-1")
      expect(entries1).toHaveLength(1)

      const entries2 = PendingCapture.drain("msg-1")
      expect(entries2).toHaveLength(0)
    })

    test("should return empty array for unknown message ID", () => {
      const entries = PendingCapture.drain("unknown")
      expect(entries).toHaveLength(0)
    })
  })

  describe("drainAll", () => {
    test("should return all entries and clear buffer", () => {
      PendingCapture.record("msg-1", "Error 1", "cmd1", 1)
      PendingCapture.record("msg-2", "Error 2", "cmd2", 1)
      PendingCapture.record("msg-1", "Error 3", "cmd3", 1)

      const all = PendingCapture.drainAll()
      expect(all).toHaveLength(3)

      const remaining = PendingCapture.drainAll()
      expect(remaining).toHaveLength(0)
    })
  })

  describe("FIFO eviction", () => {
    test("should evict oldest entries when buffer is full", () => {
      // Record more than MAX_CAPTURE_BUFFER (50) messages
      for (let i = 0; i < 60; i++) {
        PendingCapture.record(`msg-${i}`, `Error ${i}`, "cmd", 1)
      }

      // Old messages should be evicted
      const oldEntries = PendingCapture.drain("msg-0")
      expect(oldEntries).toHaveLength(0)

      // Recent messages should still be there
      const recentEntries = PendingCapture.drain("msg-59")
      expect(recentEntries).toHaveLength(1)
    })
  })
})
