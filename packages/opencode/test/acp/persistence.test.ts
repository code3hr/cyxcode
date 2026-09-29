import { expect, test } from "bun:test"
import { createOpencodeClient } from "@cyxcode/sdk/v2"
import { ACPSessionManager } from "../../src/acp/session"
import { Instance } from "../../src/project/instance"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { SessionID } from "../../src/session/schema"
import { SessionPrompt } from "../../src/session/prompt"
import { Database } from "../../src/storage/db"
import { tmpdir } from "../fixture/fixture"

test("ACP selections persist through the real SDK, API, database reopen, and fork", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const sdk = createOpencodeClient({
        baseUrl: "http://localhost",
        fetch: Object.assign(async (request: RequestInfo | URL) => Server.Default().request(request), {
          preconnect: fetch.preconnect,
        }),
      })
      const first = new ACPSessionManager(sdk)
      const session = await first.create(tmp.path, [])
      const id = SessionID.make(session.id)
      const model = { providerID: ProviderID.make("custom"), modelID: ModelID.make("model") }
      await first.select(session.id, { model, variant: "high" })
      await first.select(session.id, { modeId: "plan" })
      Database.close()
      const next = new ACPSessionManager(sdk)
      expect(await next.load(session.id, tmp.path, [])).toMatchObject({ model, variant: "high", modeId: "plan" })

      await next.select(session.id, { model })
      expect(next.get(session.id).variant).toBeUndefined()
      const cleared = await new ACPSessionManager(sdk).load(session.id, tmp.path, [])
      expect(cleared.variant).toBeUndefined()
      expect(cleared.model).toEqual(model)
      const fork = await Session.fork({ sessionID: id })
      expect(fork.model).toEqual({ id: "model", providerID: "custom" })
      expect(fork.agent).toBe("plan")
      await sdk.session.update({ sessionID: session.id, directory: tmp.path, title: "Renamed" }, { throwOnError: true })
      expect((await Session.get(id)).model).toEqual(fork.model)
      expect((await Session.get(id)).agent).toBe("plan")

      const other = await first.create(tmp.path, [])
      expect((await new ACPSessionManager(sdk).load(other.id, tmp.path, [])).model).toBeUndefined()
      await Session.remove(SessionID.make(other.id))
      await Session.remove(fork.id)
      await Session.remove(id)
      await expect(next.select(session.id, { modeId: "build" })).rejects.toBeDefined()
      expect(next.get(session.id).modeId).toBe("plan")
    },
  })
})

test("session selection API rejects malformed writes without changing durable choices", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const session = await Session.create({})
      await Session.select({
        sessionID: session.id,
        agent: "plan",
        model: { id: "model", providerID: "custom", variant: "high" },
      })
      for (const body of [{ agent: "" }, { model: { id: "model" } }, { model: { id: "", providerID: "custom" } }]) {
        const response = await Server.Default().request(`/session/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        expect(response.status).toBe(400)
      }
      expect(await Session.get(session.id)).toMatchObject({
        agent: "plan",
        model: { id: "model", providerID: "custom", variant: "high" },
      })
      await Session.remove(session.id)
    },
  })
})

test("a prompt replaces older durable selections with its actual model and agent", async () => {
  await using tmp = await tmpdir({ config: { provider: { openai: { options: { apiKey: "test-key" } } } } })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const session = await Session.create({})
      await Session.select({
        sessionID: session.id,
        agent: "build",
        model: { id: "old", providerID: "custom", variant: "high" },
      })
      await SessionPrompt.prompt({
        sessionID: session.id,
        agent: "plan",
        model: { providerID: ProviderID.make("openai"), modelID: ModelID.make("gpt-5.2") },
        noReply: true,
        parts: [{ type: "text", text: "Remember these selections without generating a reply." }],
      })
      expect(await Session.get(session.id)).toMatchObject({
        agent: "plan",
        model: { id: "gpt-5.2", providerID: "openai" },
      })
      expect((await Session.get(session.id)).model?.variant).toBeUndefined()
      await Session.remove(session.id)
    },
  })
})
