import { expect, test } from "bun:test"
import { Agent } from "../../src/agent/agent"
import { Bus } from "../../src/bus"
import { CyxWatch } from "../../src/cyxcode/watch"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionProcessor } from "../../src/session/processor"
import { MessageID } from "../../src/session/schema"
import { SessionStatus } from "../../src/session/status"
import { tmpdir } from "../fixture/fixture"

test.each([false, true])("session retries stop at the limit or cancellation (abort=%s)", async (abort) => {
  let requests = 0
  using server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      requests++
      // The fallback makes a broken, unlimited retry loop fail promptly.
      return Response.json(
        { error: { message: "test failure" } },
        {
          status: requests > 6 ? 400 : 503,
          headers: { "retry-after-ms": "0" },
        },
      )
    },
  })
  await using tmp = await tmpdir({
    config: {
      provider: {
        retry: {
          npm: "@ai-sdk/openai-compatible",
          api: `${server.url.origin}/v1`,
          models: { test: { name: "Test", limit: { context: 128000, output: 8192 } } },
          options: { apiKey: "test" },
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await CyxWatch.savePolicy({
        version: 2,
        rules: [{ permission: ["webfetch"], host: [server.url.host], decision: "allow" }],
      })
      const session = await Session.create({})
      const model = await Provider.getModel(ProviderID.make("retry"), ModelID.make("test"))
      const controller = new AbortController()
      const user: MessageV2.User = {
        id: MessageID.ascending(),
        sessionID: session.id,
        role: "user",
        agent: "build",
        model: { providerID: model.providerID, modelID: model.id },
        time: { created: Date.now() },
      }
      await Session.updateMessage(user)
      const processor = SessionProcessor.create({
        sessionID: session.id,
        model,
        abort: controller.signal,
        assistantMessage: {
          id: MessageID.ascending(),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          agent: "build",
          mode: "build",
          modelID: model.id,
          providerID: model.providerID,
          path: { cwd: tmp.path, root: tmp.path },
          time: { created: Date.now() },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        },
      })
      const attempts: number[] = []
      const unsubscribe = Bus.subscribe(SessionStatus.Event.Status, (event) => {
        if (event.properties.sessionID !== session.id || event.properties.status.type !== "retry") return
        attempts.push(event.properties.status.attempt)
        if (abort) controller.abort()
      })
      try {
        expect(
          await processor.process({
            user,
            sessionID: session.id,
            model,
            agent: await Agent.get("build"),
            abort: controller.signal,
            system: [],
            messages: [{ role: "user", content: "Hello" }],
            tools: {},
            retries: 0,
          }),
        ).toBe("stop")
        expect(processor.message.error).toMatchObject({ name: abort ? "MessageAbortedError" : "APIError" })
        expect(requests).toBe(abort ? 1 : 6)
        expect(attempts).toEqual(abort ? [1] : [1, 2, 3, 4, 5])
        expect(await SessionStatus.get(session.id)).toEqual({ type: "idle" })
        expect((await MessageV2.get({ sessionID: session.id, messageID: processor.message.id })).info).toMatchObject({
          error: { name: abort ? "MessageAbortedError" : "APIError" },
          time: { completed: expect.any(Number) },
        })
      } finally {
        unsubscribe()
        await Session.remove(session.id)
      }
    },
  })
})
