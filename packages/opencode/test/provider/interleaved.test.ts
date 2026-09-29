import { expect, test } from "bun:test"
import { generateText, type ModelMessage } from "ai"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { ModelsDev } from "../../src/provider/models"
import { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { ProviderTransform } from "../../src/provider/transform"
import { tmpdir } from "../fixture/fixture"

test.each([true, false, "reasoning_text", { field: "custom_reasoning" }, undefined])(
  "normalizes catalog interleaved metadata %j",
  (interleaved) => {
    const catalog = ModelsDev.Provider.parse({
      id: "custom",
      name: "Custom",
      env: [],
      api: "https://example.invalid/v1",
      models: {
        model: {
          id: "model",
          name: "Model",
          release_date: "2026-01-01",
          attachment: false,
          reasoning: true,
          temperature: false,
          tool_call: true,
          interleaved,
          options: {},
          limit: { context: 32000, output: 4000 },
        },
      },
    })
    const model = Provider.fromModelsDevProvider(catalog).models.model
    expect(Provider.Model.parse(model).capabilities.interleaved).toEqual(
      typeof interleaved === "string" ? { field: interleaved } : (interleaved ?? false),
    )
  },
)

test.each(["reasoning", "reasoning_content", "reasoning_details", "reasoning_text", "custom_reasoning"])(
  "serializes %s through config, history conversion and the installed SDK",
  async (field) => {
    await using tmp = await tmpdir({
      config: {
        provider: {
          custom: {
            npm: "@ai-sdk/openai-compatible",
            api: "https://example.invalid/v1",
            options: { apiKey: "test" },
            models: {
              model: { interleaved: field, reasoning: true },
              object: { interleaved: { field }, reasoning: true },
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
            id: "test",
            created: 0,
            model: "model",
            choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          })
        }
        const model = await Provider.getModel(provider.id, ModelID.make("model"))
        expect(model.capabilities.interleaved).toEqual({ field })
        expect((await Provider.getModel(provider.id, ModelID.make("object"))).capabilities.interleaved).toEqual({
          field,
        })
        const messages: ModelMessage[] = [
          {
            role: "assistant",
            content: [
              { type: "reasoning", text: "First. " },
              { type: "reasoning", text: "Second." },
              { type: "text", text: "Checking." },
              { type: "tool-call", toolCallId: "call_1", toolName: "lookup", input: { query: "test" } },
            ],
            providerOptions: { openaiCompatible: { custom_metadata: "preserved" } },
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "call_1",
                toolName: "lookup",
                output: { type: "text", value: "found" },
              },
            ],
          },
          { role: "user", content: "Continue" },
        ]
        expect(
          (
            await generateText({
              model: await Provider.getLanguage(model),
              messages: ProviderTransform.message(messages, model, {}),
              maxRetries: 0,
            })
          ).text,
        ).toBe("ok")
        expect(requests).toHaveLength(1)
        const body = await requests[0].json()
        expect(body.messages[0]).toEqual({
          role: "assistant",
          content: "Checking.",
          [field]: "First. Second.",
          custom_metadata: "preserved",
          tool_calls: [{ id: "call_1", type: "function", function: { name: "lookup", arguments: '{"query":"test"}' } }],
        })
        expect(body.messages[1]).toEqual({ role: "tool", tool_call_id: "call_1", content: "found" })
        expect(body.messages[2]).toEqual({ role: "user", content: "Continue" })
        expect(messages[0].content).toHaveLength(4)
      },
    })
  },
)

test.each([null, 42, {}, { field: false }, { field: "reasoning", extra: true }])(
  "rejects malformed interleaved config %j",
  (interleaved) => {
    expect(Config.Provider.safeParse({ models: { model: { interleaved } } }).success).toBe(false)
  },
)

test.each([undefined, false, true, "reasoning_text"])(
  "config override retains or replaces catalog metadata %j",
  async (interleaved) => {
    const catalog = await ModelsDev.get()
    const entry = Object.values(catalog)
      .flatMap((provider) => Object.values(provider.models).map((model) => ({ provider, model })))
      .find((entry) => typeof entry.model.interleaved === "object")!
    const inherited = entry.model.interleaved
    if (typeof inherited !== "object") throw new Error("Expected catalog reasoning field")
    await using tmp = await tmpdir({
      config: {
        enabled_providers: [entry.provider.id],
        provider: {
          [entry.provider.id]: {
            options: { apiKey: "test" },
            models: { alias: { id: entry.model.id, name: "CyxCode alias", interleaved } },
          },
        },
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const model = await Provider.getModel(ProviderID.make(entry.provider.id), ModelID.make("alias"))
        expect(model.name).toBe("CyxCode alias")
        expect(model.capabilities.interleaved).toEqual(
          typeof interleaved === "string" ? { field: interleaved } : (interleaved ?? inherited),
        )
      },
    })
  },
)
