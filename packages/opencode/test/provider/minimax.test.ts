import { expect, test } from "bun:test"
import { mergeDeep } from "remeda"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { ProviderTransform } from "../../src/provider/transform"
import { tmpdir } from "../fixture/fixture"

test.each([
  ["custom", "@ai-sdk/anthropic"],
  ["custom", "@ai-sdk/openai-compatible"],
  ["nvidia", "@ai-sdk/openai-compatible"],
  ["lilac", "@ai-sdk/openai-compatible"],
  ["nvidia", "@ai-sdk/anthropic"],
])("MiniMax M3 alias sends supported thinking controls through %s / %s", async (id, npm) => {
  await using tmp = await tmpdir({
    config: {
      provider: {
        [id]: {
          npm,
          api: "https://example.invalid/v1",
          options: { apiKey: "test" },
          models: {
            alias: { id: "MiniMax-M3", name: "Alias", reasoning: true, limit: { context: 128000, output: 8192 } },
          },
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const bodies: Record<string, unknown>[] = []
      const provider = await Provider.getProvider(ProviderID.make(id))
      provider.options.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return Response.json({
          id: "message-1",
          type: "message",
          role: "assistant",
          model: "MiniMax-M3",
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          usage: { input_tokens: 1, output_tokens: 1, prompt_tokens: 1, completion_tokens: 1 },
        })
      }
      const model = await Provider.getModel(ProviderID.make(id), ModelID.make("alias"))
      const variants = ProviderTransform.variants(model)
      expect(Object.keys(variants)).toEqual(["none", "thinking"])
      const language = await Provider.getLanguage(model)
      for (const variant of [undefined, "none", "thinking"]) {
        const options = mergeDeep(
          ProviderTransform.options({ model, sessionID: "session-test" }),
          variant ? variants[variant] : {},
        )
        await language.doGenerate({
          prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
          maxOutputTokens: 8192,
          providerOptions: ProviderTransform.providerOptions(model, options),
        })
      }
      expect(bodies).toHaveLength(3)
      if (npm === "@ai-sdk/anthropic") {
        expect(bodies[0].thinking).toEqual({ type: "adaptive" })
        // The pinned SDK omits disabled thinking; MiniMax's Anthropic endpoint defaults it off.
        expect(bodies[1].thinking).toBeUndefined()
        expect(bodies[2].thinking).toEqual({ type: "adaptive" })
        expect(bodies[2].chat_template_kwargs).toBeUndefined()
      }
      if (npm === "@ai-sdk/openai-compatible" && id === "custom") {
        expect(bodies[0].thinking).toBeUndefined()
        expect(bodies[1].thinking).toEqual({ type: "disabled" })
        expect(bodies[2].thinking).toEqual({ type: "adaptive" })
      }
      if (npm === "@ai-sdk/openai-compatible" && id !== "custom") {
        expect(bodies[0].chat_template_kwargs).toBeUndefined()
        expect(bodies[1].chat_template_kwargs).toEqual({ thinking_mode: "disabled" })
        expect(bodies[2].chat_template_kwargs).toEqual({ thinking_mode: "enabled" })
        expect(bodies[2].thinking).toBeUndefined()
      }
      expect(
        ProviderTransform.variants({ ...model, capabilities: { ...model.capabilities, reasoning: false } }),
      ).toEqual({})
      expect(
        ProviderTransform.variants({
          ...model,
          id: ModelID.make("minimax-m2"),
          api: { ...model.api, id: "minimax-m2" },
        }),
      ).toEqual({})
    },
  })
})
