import { expect, spyOn, test } from "bun:test"
import { setTimeout as sleep } from "node:timers/promises"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ProviderError } from "../../src/provider/error"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionRetry } from "../../src/session/retry"
import { tmpdir } from "../fixture/fixture"

const prompt = [{ role: "user" as const, content: [{ type: "text" as const, text: "hello" }] }]
const sse = { "content-type": "text/event-stream" }

async function fixture(
  options: NonNullable<Config.Provider["options"]>,
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: (model: Awaited<ReturnType<typeof Provider.getLanguage>>) => Promise<void>,
) {
  await using tmp = await tmpdir({
    config: {
      provider: {
        stream: {
          npm: "@ai-sdk/openai-compatible",
          api: "https://example.invalid/v1",
          models: { test: { name: "Test" } },
          options: { apiKey: "test", ...options },
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const provider = await Provider.getProvider(ProviderID.make("stream"))
      provider.options.fetch = fetcher
      await run(await Provider.getLanguage(await Provider.getModel(ProviderID.make("stream"), ModelID.make("test"))))
    },
  })
}

test.each([{ headerTimeout: 20 }, { timeout: false, headerTimeout: 20 }])(
  "explicit header timeout aborts and is retryable: %j",
  async (options) => {
    let reason: unknown
    await fixture(
      options,
      async (_input, init) => {
        return new Promise<Response>((_resolve, reject) => {
          init!.signal!.addEventListener(
            "abort",
            () => {
              reason = init!.signal!.reason
              reject(reason)
            },
            { once: true },
          )
        })
      },
      async (model) => {
        await expect(model.doStream({ prompt })).rejects.toThrow("Provider response headers timed out")
      },
    )
    expect(reason).toBeInstanceOf(ProviderError.HeaderTimeoutError)
    const error = MessageV2.fromError(reason, { providerID: ProviderID.make("stream") })
    expect(error).toMatchObject({ name: "APIError", data: { isRetryable: true } })
    expect(SessionRetry.retryable(error)).toContain("headers timed out")
  },
)

test("header timer stops when headers arrive while the body continues streaming", async () => {
  let signal: AbortSignal | null | undefined
  await fixture(
    { headerTimeout: 20, chunkTimeout: 500 },
    async (_input, init) => {
      signal = init?.signal
      return new Response(
        new ReadableStream<Uint8Array>({
          async start(controller) {
            await sleep(60)
            controller.enqueue(
              new TextEncoder().encode('data: {"choices":[{"index":0,"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'),
            )
            controller.close()
          },
        }),
        { headers: sse },
      )
    },
    async (model) => {
      const output = await model.doStream({ prompt })
      const parts: unknown[] = []
      await output.stream.pipeTo(
        new WritableStream({
          write(part) {
            parts.push(part)
          },
        }),
      )
      expect(parts).toContainEqual(expect.objectContaining({ type: "text-delta", delta: "ok" }))
      expect(signal?.aborted).toBe(false)
    },
  )
})

test("header timer is cleared when custom fetch throws synchronously", async () => {
  let signal: AbortSignal | null | undefined
  await fixture(
    { headerTimeout: 20 },
    (_input, init) => {
      signal = init?.signal
      throw new Error("test transport failure")
    },
    async (model) => {
      await expect(model.doStream({ prompt })).rejects.toThrow("test transport failure")
      await sleep(50)
      expect(signal?.aborted).toBe(false)
    },
  )
})

test.each([{ timeout: false }, { headerTimeout: false, chunkTimeout: false }])(
  "disabled timers preserve a pending stream: %j",
  async (options) => {
    let signal: AbortSignal | null | undefined
    await fixture(
      options,
      async (_input, init) => {
        signal = init?.signal
        await sleep(30)
        return new Response("data: [DONE]\n\n", { headers: sse })
      },
      async (model) => {
        using timer = spyOn(globalThis, "setTimeout")
        const output = await model.doStream({ prompt })
        await output.stream.pipeTo(new WritableStream())
        expect(signal?.aborted ?? false).toBe(false)
        expect(timer.mock.calls.map((call) => call[1])).not.toContain(300_000)
      },
    )
  },
)

test("caller cancellation remains effective with header timeout disabled", async () => {
  const controller = new AbortController()
  await fixture(
    { headerTimeout: false },
    async (_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true })
        controller.abort()
      })
    },
    async (model) => {
      await expect(model.doStream({ prompt, abortSignal: controller.signal })).rejects.toMatchObject({
        name: "AbortError",
      })
    },
  )
})

test("explicit total timeout remains effective with phase timers disabled", async () => {
  using server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      await sleep(150)
      return new Response("data: [DONE]\n\n", { headers: sse })
    },
  })
  await fixture(
    { timeout: 20, headerTimeout: false, chunkTimeout: false },
    async (_input, init) => fetch(server.url, init),
    async (model) => {
      await expect(model.doStream({ prompt })).rejects.toThrow()
    },
  )
})

test("default header and chunk timers are five minutes", async () => {
  await fixture(
    {},
    async () => new Response(new ReadableStream(), { headers: sse }),
    async (model) => {
      const original = globalThis.setTimeout
      const delays: (number | undefined)[] = []
      using timer = spyOn(globalThis, "setTimeout").mockImplementation(
        new Proxy(original, {
          apply(target, receiver, args: unknown[]) {
            delays.push(args[1] as number | undefined)
            if (args[1] === 300_000) args[1] = 20
            return Reflect.apply(target, receiver, args)
          },
        }),
      )
      const output = await model.doStream({ prompt })
      await expect(output.stream.pipeTo(new WritableStream())).rejects.toThrow("SSE read timed out")
      expect(delays.filter((ms) => ms === 300_000)).toHaveLength(2)
    },
  )
})

test.each(["headerTimeout", "chunkTimeout"])("validates %s config values", (key) => {
  for (const value of [false, 20]) expect(Config.Provider.safeParse({ options: { [key]: value } }).success).toBe(true)
  for (const value of [0, -1, 1.5, "20"])
    expect(Config.Provider.safeParse({ options: { [key]: value } }).success).toBe(false)
})
