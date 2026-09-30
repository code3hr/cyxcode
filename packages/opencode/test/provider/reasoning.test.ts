import { expect, test } from "bun:test"
import { ModelsDev } from "../../src/provider/models"
import { Provider } from "../../src/provider/provider"
import { ProviderTransform } from "../../src/provider/transform"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { tmpdir } from "../fixture/fixture"

function catalog(npm = "@ai-sdk/openai-compatible", options?: ModelsDev.Model["reasoning_options"], output = 64000) {
  return ModelsDev.Provider.parse({
    id: "custom",
    name: "Custom",
    env: [],
    npm,
    api: "https://example.invalid/v1",
    models: {
      model: {
        id: "model",
        name: "Model",
        release_date: "",
        attachment: false,
        reasoning: true,
        temperature: false,
        tool_call: true,
        options: {},
        reasoning_options: options,
        limit: { context: 128000, output },
      },
    },
  })
}

function model(npm = "@ai-sdk/openai-compatible", options?: ModelsDev.Model["reasoning_options"], output = 64000) {
  return Provider.fromModelsDevProvider(catalog(npm, options, output)).models.model
}

test("catalog effort metadata overrides guesses and empty metadata disables automatic variants", () => {
  expect(model().variants).toHaveProperty("medium")
  expect(model("@ai-sdk/openai-compatible", []).variants).toEqual({})
  expect(model("@ai-sdk/openai-compatible", [{ type: "effort", values: [] }]).variants).toEqual({})
  expect(model("@ai-sdk/openai-compatible", [{ type: "effort", values: [null, "custom", "high"] }]).variants).toEqual({
    none: { reasoningEffort: "none" },
    custom: { reasoningEffort: "custom" },
    high: { reasoningEffort: "high" },
  })
})

test.each([
  ["@ai-sdk/openai", ["none", "minimal", "low", "medium", "high", "xhigh"]],
  ["@ai-sdk/azure", ["none", "minimal", "low", "medium", "high", "xhigh"]],
  ["@ai-sdk/anthropic", ["low", "medium", "high", "max"]],
  ["@ai-sdk/google-vertex/anthropic", ["low", "medium", "high", "max"]],
  ["@ai-sdk/google", ["minimal", "low", "medium", "high"]],
  ["@ai-sdk/google-vertex", ["minimal", "low", "medium", "high"]],
  ["@ai-sdk/amazon-bedrock", ["low", "medium", "high", "max"]],
  ["@ai-sdk/groq", ["none", "default", "low", "medium", "high"]],
] as const)("filters effort values rejected by pinned %s", (npm, expected) => {
  expect(
    Object.keys(
      model(npm, [
        { type: "effort", values: [null, "default", "minimal", "low", "medium", "high", "xhigh", "max", "unknown"] },
      ]).variants ?? {},
    ),
  ).toEqual([...expected])
})

test("budgets obey metadata and output caps without generating impossible values", () => {
  expect(model("@ai-sdk/anthropic", [{ type: "budget_tokens" }]).variants).toEqual({
    high: { thinking: { type: "enabled", budgetTokens: 16000 } },
    max: { thinking: { type: "enabled", budgetTokens: 31999 } },
  })
  expect(model("@ai-sdk/anthropic", [{ type: "budget_tokens", min: 6000, max: 7000 }], 8192).variants).toEqual({
    high: { thinking: { type: "enabled", budgetTokens: 6000 } },
    max: { thinking: { type: "enabled", budgetTokens: 7000 } },
  })
  expect(model("@ai-sdk/anthropic", [{ type: "budget_tokens" }], 4096).variants?.max).toEqual({
    thinking: { type: "enabled", budgetTokens: 4095 },
  })
  expect(model("@ai-sdk/anthropic", [{ type: "budget_tokens", min: 9000 }], 4096).variants).toEqual({})
  expect(model("@ai-sdk/anthropic", [{ type: "budget_tokens" }], 1).variants).toEqual({})
})

test("Cohere toggle and budget combine while unsupported adapters preserve legacy behavior", () => {
  expect(model("@ai-sdk/cohere", [{ type: "toggle" }, { type: "budget_tokens", max: 4000 }]).variants).toEqual({
    none: { thinking: { type: "disabled" } },
    high: { thinking: { type: "enabled", tokenBudget: 2000 } },
    max: { thinking: { type: "enabled", tokenBudget: 4000 } },
  })
  expect(model("@ai-sdk/xai", [{ type: "effort", values: ["xhigh"] }]).variants).toEqual(model("@ai-sdk/xai").variants)
})

test("catalog metadata survives aliases, explicit clearing, and adapter changes", async () => {
  const data = await ModelsDev.get()
  const previous = data.custom
  data.custom = catalog("@ai-sdk/openai-compatible", [{ type: "effort", values: ["custom"] }])
  try {
    await using tmp = await tmpdir({
      config: {
        provider: {
          custom: {
            options: { apiKey: "test" },
            models: {
              alias: { id: "model", name: "CyxCode alias" },
              cleared: { id: "model", reasoning_options: [] },
              changed: { id: "model", provider: { npm: "@ai-sdk/anthropic" } },
            },
          },
        },
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const provider = await Provider.getProvider(ProviderID.make("custom"))
        expect(provider.models.alias.variants).toEqual({ custom: { reasoningEffort: "custom" } })
        expect(provider.models.cleared.variants).toEqual({})
        expect(provider.models.changed.variants).toEqual(ProviderTransform.variants(provider.models.changed))
        expect(provider.models.changed.variants).not.toHaveProperty("custom")
      },
    })
    data.custom.models.model.reasoning_options = [{ type: "future" }] as unknown as ModelsDev.Model["reasoning_options"]
    expect(Provider.fromModelsDevProvider(data.custom).models.model.variants).toEqual(model().variants)
  } finally {
    if (previous) data.custom = previous
    if (!previous) delete data.custom
  }
})

test.each([[{ type: "effort", values: [1] }], [{ type: "future" }], [{ type: "budget_tokens", max: Infinity }]])(
  "rejects invalid configuration metadata %j",
  (reasoning_options) => {
    expect(Config.Provider.safeParse({ models: { model: { reasoning_options } } }).success).toBe(false)
  },
)

test.each(["@ai-sdk/openai-compatible", "@ai-sdk/anthropic"])(
  "config metadata and explicit overrides reach the %s request",
  async (npm) => {
    await using tmp = await tmpdir({
      config: {
        provider: {
          custom: {
            npm,
            api: "https://example.invalid/v1",
            options: { apiKey: "test" },
            models: {
              alias: {
                id: "claude-sonnet-4-6",
                reasoning: true,
                limit: { context: 128000, output: 64000 },
                reasoning_options: [{ type: "effort", values: ["low", "high"] }],
                variants: {
                  low: { disabled: true },
                  high: { marker: "preserved" },
                  manual: { reasoningEffort: "custom" },
                },
              },
              empty: { reasoning: true, reasoning_options: [] },
              budget: {
                reasoning: true,
                limit: { context: 128000, output: 8192 },
                reasoning_options: [{ type: "budget_tokens", min: 2048, max: 4096 }],
              },
            },
          },
        },
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const requests: Request[] = []
        const provider = await Provider.getProvider(ProviderID.make("custom"))
        provider.options.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          requests.push(new Request(input, init))
          return Response.json({
            id: "message-1",
            type: "message",
            role: "assistant",
            model: "model",
            content: [{ type: "text", text: "ok" }],
            stop_reason: "end_turn",
            stop_sequence: null,
            choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
            usage: { input_tokens: 1, output_tokens: 1, prompt_tokens: 1, completion_tokens: 1 },
          })
        }
        const selected = await Provider.getModel(provider.id, ModelID.make("alias"))
        expect(Object.keys(selected.variants ?? {})).toEqual(["high", "manual"])
        expect(selected.variants?.high.marker).toBe("preserved")
        expect((await Provider.getModel(provider.id, ModelID.make("empty"))).variants).toEqual({})
        for (const name of ["alias", "budget"]) {
          const selected = await Provider.getModel(provider.id, ModelID.make(name))
          await (
            await Provider.getLanguage(selected)
          ).doGenerate({
            prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
            maxOutputTokens: 8192,
            providerOptions: ProviderTransform.providerOptions(selected, selected.variants?.high ?? {}),
          })
        }
        const first = await requests[0].json()
        if (npm === "@ai-sdk/anthropic") {
          expect(first.thinking).toEqual({ type: "adaptive" })
          expect(first.output_config).toEqual({ effort: "high" })
          expect((await requests[1].json()).thinking).toEqual({ type: "enabled", budget_tokens: 2048 })
        }
        if (npm === "@ai-sdk/openai-compatible") {
          expect(first.reasoning_effort).toBe("high")
          expect(first.marker).toBe("preserved")
        }
      },
    })
  },
)
