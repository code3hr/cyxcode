import { expect, test } from "bun:test"
import path from "node:path"
import { Agent } from "../../src/agent/agent"
import { CyxWatch } from "../../src/cyxcode/watch"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { LLM } from "../../src/session/llm"
import { MessageID, SessionID } from "../../src/session/schema"
import { tmpdir } from "../fixture/fixture"

test.each(["default", "model", "agent", "variant", "plugin", "other"])(
  "Cerebras completion limit reaches the LLM request without a conflicting default: %s",
  async (mode) => {
    const bodies: Record<string, unknown>[] = []
    using server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        bodies.push(await request.json())
        return new Response(
          'data: {"choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":null}]}\n\ndata: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
          { headers: { "content-type": "text/event-stream" } },
        )
      },
    })
    await using tmp = await tmpdir({
      config: {
        provider: {
          custom: {
            npm: mode === "other" ? "@ai-sdk/openai-compatible" : "@ai-sdk/cerebras",
            api: `${server.url.origin}/v1`,
            options: { apiKey: "test" },
            models: {
              test: {
                name: "Test",
                limit: { context: 128000, output: 8192 },
                options: mode === "model" || mode === "other" ? { max_completion_tokens: 1234 } : {},
                variants: { limited: { max_completion_tokens: 1234 } },
              },
            },
          },
        },
      },
      init: async (dir) => {
        if (mode !== "plugin") return
        await Bun.write(
          path.join(dir, ".opencode", "plugin", "limit.ts"),
          'export default async () => ({ "chat.params": async (_input, output) => { output.options.max_completion_tokens = 1234 } })',
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await CyxWatch.savePolicy({
          version: 2,
          rules: [{ permission: ["webfetch"], host: [server.url.host], decision: "allow" }],
        })
        const model = await Provider.getModel(ProviderID.make("custom"), ModelID.make("test"))
        const agent = await Agent.get("build")
        const session = SessionID.descending()
        const stream = await LLM.stream({
          sessionID: session,
          user: {
            id: MessageID.ascending(),
            sessionID: session,
            role: "user",
            agent: "build",
            model: { providerID: model.providerID, modelID: model.id },
            time: { created: Date.now() },
            ...(mode === "variant" && { variant: "limited" }),
          },
          model,
          agent: mode === "agent" ? { ...agent, options: { ...agent.options, max_completion_tokens: 1234 } } : agent,
          system: [],
          messages: [{ role: "user", content: "Hello" }],
          tools: {},
          abort: new AbortController().signal,
        })
        expect(await stream.text).toBe("ok")
        expect(bodies).toHaveLength(1)
        if (mode === "default" || mode === "other") expect(bodies[0].max_tokens).toBe(8192)
        if (mode !== "default" && mode !== "other") expect(bodies[0].max_tokens).toBeUndefined()
        if (mode === "default") expect(bodies[0].max_completion_tokens).toBeUndefined()
        if (mode !== "default") expect(bodies[0].max_completion_tokens).toBe(1234)
      },
    })
  },
)
