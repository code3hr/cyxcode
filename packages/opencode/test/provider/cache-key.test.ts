import { expect, test } from "bun:test"
import { Env } from "../../src/env"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { ProviderTransform } from "../../src/provider/transform"
import { tmpdir } from "../fixture/fixture"

test.each([
  ["openai", "custom"],
  ["azure", "custom"],
  ["xai", "xai"],
  ["cerebras", "custom"],
  ["deepinfra", "custom"],
])("%s SDK with provider %s sends the cache key and honors opt-out", async (sdk, id) => {
  await using tmp = await tmpdir({
    config: {
      provider: {
        [id]: {
          npm: `@ai-sdk/${sdk}`,
          api: "https://example.invalid/v1",
          models: { test: { name: "Test" } },
          options: { apiKey: "test" },
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      if (sdk === "xai") Env.set("XAI_API_KEY", "test")
    },
    fn: async () => {
      const bodies: Record<string, unknown>[] = []
      const provider = await Provider.getProvider(ProviderID.make(id))
      provider.options.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return Response.json({
          id: "response-1",
          created: 0,
          created_at: 0,
          model: "test",
          object: "response",
          output: [],
          status: "completed",
          choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          usage: { input_tokens: 1, output_tokens: 0, prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 },
        })
      }
      const model = await Provider.getModel(ProviderID.make(id), ModelID.make("test"))
      const language = await Provider.getLanguage(model)
      for (const enabled of [true, false]) {
        await language.doGenerate({
          prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
          providerOptions: ProviderTransform.providerOptions(
            model,
            ProviderTransform.options({
              model,
              sessionID: "session-123",
              providerOptions: enabled ? {} : { setCacheKey: false },
            }),
          ),
        })
      }
      expect(bodies).toHaveLength(2)
      expect(bodies[0].prompt_cache_key).toBe("session-123")
      expect(bodies[0].promptCacheKey).toBeUndefined()
      expect(bodies[1].prompt_cache_key).toBeUndefined()
      expect(bodies[1].promptCacheKey).toBeUndefined()
    },
  })
})
