import { expect, test } from "bun:test"
import { Env } from "../../src/env"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { tmpdir } from "../fixture/fixture"

test.each([
  ["xai", "@ai-sdk/xai", false, "/responses"],
  ["openai", "@ai-sdk/openai", false, "/responses"],
  ["azure", "@ai-sdk/azure", false, "/responses"],
  ["azure", "@ai-sdk/azure", true, "/chat/completions"],
  ["openai", "@ai-sdk/openai-compatible", false, "/chat/completions"],
  ["xai", "@ai-sdk/openai-compatible", false, "/chat/completions"],
] as const)("config-only %s with %s (chat=%s) uses %s", async (id, npm, chat, suffix) => {
  await using tmp = await tmpdir({
    config: {
      provider: {
        [id]: {
          npm,
          models: { alias: { id: "test-model", name: "Alias" } },
          options: {
            apiKey: "config-key",
            baseURL: "https://proxy.example.invalid/v1",
            useCompletionUrls: chat,
            headers: { "x-config": "preserved" },
          },
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const requests: Request[] = []
      const provider = await Provider.getProvider(ProviderID.make(id))
      provider.options.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(new Request(input, init))
        return Response.json({
          id: "response-1",
          created_at: 0,
          model: "test-model",
          object: "response",
          output: [],
          status: "completed",
          choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          usage: { input_tokens: 1, output_tokens: 0, prompt_tokens: 1, completion_tokens: 0 },
        })
      }
      const model = await Provider.getLanguage(await Provider.getModel(ProviderID.make(id), ModelID.make("alias")))
      await model.doGenerate({ prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }] })
      expect(provider.source).toBe("config")
      expect(requests).toHaveLength(1)
      expect(requests[0].url).toStartWith("https://proxy.example.invalid/v1/")
      expect(new URL(requests[0].url).pathname).toEndWith(suffix)
      expect(requests[0].headers.get("x-config")).toBe("preserved")
      expect(requests[0].headers.get(id === "azure" ? "api-key" : "authorization")).toBe(
        id === "azure" ? "config-key" : "Bearer config-key",
      )
    },
  })
})

test.each([false, true])("config-only Anthropic gets loader headers; explicit overrides win (%s)", async (override) => {
  await using tmp = await tmpdir({
    config: {
      provider: {
        anthropic: {
          options: {
            apiKey: "config-key",
            headers: { "x-config": "preserved", ...(override && { "anthropic-beta": "custom-beta" }) },
          },
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const provider = await Provider.getProvider(ProviderID.anthropic)
      expect(provider.options.headers["x-config"]).toBe("preserved")
      expect(provider.options.headers["anthropic-beta"]).toBe(
        override ? "custom-beta" : "interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
      )
    },
  })
})

test("explicit config retains precedence over an environment connection and loader defaults", async () => {
  await using tmp = await tmpdir({
    config: {
      provider: {
        anthropic: {
          options: { apiKey: "config-key", headers: { "anthropic-beta": "custom-beta" } },
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("ANTHROPIC_API_KEY", "environment-key")
    },
    fn: async () => {
      const provider = await Provider.getProvider(ProviderID.anthropic)
      expect(provider.source).toBe("config")
      expect(provider.key).toBe("environment-key")
      expect(provider.options.apiKey).toBe("config-key")
      expect(provider.options.headers["anthropic-beta"]).toBe("custom-beta")
    },
  })
})
