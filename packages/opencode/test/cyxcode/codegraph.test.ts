import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Codegraph } from "../../src/cyxcode/codegraph"
import { CyxPaths } from "../../src/cyxcode/paths"

describe("Codegraph", () => {
  let dir: string
  let cwd: string

  beforeEach(async () => {
    cwd = process.cwd()
    const base = path.join(cwd, ".tmp")
    await fs.mkdir(base, { recursive: true })
    dir = await fs.mkdtemp(path.join(base, "cyxgraph-test-"))
    await fs.mkdir(path.join(dir, ".opencode"), { recursive: true })
    await fs.mkdir(path.join(dir, ".git"), { recursive: true })
    await fs.mkdir(path.join(dir, "src"), { recursive: true })
    process.chdir(dir)
    CyxPaths.invalidateCache()
  })

  afterEach(async () => {
    process.chdir(cwd)
    CyxPaths.invalidateCache()
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  })

  test("rebuild indexes imports and symbols", async () => {
    await fs.writeFile(
      path.join(dir, "src", "lib.ts"),
      [
        "export function foo() { return 1 }",
        "export const bar = 2",
        "export default function run() { return foo() }",
        "",
      ].join("\n"),
    )

    await fs.writeFile(
      path.join(dir, "src", "app.ts"),
      [
        'import { foo } from "@/lib"',
        'import run from "./lib"',
        "export function main() {",
        "  return foo() + run()",
        "}",
        "",
      ].join("\n"),
    )

    const stats = await Codegraph.rebuild()
    expect(stats.files).toBe(2)
    expect(stats.symbols).toBeGreaterThanOrEqual(3)

    const idx = await Codegraph.readIndex()
    const lib = idx.files.find((item) => item.id === "src/lib")
    const app = idx.files.find((item) => item.id === "src/app")

    expect(lib?.exports).toContain("foo")
    expect(lib?.exports).toContain("default")
    expect(app?.imports).toContain("src/lib")
    expect(app?.uses).toContain("src/lib#foo")
    expect(app?.uses).toContain("src/lib#default")

    const graph = Codegraph.graph(idx)
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: "src/app", to: "src/lib", type: "import" },
        { from: "src/app", to: "src/lib#foo", type: "uses" },
        { from: "src/app", to: "src/lib#default", type: "uses" },
        { from: "src/lib", to: "src/lib#foo", type: "declares" },
      ]),
    )

    const query = Codegraph.query(["foo"], idx.files)
    expect(query[0]?.id).toBe("src/lib")

    const hot = Codegraph.hotspots(idx.files, 1)
    expect(hot[0]?.id).toBe("src/app")

    const page = await Codegraph.page("src/app")
    expect(page?.content).toContain('import { foo } from "@/lib"')
  })
})
