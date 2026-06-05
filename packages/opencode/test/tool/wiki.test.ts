import { afterAll, afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import type { Tool } from "../../src/tool/tool"
import { Instance } from "../../src/project/instance"
import { CyxPaths } from "../../src/cyxcode/paths"
import { Wiki } from "../../src/cyxcode/wiki"
import { WikiReadTool, WikiWriteTool } from "../../src/tool/wiki"
import { MessageID, SessionID } from "../../src/session/schema"
import { tmpdir } from "../fixture/fixture"

const ctx: Tool.Context = {
  sessionID: SessionID.make("ses_test-wiki"),
  messageID: MessageID.make(""),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

const g = globalThis as typeof globalThis & {
  __cyxcode_recall_embedder_stub?: (texts: string[]) => Promise<Float32Array[]>
}
const stub = g.__cyxcode_recall_embedder_stub
g.__cyxcode_recall_embedder_stub = async (texts) => texts.map(() => Float32Array.from({ length: 384 }, () => 0))

afterEach(async () => {
  await Instance.disposeAll()
  CyxPaths.invalidateCache()
})

afterAll(() => {
  g.__cyxcode_recall_embedder_stub = stub
})

describe("tool.wiki", () => {
  test("creates and reads a wiki note", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const write = await WikiWriteTool.init()
        const made = await write.execute(
          {
            title: "Tool Notes",
            body: "Keep [[Project Notes]] available to later sessions.",
            tags: ["tools"],
          },
          ctx,
        )

        expect(made.title).toBe("Tool Notes")
        expect(made.metadata.page.kind).toBe("wiki")

        const read = await WikiReadTool.init()
        const found = await read.execute({ id: made.metadata.page.id }, ctx)

        expect(found.output).toContain("Tool Notes")
        expect(found.output).toContain("[[Project Notes]]")
      },
    })
  })

  test("does not update docs with wikiwrite", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await fs.mkdir(path.join(dir, "docs"), { recursive: true })
        await Bun.write(path.join(dir, "docs", "notes.md"), "# Project Notes\n\nDoc body.")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await Wiki.rebuild({ force: true })
        const doc = (await Wiki.readIndex()).pages.find((item) => item.kind === "doc")
        expect(doc).toBeDefined()

        const write = await WikiWriteTool.init()
        await expect(
          write.execute(
            {
              id: doc!.id,
              title: "Project Notes",
              body: "Wiki body.",
            },
            ctx,
          ),
        ).rejects.toThrow("can only update wiki notes")

        expect(await Bun.file(path.join(tmp.path, "docs", "notes.md")).text()).toContain("Doc body.")
      },
    })
  })
})
