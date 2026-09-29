import { describe, expect, test } from "bun:test"
import { ACP } from "../../src/acp/agent"
import { AgentSideConnection, ClientSideConnection, ndJsonStream } from "@agentclientprotocol/sdk"
import type {
  Event,
  EventMessagePartUpdated,
  SessionMessageResponse,
  ToolStatePending,
  ToolStateRunning,
} from "@cyxcode/sdk/v2"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

type SessionUpdateParams = Parameters<AgentSideConnection["sessionUpdate"]>[0]
type RequestPermissionParams = Parameters<AgentSideConnection["requestPermission"]>[0]
type RequestPermissionResult = Awaited<ReturnType<AgentSideConnection["requestPermission"]>>

type GlobalEventEnvelope = {
  directory?: string
  payload?: Event
}

type EventController = {
  push: (event: GlobalEventEnvelope) => void
  close: () => void
}

function inProgressText(update: SessionUpdateParams["update"]) {
  if (update.sessionUpdate !== "tool_call_update") return undefined
  if (update.status !== "in_progress") return undefined
  if (!update.content || !Array.isArray(update.content)) return undefined
  const first = update.content[0]
  if (!first || first.type !== "content") return undefined
  if (first.content.type !== "text") return undefined
  return first.content.text
}

function isToolCallUpdate(
  update: SessionUpdateParams["update"],
): update is Extract<SessionUpdateParams["update"], { sessionUpdate: "tool_call_update" }> {
  return update.sessionUpdate === "tool_call_update"
}

function toolEvent(
  sessionId: string,
  cwd: string,
  opts: {
    callID: string
    tool: string
    input: Record<string, unknown>
  } & ({ status: "running"; metadata?: Record<string, unknown> } | { status: "pending"; raw: string }),
): GlobalEventEnvelope {
  const state: ToolStatePending | ToolStateRunning =
    opts.status === "running"
      ? {
          status: "running",
          input: opts.input,
          ...(opts.metadata && { metadata: opts.metadata }),
          time: { start: Date.now() },
        }
      : {
          status: "pending",
          input: opts.input,
          raw: opts.raw,
        }
  const payload: EventMessagePartUpdated = {
    type: "message.part.updated",
    properties: {
      part: {
        id: `part_${opts.callID}`,
        sessionID: sessionId,
        messageID: `msg_${opts.callID}`,
        type: "tool",
        callID: opts.callID,
        tool: opts.tool,
        state,
      },
    },
  }
  return { directory: cwd, payload }
}

function createEventStream() {
  const queue: GlobalEventEnvelope[] = []
  const waiters: Array<(value: GlobalEventEnvelope | undefined) => void> = []
  const state = { closed: false }

  const push = (event: GlobalEventEnvelope) => {
    const waiter = waiters.shift()
    if (waiter) {
      waiter(event)
      return
    }
    queue.push(event)
  }

  const close = () => {
    state.closed = true
    for (const waiter of waiters.splice(0)) {
      waiter(undefined)
    }
  }

  const stream = async function* (signal?: AbortSignal) {
    while (true) {
      if (signal?.aborted) return
      const next = queue.shift()
      if (next) {
        yield next
        continue
      }
      if (state.closed) return
      const value = await new Promise<GlobalEventEnvelope | undefined>((resolve) => {
        waiters.push(resolve)
        if (!signal) return
        signal.addEventListener("abort", () => resolve(undefined), { once: true })
      })
      if (!value) return
      yield value
    }
  }

  return { controller: { push, close } satisfies EventController, stream }
}

function createFakeAgent(history: SessionMessageResponse[] = [], remote?: AgentSideConnection) {
  const updates = new Map<string, string[]>()
  const chunks = new Map<string, string>()
  const sessionUpdates: SessionUpdateParams[] = []
  const record = (sessionId: string, type: string) => {
    const list = updates.get(sessionId) ?? []
    list.push(type)
    updates.set(sessionId, list)
  }

  const connection =
    remote ??
    ({
      async sessionUpdate(params: SessionUpdateParams) {
        sessionUpdates.push(params)
        const update = params.update
        const type = update?.sessionUpdate ?? "unknown"
        record(params.sessionId, type)
        if (update?.sessionUpdate === "agent_message_chunk") {
          const content = update.content
          if (content?.type !== "text") return
          if (typeof content.text !== "string") return
          chunks.set(params.sessionId, (chunks.get(params.sessionId) ?? "") + content.text)
        }
      },
      async requestPermission(_params: RequestPermissionParams): Promise<RequestPermissionResult> {
        return { outcome: { outcome: "selected", optionId: "once" } } as RequestPermissionResult
      },
    } as unknown as AgentSideConnection)

  const { controller, stream } = createEventStream()
  const calls = {
    eventSubscribe: 0,
    sessionCreate: 0,
  }
  const prompts: Array<{ model: { providerID: string; modelID: string }; variant?: string; agent?: string }> = []

  const sdk = {
    global: {
      event: async (opts?: { signal?: AbortSignal }) => {
        calls.eventSubscribe++
        return { stream: stream(opts?.signal) }
      },
    },
    session: {
      prompt: async (params: (typeof prompts)[number]) => {
        prompts.push(params)
        return { data: undefined }
      },
      create: async (_params?: any) => {
        calls.sessionCreate++
        return {
          data: {
            id: `ses_${calls.sessionCreate}`,
            time: { created: new Date().toISOString() },
          },
        }
      },
      get: async (_params?: any) => {
        return {
          data: {
            id: "ses_1",
            time: { created: new Date().toISOString() },
          },
        }
      },
      messages: async () => {
        return { data: history }
      },
      fork: async () => ({ data: { id: "ses_fork", time: { created: Date.now() } } }),
      message: async (params?: any) => {
        // Return a message with parts that can be looked up by partID
        return {
          data: {
            info: {
              role: "assistant",
            },
            parts: [
              {
                id: params?.messageID ? `${params.messageID}_part` : "part_1",
                type: "text",
                text: "",
              },
            ],
          },
        }
      },
    },
    permission: {
      respond: async () => {
        return { data: true }
      },
    },
    config: {
      providers: async () => {
        return {
          data: {
            providers: [
              {
                id: "opencode",
                name: "opencode",
                models: {
                  "big-pickle": { id: "big-pickle", name: "big-pickle" },
                  "reasoning-model": {
                    id: "reasoning-model",
                    name: "Reasoning model",
                    variants: { low: {}, high: {} },
                    limit: { context: 1000 },
                  },
                },
              },
            ],
          },
        }
      },
    },
    app: {
      agents: async () => {
        return {
          data: [
            {
              name: "build",
              description: "build",
              mode: "agent",
            },
            { name: "plan", description: "plan", mode: "agent" },
          ],
        }
      },
    },
    command: {
      list: async () => {
        return { data: [] }
      },
    },
    mcp: {
      add: async () => {
        return { data: true }
      },
    },
  } as any

  const agent = new ACP.Agent(connection, {
    sdk,
    defaultModel: { providerID: "opencode", modelID: "big-pickle" },
  } as any)

  const stop = () => {
    controller.close()
    ;(agent as any).eventAbort.abort()
  }

  return { agent, controller, calls, updates, chunks, sessionUpdates, stop, sdk, connection, prompts }
}

describe("acp.agent session restoration", () => {
  test("context usage includes cache writes", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const fixture = createFakeAgent([
          {
            info: {
              id: "msg_assistant",
              sessionID: "ses_1",
              role: "assistant",
              parentID: "msg_user",
              time: { created: Date.now() },
              modelID: "reasoning-model",
              providerID: "opencode",
              mode: "build",
              agent: "build",
              path: { cwd: tmp.path, root: tmp.path },
              cost: 0.25,
              tokens: { input: 100, output: 10, reasoning: 5, cache: { read: 200, write: 300 } },
            },
            parts: [],
          },
        ])
        try {
          await fixture.agent.unstable_resumeSession({ sessionId: "ses_1", cwd: tmp.path, mcpServers: [] })
          expect(fixture.sessionUpdates.find((item) => item.update.sessionUpdate === "usage_update")?.update).toEqual({
            sessionUpdate: "usage_update",
            used: 600,
            size: 1000,
            cost: { amount: 0.25, currency: "USD" },
          })
        } finally {
          fixture.stop()
        }
      },
    })
  })

  const message = (variant = "high", model = "reasoning-model", agent = "plan"): SessionMessageResponse => ({
    info: {
      id: "msg_saved",
      sessionID: "ses_1",
      role: "user",
      time: { created: Date.now() },
      agent,
      model: { providerID: "opencode", modelID: model },
      variant,
    },
    parts: [],
  })

  test.each(["load", "resume", "fork"])("%s restores model, variant and mode from history", async (action) => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const fixture = createFakeAgent([message()])
        try {
          const params = { sessionId: "ses_1", cwd: tmp.path, mcpServers: [] }
          const result = await (action === "load"
            ? fixture.agent.loadSession(params)
            : action === "fork"
              ? fixture.agent.unstable_forkSession(params)
              : fixture.agent.unstable_resumeSession(params))
          expect(result.models?.currentModelId).toBe("opencode/reasoning-model/high")
          expect(result.modes?.currentModeId).toBe("plan")
          expect(result.configOptions?.map((option) => [option.id, option.currentValue])).toEqual([
            ["model", "opencode/reasoning-model"],
            ["effort", "high"],
            ["mode", "plan"],
          ])
          expect(result._meta).toEqual({
            opencode: {
              modelId: "opencode/reasoning-model",
              variant: "high",
              availableVariants: ["low", "high"],
            },
          })
        } finally {
          fixture.stop()
        }
      },
    })
  })

  test.each(["unknown", "default"])("drops unavailable %s variant from metadata and model ID", async (variant) => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const fixture = createFakeAgent([message(variant)])
        try {
          const result = await fixture.agent.loadSession({ sessionId: "ses_1", cwd: tmp.path, mcpServers: [] })
          expect(result.models.currentModelId).toBe("opencode/reasoning-model")
          expect(result._meta.opencode.variant).toBeNull()
        } finally {
          fixture.stop()
        }
      },
    })
  })

  test("falls back when the historical model and mode are unavailable", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const fixture = createFakeAgent([message("high", "removed", "removed")])
        try {
          const result = await fixture.agent.loadSession({ sessionId: "ses_1", cwd: tmp.path, mcpServers: [] })
          expect(result.models.currentModelId).toBe("opencode/big-pickle")
          expect(result.modes?.currentModeId).toBe("build")
          expect(result._meta.opencode.variant).toBeNull()
          expect(result._meta.opencode.availableVariants).toEqual([])
        } finally {
          fixture.stop()
        }
      },
    })
  })

  test("retains live choices and explicit variant clearing across reload and resume", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const fixture = createFakeAgent([message()])
        try {
          const params = { sessionId: "ses_1", cwd: tmp.path, mcpServers: [] }
          await fixture.agent.loadSession(params)
          await fixture.agent.unstable_setSessionModel({
            sessionId: params.sessionId,
            modelId: "opencode/reasoning-model/low",
          })
          await fixture.agent.setSessionMode({ sessionId: params.sessionId, modeId: "build" })
          const resumed = await fixture.agent.unstable_resumeSession(params)
          expect(resumed.models?.currentModelId).toBe("opencode/reasoning-model/low")
          expect(resumed.modes?.currentModeId).toBe("build")
          await fixture.agent.unstable_setSessionModel({
            sessionId: params.sessionId,
            modelId: "opencode/reasoning-model",
          })
          const loaded = await fixture.agent.loadSession(params)
          expect(loaded.models.currentModelId).toBe("opencode/reasoning-model")
          expect(loaded._meta.opencode.variant).toBeNull()
        } finally {
          fixture.stop()
        }
      },
    })
  })
})

describe("acp.agent configuration options", () => {
  test("model and effort changes preserve explicit defaults and synchronize legacy selectors", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const fixture = createFakeAgent()
        try {
          const created = await fixture.agent.newSession({ cwd: tmp.path, mcpServers: [] })
          const sessionId = created.sessionId
          expect(created.configOptions.map((option) => option.id)).toEqual(["model", "mode"])
          const select = (configId: string, value: string) =>
            fixture.agent.setSessionConfigOption({ sessionId, configId, value })
          const selected = await select("model", "opencode/reasoning-model")
          expect(selected.configOptions.find((option) => option.id === "effort")).toMatchObject({
            currentValue: "default",
          })
          await select("effort", "high")
          await expect(select("effort", "unsupported")).rejects.toMatchObject({ code: -32602 })
          await expect(
            fixture.agent.unstable_setSessionModel({ sessionId, modelId: "opencode/removed" }),
          ).rejects.toMatchObject({ code: -32602 })
          const repeated = await select("model", "opencode/reasoning-model")
          expect(repeated.configOptions.find((option) => option.id === "effort")?.currentValue).toBe("high")
          await select("effort", "default")
          await select("mode", "plan")
          const loaded = await fixture.agent.loadSession({ sessionId, cwd: tmp.path, mcpServers: [] })
          expect(loaded.models.currentModelId).toBe("opencode/reasoning-model")
          expect(loaded._meta.opencode.variant).toBeNull()
          expect(loaded.modes?.currentModeId).toBe("plan")
          expect(loaded.configOptions.find((option) => option.id === "effort")?.currentValue).toBe("default")
          await fixture.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Check the selected options" }] })
          expect(fixture.prompts.at(-1)).toMatchObject({
            model: { providerID: "opencode", modelID: "reasoning-model" },
            agent: "plan",
            variant: undefined,
          })
          const other = await fixture.agent.newSession({ cwd: tmp.path, mcpServers: [] })
          expect(other.configOptions.map((option) => [option.id, option.currentValue])).toEqual([
            ["model", "opencode/big-pickle"],
            ["mode", "build"],
          ])

          await fixture.agent.unstable_setSessionModel({ sessionId, modelId: "opencode/reasoning-model/low" })
          expect(fixture.sessionUpdates.at(-1)?.update).toMatchObject({
            sessionUpdate: "config_option_update",
            configOptions: expect.arrayContaining([expect.objectContaining({ id: "effort", currentValue: "low" })]),
          })
          await fixture.agent.setSessionMode({ sessionId, modeId: "build" })
          expect(fixture.sessionUpdates.at(-1)?.update).toMatchObject({
            sessionUpdate: "config_option_update",
            configOptions: expect.arrayContaining([expect.objectContaining({ id: "mode", currentValue: "build" })]),
          })
          const plain = await select("model", "opencode/big-pickle")
          expect(plain.configOptions.some((option) => option.id === "effort")).toBe(false)
        } finally {
          fixture.stop()
        }
      },
    })
  })

  test.each([
    ["unknown", "value"],
    ["model", "missing/model"],
    ["model", "opencode/removed"],
    ["effort", "unsupported"],
    ["effort", "default"],
    ["mode", "removed"],
  ])("invalid option %s=%s leaves session state unchanged", async (configId, value) => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const fixture = createFakeAgent()
        try {
          const created = await fixture.agent.newSession({ cwd: tmp.path, mcpServers: [] })
          await expect(
            fixture.agent.setSessionConfigOption({ sessionId: created.sessionId, configId, value }),
          ).rejects.toMatchObject({ code: -32602 })
          const loaded = await fixture.agent.loadSession({
            sessionId: created.sessionId,
            cwd: tmp.path,
            mcpServers: [],
          })
          expect(loaded.configOptions).toEqual(created.configOptions)
          expect(fixture.sessionUpdates.some((item) => item.update.sessionUpdate === "config_option_update")).toBe(
            false,
          )
        } finally {
          fixture.stop()
        }
      },
    })
  })

  test("SDK routes configuration requests and notifications over JSON-RPC", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const input = Promise.withResolvers<TransformStreamDefaultController<Uint8Array>>()
        const output = Promise.withResolvers<TransformStreamDefaultController<Uint8Array>>()
        const left = new TransformStream<Uint8Array, Uint8Array>({ start: input.resolve })
        const right = new TransformStream<Uint8Array, Uint8Array>({ start: output.resolve })
        const updates: SessionUpdateParams[] = []
        const commands = Promise.withResolvers<void>()
        let fixture: ReturnType<typeof createFakeAgent> | undefined
        const backend = new AgentSideConnection(
          (connection) => {
            fixture = createFakeAgent([], connection)
            return fixture.agent
          },
          ndJsonStream(left.writable, right.readable),
        )
        const client = new ClientSideConnection(
          () => ({
            async requestPermission() {
              return { outcome: { outcome: "cancelled" as const } }
            },
            async sessionUpdate(update) {
              updates.push(update)
              if (update.update.sessionUpdate === "available_commands_update") commands.resolve()
            },
          }),
          ndJsonStream(right.writable, left.readable),
        )
        try {
          expect((await client.initialize({ protocolVersion: 1 })).agentInfo?.name).toBe("CyxCode")
          const created = await client.newSession({ cwd: tmp.path, mcpServers: [] })
          await commands.promise
          const selected = await client.setSessionConfigOption({
            sessionId: created.sessionId,
            configId: "model",
            value: "opencode/reasoning-model",
          })
          expect(selected.configOptions.find((option) => option.id === "effort")?.currentValue).toBe("default")
          const changed = await client.setSessionConfigOption({
            sessionId: created.sessionId,
            configId: "effort",
            value: "high",
          })
          expect(updates.at(-1)?.update).toEqual({
            sessionUpdate: "config_option_update",
            configOptions: changed.configOptions,
          })
        } finally {
          fixture?.stop()
          ;(await input.promise).terminate()
          ;(await output.promise).terminate()
          await Promise.all([client.closed, backend.closed])
        }
      },
    })
  })
})

describe("acp.agent event subscription", () => {
  test("routes message.part.delta by the event sessionID (no cross-session pollution)", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { agent, controller, updates, stop } = createFakeAgent()
        const cwd = "/tmp/opencode-acp-test"

        const sessionA = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)
        const sessionB = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)

        controller.push({
          directory: cwd,
          payload: {
            type: "message.part.delta",
            properties: {
              sessionID: sessionB,
              messageID: "msg_1",
              partID: "msg_1_part",
              field: "text",
              delta: "hello",
            },
          },
        } as any)

        await new Promise((r) => setTimeout(r, 10))

        expect((updates.get(sessionA) ?? []).includes("agent_message_chunk")).toBe(false)
        expect((updates.get(sessionB) ?? []).includes("agent_message_chunk")).toBe(true)

        stop()
      },
    })
  })

  test("keeps concurrent sessions isolated when message.part.delta events are interleaved", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { agent, controller, chunks, stop } = createFakeAgent()
        const cwd = "/tmp/opencode-acp-test"

        const sessionA = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)
        const sessionB = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)

        const tokenA = ["ALPHA_", "111", "_X"]
        const tokenB = ["BETA_", "222", "_Y"]

        const push = (sessionId: string, messageID: string, delta: string) => {
          controller.push({
            directory: cwd,
            payload: {
              type: "message.part.delta",
              properties: {
                sessionID: sessionId,
                messageID,
                partID: `${messageID}_part`,
                field: "text",
                delta,
              },
            },
          } as any)
        }

        push(sessionA, "msg_a", tokenA[0])
        push(sessionB, "msg_b", tokenB[0])
        push(sessionA, "msg_a", tokenA[1])
        push(sessionB, "msg_b", tokenB[1])
        push(sessionA, "msg_a", tokenA[2])
        push(sessionB, "msg_b", tokenB[2])

        await new Promise((r) => setTimeout(r, 20))

        const a = chunks.get(sessionA) ?? ""
        const b = chunks.get(sessionB) ?? ""

        expect(a).toContain(tokenA.join(""))
        expect(b).toContain(tokenB.join(""))
        for (const part of tokenB) expect(a).not.toContain(part)
        for (const part of tokenA) expect(b).not.toContain(part)

        stop()
      },
    })
  })

  test("does not create additional event subscriptions on repeated loadSession()", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { agent, calls, stop } = createFakeAgent()
        const cwd = "/tmp/opencode-acp-test"

        const sessionId = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)

        await agent.loadSession({ sessionId, cwd, mcpServers: [] } as any)
        await agent.loadSession({ sessionId, cwd, mcpServers: [] } as any)
        await agent.loadSession({ sessionId, cwd, mcpServers: [] } as any)
        await agent.loadSession({ sessionId, cwd, mcpServers: [] } as any)

        expect(calls.eventSubscribe).toBe(1)

        stop()
      },
    })
  })

  test("permission.asked events are handled and replied", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const permissionReplies: string[] = []
        const { agent, controller, stop, sdk } = createFakeAgent()
        sdk.permission.reply = async (params: any) => {
          permissionReplies.push(params.requestID)
          return { data: true }
        }
        const cwd = "/tmp/opencode-acp-test"

        const sessionA = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)

        controller.push({
          directory: cwd,
          payload: {
            type: "permission.asked",
            properties: {
              id: "perm_1",
              sessionID: sessionA,
              permission: "bash",
              patterns: ["*"],
              metadata: {},
              always: [],
            },
          },
        } as any)

        await new Promise((r) => setTimeout(r, 20))

        expect(permissionReplies).toContain("perm_1")

        stop()
      },
    })
  })

  test("permission prompt on session A does not block message updates for session B", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const permissionReplies: string[] = []
        let resolvePermissionA: (() => void) | undefined
        const permissionABlocking = new Promise<void>((r) => {
          resolvePermissionA = r
        })

        const { agent, controller, chunks, stop, sdk, connection } = createFakeAgent()

        // Make permission request for session A block until we release it
        const originalRequestPermission = connection.requestPermission.bind(connection)
        let permissionCalls = 0
        connection.requestPermission = async (params: RequestPermissionParams) => {
          permissionCalls++
          if (params.sessionId.endsWith("1")) {
            await permissionABlocking
          }
          return originalRequestPermission(params)
        }

        sdk.permission.reply = async (params: any) => {
          permissionReplies.push(params.requestID)
          return { data: true }
        }

        const cwd = "/tmp/opencode-acp-test"

        const sessionA = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)
        const sessionB = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)

        // Push permission.asked for session A (will block)
        controller.push({
          directory: cwd,
          payload: {
            type: "permission.asked",
            properties: {
              id: "perm_a",
              sessionID: sessionA,
              permission: "bash",
              patterns: ["*"],
              metadata: {},
              always: [],
            },
          },
        } as any)

        // Give time for permission handling to start
        await new Promise((r) => setTimeout(r, 10))

        // Push message for session B while A's permission is pending
        controller.push({
          directory: cwd,
          payload: {
            type: "message.part.delta",
            properties: {
              sessionID: sessionB,
              messageID: "msg_b",
              partID: "msg_b_part",
              field: "text",
              delta: "session_b_message",
            },
          },
        } as any)

        // Wait for session B's message to be processed
        await new Promise((r) => setTimeout(r, 20))

        // Session B should have received message even though A's permission is still pending
        expect(chunks.get(sessionB) ?? "").toContain("session_b_message")
        expect(permissionReplies).not.toContain("perm_a")

        // Release session A's permission
        resolvePermissionA!()
        await new Promise((r) => setTimeout(r, 20))

        // Now session A's permission should be replied
        expect(permissionReplies).toContain("perm_a")

        stop()
      },
    })
  })

  test("streams running bash output snapshots and de-dupes identical snapshots", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { agent, controller, sessionUpdates, stop } = createFakeAgent()
        const cwd = "/tmp/opencode-acp-test"
        const sessionId = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)
        const input = { command: "echo hello", description: "run command" }

        for (const output of ["a", "a", "ab"]) {
          controller.push(
            toolEvent(sessionId, cwd, {
              callID: "call_1",
              tool: "bash",
              status: "running",
              input,
              metadata: { output },
            }),
          )
        }
        await new Promise((r) => setTimeout(r, 20))

        const snapshots = sessionUpdates
          .filter((u) => u.sessionId === sessionId)
          .filter((u) => isToolCallUpdate(u.update))
          .map((u) => inProgressText(u.update))

        expect(snapshots).toEqual(["a", undefined, "ab"])
        stop()
      },
    })
  })

  test("emits synthetic pending before first running update for any tool", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { agent, controller, sessionUpdates, stop } = createFakeAgent()
        const cwd = "/tmp/opencode-acp-test"
        const sessionId = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)

        controller.push(
          toolEvent(sessionId, cwd, {
            callID: "call_bash",
            tool: "bash",
            status: "running",
            input: { command: "echo hi", description: "run command" },
            metadata: { output: "hi\n" },
          }),
        )
        controller.push(
          toolEvent(sessionId, cwd, {
            callID: "call_read",
            tool: "read",
            status: "running",
            input: { filePath: "/tmp/example.txt" },
          }),
        )
        await new Promise((r) => setTimeout(r, 20))

        const types = sessionUpdates
          .filter((u) => u.sessionId === sessionId)
          .map((u) => u.update.sessionUpdate)
          .filter((u) => u === "tool_call" || u === "tool_call_update")
        expect(types).toEqual(["tool_call", "tool_call_update", "tool_call", "tool_call_update"])

        const pendings = sessionUpdates.filter(
          (u) => u.sessionId === sessionId && u.update.sessionUpdate === "tool_call",
        )
        expect(pendings.every((p) => p.update.sessionUpdate === "tool_call" && p.update.status === "pending")).toBe(
          true,
        )
        stop()
      },
    })
  })

  test("does not emit duplicate synthetic pending after replayed running tool", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { agent, controller, sessionUpdates, stop, sdk } = createFakeAgent()
        const cwd = "/tmp/opencode-acp-test"
        const sessionId = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)
        const input = { command: "echo hi", description: "run command" }

        sdk.session.messages = async () => ({
          data: [
            {
              info: {
                role: "assistant",
                sessionID: sessionId,
              },
              parts: [
                {
                  type: "tool",
                  callID: "call_1",
                  tool: "bash",
                  state: {
                    status: "running",
                    input,
                    metadata: { output: "hi\n" },
                    time: { start: Date.now() },
                  },
                },
              ],
            },
          ],
        })

        await agent.loadSession({ sessionId, cwd, mcpServers: [] } as any)
        controller.push(
          toolEvent(sessionId, cwd, {
            callID: "call_1",
            tool: "bash",
            status: "running",
            input,
            metadata: { output: "hi\nthere\n" },
          }),
        )
        await new Promise((r) => setTimeout(r, 20))

        const types = sessionUpdates
          .filter((u) => u.sessionId === sessionId)
          .map((u) => u.update)
          .filter((u) => "toolCallId" in u && u.toolCallId === "call_1")
          .map((u) => u.sessionUpdate)
          .filter((u) => u === "tool_call" || u === "tool_call_update")

        expect(types).toEqual(["tool_call", "tool_call_update", "tool_call_update"])
        stop()
      },
    })
  })

  test("clears bash snapshot marker on pending state", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { agent, controller, sessionUpdates, stop } = createFakeAgent()
        const cwd = "/tmp/opencode-acp-test"
        const sessionId = await agent.newSession({ cwd, mcpServers: [] } as any).then((x) => x.sessionId)
        const input = { command: "echo hello", description: "run command" }

        controller.push(
          toolEvent(sessionId, cwd, {
            callID: "call_1",
            tool: "bash",
            status: "running",
            input,
            metadata: { output: "a" },
          }),
        )
        controller.push(
          toolEvent(sessionId, cwd, {
            callID: "call_1",
            tool: "bash",
            status: "pending",
            input,
            raw: '{"command":"echo hello"}',
          }),
        )
        controller.push(
          toolEvent(sessionId, cwd, {
            callID: "call_1",
            tool: "bash",
            status: "running",
            input,
            metadata: { output: "a" },
          }),
        )
        await new Promise((r) => setTimeout(r, 20))

        const snapshots = sessionUpdates
          .filter((u) => u.sessionId === sessionId)
          .filter((u) => isToolCallUpdate(u.update))
          .map((u) => inProgressText(u.update))

        expect(snapshots).toEqual(["a", "a"])
        stop()
      },
    })
  })
})
