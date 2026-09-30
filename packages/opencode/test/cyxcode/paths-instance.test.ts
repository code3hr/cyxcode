import { expect, test } from "bun:test"
import path from "node:path"
import { Instance } from "../../src/project/instance"
import { CyxPaths } from "../../src/cyxcode/paths"
import { WatchPolicy } from "../../src/cyxcode/watch/policy"
import { tmpdir } from "../fixture/fixture"

test("concurrent project instances resolve and persist policies in their own state directories", async () => {
  await using first = await tmpdir({
    git: true,
    init: (dir) => Bun.write(path.join(dir, ".cyxcode", "config.json"), "{}"),
  })
  await using second = await tmpdir({
    git: true,
    init: (dir) => Bun.write(path.join(dir, ".opencode", "config.json"), "{}"),
  })
  const outside = CyxPaths.projectDir()
  const gate = Promise.withResolvers<void>()
  let arrived = 0
  await Promise.all(
    [
      [first.path, ".cyxcode"],
      [second.path, ".opencode"],
    ].map(([dir, mode]) =>
      Instance.provide({
        directory: dir,
        fn: async () => {
          try {
            if (++arrived === 2) gate.resolve()
            await gate.promise
            const root = path.join(dir, mode)
            expect(CyxPaths.projectDir()).toBe(root)
            expect(CyxPaths.memoryDir()).toBe(path.join(root, "memory"))
            expect(CyxPaths.historyDir()).toBe(path.join(root, "history"))
            expect(CyxPaths.wikiDir()).toBe(path.join(root, "wiki"))
            expect(CyxPaths.learnedPath()).toBe(
              path.join(root, mode === ".cyxcode" ? "patterns/learned.json" : "cyxcode-learned.json"),
            )
            // Assert the destination before any write, even when testing a broken resolver.
            expect(WatchPolicy.file()).toBe(path.join(root, "cyxwatch", "policy.json"))
            await WatchPolicy.save({ version: 2, rules: [{ id: mode, permission: ["read"], decision: "block" }] })
            expect(WatchPolicy.user().rules.map((rule) => rule.id)).toEqual([mode])
            expect(CyxPaths.projectDir()).toBe(root)
          } finally {
            await Instance.dispose()
          }
        },
      }),
    ),
  )
  expect(CyxPaths.projectDir()).toBe(outside)
})
