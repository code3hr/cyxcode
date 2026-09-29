import { expect, test } from "bun:test"
import type { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { ProviderTransform } from "../../src/provider/transform"

function model(id: string, provider = "custom"): Provider.Model {
  return {
    id: ModelID.make("alias"),
    providerID: ProviderID.make(provider),
    api: { id, npm: "@ai-sdk/openai-compatible", url: "https://example.invalid/v1" },
    name: "Alias",
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: false,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 128000, output: 8192 },
    status: "active",
    options: {},
    headers: {},
    release_date: "",
  }
}

test.each([
  "gemini-2.5-pro",
  "google/gemini-2-5-flash",
  "gemini-3-pro-preview",
  "gemini-3-flash",
  "gemini-3.1-pro",
  "gemini-3-1-flash-lite",
  "gemini-3.5-flash",
  "GOOGLE/GEMINI-3-5-FLASH-PREVIEW",
])("preserves supported Gemini sampling through an alias: %s", (id) => {
  expect(ProviderTransform.temperature(model(id))).toBe(1)
  expect(ProviderTransform.topP(model(id))).toBe(0.95)
  expect(ProviderTransform.topK(model(id))).toBe(64)
})

test.each([
  "gemini-2.0-flash",
  "gemini-2.50-pro",
  "gemini-3.5-flash-lite",
  "gemini-3-5-flash-lite-preview",
  "gemini-3.5-pro",
  "gemini-3.10-pro",
  "gemini-4-flash",
  "qwen3-coder",
  "Qwen/Qwen3.5-397B-A17B",
])("omits sampling defaults for %s", (id) => {
  expect(ProviderTransform.temperature(model(id))).toBeUndefined()
  expect(ProviderTransform.topP(model(id))).toBeUndefined()
  expect(ProviderTransform.topK(model(id))).toBeUndefined()
})

test("a misleading display ID does not enable sampling defaults", () => {
  const value = { ...model("unknown"), id: ModelID.make("gemini-2.5-pro") }
  expect(ProviderTransform.temperature(value)).toBeUndefined()
  expect(ProviderTransform.topP(value)).toBeUndefined()
  expect(ProviderTransform.topK(value)).toBeUndefined()
})

test.each([
  ["deepseek", "deepseek-v4-flash", 0.95],
  ["opencode", "deepseek-v4-flash", 0.95],
  ["opencode-go", "deepseek-v4-flash", 0.95],
  ["custom", "deepseek-v4-flash-0731", 0.95],
  ["openrouter", "deepseek/deepseek-v4-flash:0731", 0.95],
  ["openrouter", "deepseek/deepseek-v4-flash", undefined],
  ["custom", "deepseek-v4-flash", undefined],
  ["deepseek", "deepseek-v4-pro", undefined],
] as const)("scopes DeepSeek top-p: %s / %s", (provider, id, expected) => {
  expect(ProviderTransform.topP(model(id, provider))).toBe(expected)
})

test.each([
  ["minimax-m2", 1, 0.95, 20],
  ["minimax-m2.5", 1, 0.95, 40],
  ["kimi-k2", 0.6, undefined, undefined],
  ["kimi-k2.5", 1, 0.95, undefined],
  ["glm-4.7", 1, undefined, undefined],
  ["claude-sonnet-4", undefined, undefined, undefined],
] as const)("preserves other family defaults through aliases: %s", (id, temperature, topP, topK) => {
  expect(ProviderTransform.temperature(model(id))).toBe(temperature)
  expect(ProviderTransform.topP(model(id))).toBe(topP)
  expect(ProviderTransform.topK(model(id))).toBe(topK)
})
