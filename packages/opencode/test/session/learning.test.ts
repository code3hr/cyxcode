import { expect, test } from "bun:test"
import path from "node:path"
import { Instance } from "../../src/project/instance"
import { CyxPaths } from "../../src/cyxcode/paths"
import { LearnedPatterns, LearnedSkill, PendingCapture } from "../../src/cyxcode/learned"
import { SkillRouter } from "../../src/cyxcode/router"
import { CyxWatch } from "../../src/cyxcode/watch"
import { close } from "../../src/cyxcode/recall/db"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionPrompt } from "../../src/session/prompt"
import { MessageID } from "../../src/session/schema"
import { tmpdir } from "../fixture/fixture"

test("learning consumes only the completing user turn and approved patterns can be reloaded", async () => {
  using server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      return new Response(
        'data: {"choices":[{"index":0,"delta":{"content":"To resolve this fixture error, run `echo repaired`."},"finish_reason":null}]}\n\ndata: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
        { headers: { "content-type": "text/event-stream" } },
      )
    },
  })
  await using tmp = await tmpdir({
    git: true,
    init: (dir) =>
      Bun.write(path.join(dir, ".cyxcode", "patterns", "learned.json"), '{"version":1,"pending":[],"approved":[]}'),
    config: {
      model: "learning/test",
      small_model: "learning/test",
      provider: {
        learning: {
          npm: "@ai-sdk/openai-compatible",
          api: `${server.url.origin}/v1`,
          options: { apiKey: "test" },
          models: { test: { name: "Test", limit: { context: 128000, output: 8192 } } },
        },
      },
    },
  })
  const cwd = process.cwd()
  process.chdir(tmp.path)
  CyxPaths.invalidateCache()
  try {
    expect(LearnedPatterns.filePath()).toBe(path.join(tmp.path, ".cyxcode", "patterns", "learned.json"))
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await CyxWatch.savePolicy({
          version: 2,
          rules: [{ permission: ["webfetch"], host: [server.url.host], decision: "allow" }],
        })
        const session = await Session.create({ title: "Learning fixture" })
        const other = await Session.create({ title: "Other fixture" })
        await using cleanup = {
          async [Symbol.asyncDispose]() {
            await Session.remove(session.id)
            await Session.remove(other.id)
            await Instance.dispose()
          },
        }
        const model = { providerID: ProviderID.make("learning"), modelID: ModelID.make("test") }
        const seed = async (id: typeof session.id, output: string) => {
          const user = await SessionPrompt.prompt({
            sessionID: id,
            model,
            noReply: true,
            parts: [{ type: "text", text: "Explain the controlled fixture error." }],
          })
          const assistant: MessageV2.Assistant = {
            id: MessageID.ascending(),
            parentID: user.info.id,
            sessionID: id,
            role: "assistant",
            agent: "build",
            mode: "build",
            modelID: model.modelID,
            providerID: model.providerID,
            path: { cwd: tmp.path, root: tmp.path },
            time: { created: Date.now(), completed: Date.now() },
            finish: "tool-calls",
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          }
          await Session.updateMessage(assistant)
          SkillRouter.recordMiss(assistant.id, output, "fixture", 1)
          return assistant
        }
        const stale = await seed(session.id, "Error: cyxprobe stale turn")
        const foreign = await seed(other.id, "Error: cyxprobe foreign session")
        const current = await seed(session.id, "Error: cyxprobe current turn")
        const next = { ...current, id: MessageID.ascending() }
        await Session.updateMessage(next)
        SkillRouter.recordMiss(next.id, "Error: cyxprobe second step", "fixture", 1)

        await SessionPrompt.loop({ sessionID: session.id })
        const pending = await LearnedPatterns.listPending()
        expect(pending.map((entry) => entry.errorOutput).sort()).toEqual([
          "Error: cyxprobe current turn",
          "Error: cyxprobe second step",
        ])
        expect(PendingCapture.drain(current.id)).toEqual([])
        expect(PendingCapture.drain(next.id)).toEqual([])
        expect(PendingCapture.drain(stale.id).map((entry) => entry.errorOutput)).toEqual(["Error: cyxprobe stale turn"])
        expect(PendingCapture.drain(foreign.id).map((entry) => entry.errorOutput)).toEqual([
          "Error: cyxprobe foreign session",
        ])
        expect(await LearnedPatterns.loadApproved()).toEqual([])
        expect(await LearnedPatterns.approve(pending[0].id)).toBe(true)
        const skill = new LearnedSkill(await LearnedPatterns.loadApproved())
        expect(skill.match(pending[0].errorOutput)?.pattern.fixes[0].command).toBe("echo repaired")
        expect(skill.match("Error: completely unrelated fixture")).toBeNull()
      },
    })
  } finally {
    PendingCapture.drainAll()
    CyxWatch.close()
    close()
    process.chdir(cwd)
    CyxPaths.invalidateCache()
  }
})
