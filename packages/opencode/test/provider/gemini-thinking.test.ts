import { describe, expect, test } from "bun:test"
import { ProviderTransform } from "../../src/provider/transform"
import type { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"

function model(id: string, npm = "@ai-sdk/google"): Provider.Model {
  return {
    id: ModelID.make("custom-alias"),
    providerID: ProviderID.make("custom"),
    api: { id, npm, url: "https://example.com" },
    name: "Custom alias",
    capabilities: {
      temperature: true,
      reasoning: true,
      attachment: true,
      toolcall: true,
      input: { text: true, audio: false, image: true, video: false, pdf: true },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 1_000_000, output: 65536 },
    status: "active",
    options: {},
    headers: {},
    release_date: "2026-01-01",
  }
}

describe.each(["@ai-sdk/google", "@ai-sdk/google-vertex"])("%s thinking", (npm) => {
  test.each([
    ["gemini-3-pro", ["low", "medium", "high"]],
    ["gemini-3-flash", ["minimal", "low", "medium", "high"]],
    ["gemini-9-pro", ["low", "medium", "high"]],
    ["gemini-flash-latest", ["minimal", "low", "medium", "high"]],
    ["gemini-pro-latest", ["low", "medium", "high"]],
    ["gemini-3.1-flash-image", ["minimal", "high"]],
    ["gemini-3-pro-image", ["high"]],
    ["gemma-4-31b", ["minimal", "high"]],
  ] as const)("%s uses supported levels through an alias", (id, levels) => {
    const cfg = model(id, npm)
    expect(Object.keys(ProviderTransform.variants(cfg))).toEqual([...levels])
    expect(ProviderTransform.options({ model: cfg, sessionID: "test" }).thinkingConfig).toEqual({
      includeThoughts: true,
      thinkingLevel: "high",
    })
    expect(ProviderTransform.smallOptions(cfg)).toEqual({ thinkingConfig: { thinkingLevel: levels[0] } })
  })

  test.each(["gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-pro", "gemini-2-5-flash", "gemini-flash-2.5"])(
    "%s keeps legacy defaults",
    (id) => {
      const cfg = model(id, npm)
      expect(ProviderTransform.options({ model: cfg, sessionID: "test" }).thinkingConfig).toEqual({
        includeThoughts: true,
      })
      expect(ProviderTransform.smallOptions(cfg)).toEqual({ thinkingConfig: { thinkingBudget: 0 } })
    },
  )

  test("does not enable reasoning for a model without the capability", () => {
    const cfg = model("gemini-flash-latest", npm)
    cfg.capabilities.reasoning = false
    expect(ProviderTransform.options({ model: cfg, sessionID: "test" }).thinkingConfig).toBeUndefined()
    expect(ProviderTransform.variants(cfg)).toEqual({})
  })
})

test.each(["@ai-sdk/google", "@ai-sdk/google-vertex", "@ai-sdk/gateway", "@jerome-benoit/sap-ai-provider-v2"])(
  "%s uses API IDs for Gemini 2.5 budgets",
  (npm) => {
    expect(ProviderTransform.variants(model("google/gemini-2.5-pro", npm)).max.thinkingConfig.thinkingBudget).toBe(
      32768,
    )
    expect(ProviderTransform.variants(model("google/gemini-2-5-flash", npm)).max.thinkingConfig.thinkingBudget).toBe(
      24576,
    )
  },
)

test("Gateway retains its level option shape for aliases", () => {
  expect(ProviderTransform.variants(model("google/gemini-flash-latest", "@ai-sdk/gateway")).minimal).toEqual({
    includeThoughts: true,
    thinkingLevel: "minimal",
  })
})

test.each(["google/gemini-9-pro", "google/gemini-flash-latest"])("OpenRouter enables %s reasoning", (id) => {
  const cfg = model(id, "@openrouter/ai-sdk-provider")
  expect(ProviderTransform.options({ model: cfg, sessionID: "test" }).reasoning).toEqual({ effort: "high" })
  expect(ProviderTransform.variants(cfg).high).toEqual({ reasoning: { effort: "high" } })
})

test.each(["google/gemini-2.5-pro", "unrelated-model"])("OpenRouter retains its %s gate", (id) => {
  const cfg = model(id, "@openrouter/ai-sdk-provider")
  expect(ProviderTransform.options({ model: cfg, sessionID: "test" }).reasoning).toBeUndefined()
  expect(ProviderTransform.variants(cfg)).toEqual({})
})
