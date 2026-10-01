import { expect, test } from "bun:test"
import path from "node:path"
import { Instance } from "../../src/project/instance"
import { getRouter } from "../../src/cyxcode"
import { LearnedSkill } from "../../src/cyxcode/learned"
import { initialize } from "../../src/cyxcode/patterns"
import { CyxPaths } from "../../src/cyxcode/paths"
import { tmpdir } from "../fixture/fixture"

test("project routers do not share registered skills or counters", async () => {
  await using first = await tmpdir({ git: true })
  await using second = await tmpdir({ git: true })
  const router = await Instance.provide({
    directory: first.path,
    fn: () => {
      const router = getRouter()
      const skill = new LearnedSkill([])
      skill.name = "first-project-only"
      router.register(skill)
      router.recordMatch(skill.name)
      return router
    },
  })
  await Instance.provide({
    directory: second.path,
    fn: async () => {
      expect(getRouter()).not.toBe(router)
      expect(getRouter().get("first-project-only")).toBeUndefined()
      expect(getRouter().routerStats().matches).toBe(0)
      await Instance.dispose()
    },
  })
  await Instance.provide({
    directory: first.path,
    fn: async () => {
      expect(getRouter()).toBe(router)
      expect(getRouter().routerStats().matches).toBe(1)
      await Instance.dispose()
    },
  })
})

test("project pattern loading is independent and reloads after disposal", async () => {
  await using home = await tmpdir()
  await using first = await tmpdir({ git: true })
  await using second = await tmpdir({ git: true })
  const prior = process.env.CYXWIZ_TEST_HOME
  process.env.CYXWIZ_TEST_HOME = home.path
  const pattern = (id: string) => ({ id, regex: `CYX_SCOPE_${id}`, category: "learned", description: id, fixes: [] })
  const write = (file: string, id: string) =>
    Bun.write(file, JSON.stringify({ version: 1, pending: [], approved: [pattern(id)] }))
  try {
    expect(CyxPaths.globalLearnedPath()).toBe(path.join(home.path, ".cyxcode", "patterns", "learned.json"))
    await write(CyxPaths.globalLearnedPath(), "shared")
    await write(path.join(first.path, ".opencode", "cyxcode-learned.json"), "first")
    await write(path.join(second.path, ".opencode", "cyxcode-learned.json"), "second")
    const routers = await Promise.all(
      [first.path, second.path].map((dir, index) =>
        Instance.provide({
          directory: dir,
          fn: async () => {
            const router = initialize()
            await router.ready
            expect(initialize()).toBe(router)
            expect(router.findMatching(`CYX_SCOPE_${index === 0 ? "first" : "second"}`)).toHaveLength(1)
            expect(router.findMatching(`CYX_SCOPE_${index === 0 ? "second" : "first"}`)).toEqual([])
            expect(router.findMatching("CYX_SCOPE_shared")).toHaveLength(1)
            await Instance.dispose()
            return router
          },
        }),
      ),
    )
    expect(routers[0]).not.toBe(routers[1])
    await write(path.join(first.path, ".opencode", "cyxcode-learned.json"), "replacement")
    await Instance.provide({
      directory: first.path,
      fn: async () => {
        const router = initialize()
        await router.ready
        expect(router).not.toBe(routers[0])
        expect(router.findMatching("CYX_SCOPE_first")).toEqual([])
        expect(router.findMatching("CYX_SCOPE_replacement")).toHaveLength(1)
        await Instance.dispose()
      },
    })
  } finally {
    if (prior === undefined) delete process.env.CYXWIZ_TEST_HOME
    if (prior !== undefined) process.env.CYXWIZ_TEST_HOME = prior
    CyxPaths.invalidateCache()
  }
})
