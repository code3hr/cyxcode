import { expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { tmpdir } from "../fixture/fixture"

test("SSE timeout preserves the timeout error when source cancellation rejects", async () => {
  await using tmp = await tmpdir({
    config: {
      provider: {
        stream: {
          npm: "@ai-sdk/openai-compatible",
          api: "https://example.invalid/v1",
          models: { test: { name: "Test" } },
          options: { apiKey: "test", chunkTimeout: 20 },
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const reasons: unknown[] = []
      const provider = await Provider.getProvider(ProviderID.make("stream"))
      provider.options.fetch = async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel(reason) {
              reasons.push(reason)
              return Promise.reject(new Error("source cancellation failed"))
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        )
      const model = await Provider.getModel(ProviderID.make("stream"), ModelID.make("test"))
      const language = await Provider.getLanguage(model)
      const output = await language.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
      })

      await expect(output.stream.pipeTo(new WritableStream())).rejects.toThrow("SSE read timed out")
      expect(reasons).toHaveLength(1)
      expect(reasons[0]).toMatchObject({ message: "SSE read timed out" })
    },
  })
})
