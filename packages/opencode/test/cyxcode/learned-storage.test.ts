import { expect, test } from "bun:test"
import path from "node:path"
import fs from "node:fs/promises"
import { Instance } from "../../src/project/instance"
import { LearnedPatterns } from "../../src/cyxcode/learned"
import { Dream } from "../../src/cyxcode/dream"
import { tmpdir } from "../fixture/fixture"

const names = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"]
const entry = (name: string) => ({
  errorOutput: `Error: storage fixture ${name} unavailable`,
  aiFixText: "Run `echo repaired` to resolve this fixture.",
  failedCommand: "fixture",
  exitCode: 1,
})

test("learning writes remain in the originating project during concurrent updates", async () => {
  await using first = await tmpdir({ git: true })
  await using second = await tmpdir({ git: true })
  await Promise.all(
    [first.path, second.path].map((dir, index) =>
      Instance.provide({
        directory: dir,
        fn: async () => {
          expect(LearnedPatterns.filePath()).toBe(path.join(dir, ".opencode", "cyxcode-learned.json"))
          await Promise.all(
            names.map((name) => LearnedPatterns.addPending(entry(`${index ? "second" : "first"} ${name}`))),
          )
          const pending = await LearnedPatterns.listPending()
          expect(pending).toHaveLength(names.length)
          expect(pending.every((item) => item.errorOutput.includes(index ? "second" : "first"))).toBe(true)
          await Instance.dispose()
        },
      }),
    ),
  )
})

test("maintenance and new captures share the same storage transaction", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      expect(LearnedPatterns.filePath()).toBe(path.join(tmp.path, ".opencode", "cyxcode-learned.json"))
      const valid = {
        id: "valid",
        regex: "Error: maintenance fixture",
        category: "learned" as const,
        description: "fixture",
        fixes: [],
      }
      await LearnedPatterns.write({
        version: 1,
        pending: [],
        approved: [valid, valid, { ...valid, id: "broken", regex: "[" }],
      })
      await Promise.all([Dream.deduplicatePatterns(), Dream.validate(), LearnedPatterns.addPending(entry("new"))])
      expect((await LearnedPatterns.loadApproved()).map((item) => item.id)).toEqual(["valid"])
      expect((await LearnedPatterns.listPending()).map((item) => item.errorOutput)).toEqual([entry("new").errorOutput])
      await Instance.dispose()
    },
  })
})

test("concurrent additions and approvals preserve every distinct learned pattern", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      expect(LearnedPatterns.filePath()).toBe(path.join(tmp.path, ".opencode", "cyxcode-learned.json"))
      await Promise.all(names.map((name) => LearnedPatterns.addPending(entry(name))))
      const pending = await LearnedPatterns.listPending()
      expect(pending.map((item) => item.errorOutput).sort()).toEqual(
        names.map((name) => entry(name).errorOutput).sort(),
      )
      expect(new Set(pending.map((item) => item.id)).size).toBe(names.length)
      expect(
        await Promise.all(
          pending.map((item, index) =>
            index % 2 ? LearnedPatterns.reject(item.id) : LearnedPatterns.approve(item.id),
          ),
        ),
      ).toEqual(names.map(() => true))
      expect(await LearnedPatterns.listPending()).toEqual([])
      expect(await LearnedPatterns.loadApproved()).toHaveLength(3)
      await Instance.dispose()
    },
  })
})

test("duplicate concurrent captures are persisted once", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      expect(LearnedPatterns.filePath()).toBe(path.join(tmp.path, ".opencode", "cyxcode-learned.json"))
      await Promise.all(names.map(() => LearnedPatterns.addPending(entry("same"))))
      expect(await LearnedPatterns.listPending()).toHaveLength(1)
      await Instance.dispose()
    },
  })
})

test("unreadable or malformed stores fail without reporting a successful update", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const file = path.join(tmp.path, ".opencode", "cyxcode-learned.json")
      expect(LearnedPatterns.filePath()).toBe(file)
      await fs.mkdir(file, { recursive: true })
      await expect(LearnedPatterns.write({ version: 1, pending: [], approved: [] })).rejects.toThrow()
      await expect(LearnedPatterns.addPending(entry("blocked"))).rejects.toThrow()
      await fs.rmdir(file)
      await Bun.write(file, "{broken")
      await expect(LearnedPatterns.addPending(entry("malformed"))).rejects.toThrow()
      expect(await Bun.file(file).text()).toBe("{broken")
      await Bun.write(file, '{"version":1,"pending":[],"approved":[]}')
      await LearnedPatterns.addPending(entry("recovered"))
      expect(await LearnedPatterns.listPending()).toHaveLength(1)
      await Instance.dispose()
    },
  })
})
