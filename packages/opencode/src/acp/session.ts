import { RequestError, type McpServer } from "@agentclientprotocol/sdk"
import type { ACPSessionState } from "./types"
import { Log } from "@/util/log"
import type { OpencodeClient } from "@cyxcode/sdk/v2"
import { ModelID, ProviderID } from "../provider/schema"

const log = Log.create({ service: "acp-session-manager" })

export class ACPSessionManager {
  private sessions = new Map<string, ACPSessionState>()
  private sdk: OpencodeClient

  constructor(sdk: OpencodeClient) {
    this.sdk = sdk
  }

  tryGet(sessionId: string): ACPSessionState | undefined {
    return this.sessions.get(sessionId)
  }

  async create(cwd: string, mcpServers: McpServer[], model?: ACPSessionState["model"]): Promise<ACPSessionState> {
    const session = await this.sdk.session
      .create(
        {
          directory: cwd,
        },
        { throwOnError: true },
      )
      .then((x) => x.data!)

    const sessionId = session.id
    const resolvedModel = model

    const state: ACPSessionState = {
      id: sessionId,
      cwd,
      mcpServers,
      createdAt: new Date(),
      model: resolvedModel,
    }
    log.info("creating_session", { state })

    this.sessions.set(sessionId, state)
    return state
  }

  async load(
    sessionId: string,
    cwd: string,
    mcpServers: McpServer[],
    model?: ACPSessionState["model"],
  ): Promise<ACPSessionState> {
    const session = await this.sdk.session
      .get(
        {
          sessionID: sessionId,
          directory: cwd,
        },
        { throwOnError: true },
      )
      .then((x) => x.data!)

    const previous = this.sessions.get(sessionId)
    const current = previous?.cwd === cwd ? previous : undefined
    const state: ACPSessionState = {
      id: sessionId,
      cwd,
      mcpServers,
      createdAt: new Date(session.time.created),
      model:
        current?.model ??
        (session.model
          ? { providerID: ProviderID.make(session.model.providerID), modelID: ModelID.make(session.model.id) }
          : model),
      variant: current?.model ? current.variant : session.model?.variant,
      modeId: current?.modeId ?? session.agent,
    }
    log.info("loading_session", { state })

    this.sessions.set(sessionId, state)
    return state
  }

  get(sessionId: string): ACPSessionState {
    const session = this.sessions.get(sessionId)
    if (!session) {
      log.error("session not found", { sessionId })
      throw RequestError.invalidParams(JSON.stringify({ error: `Session not found: ${sessionId}` }))
    }
    return session
  }

  async select(
    id: string,
    input: { model: NonNullable<ACPSessionState["model"]>; variant?: string } | { modeId: string },
  ) {
    const session = this.get(id)
    await this.sdk.session.update(
      {
        sessionID: id,
        directory: session.cwd,
        ...("modeId" in input
          ? { agent: input.modeId }
          : { model: { id: input.model.modelID, providerID: input.model.providerID, variant: input.variant } }),
      },
      { throwOnError: true },
    )
    Object.assign(session, "modeId" in input ? input : { model: input.model, variant: input.variant })
    return session
  }

  getModel(sessionId: string) {
    const session = this.get(sessionId)
    return session.model
  }

  setModel(sessionId: string, model: ACPSessionState["model"]) {
    const session = this.get(sessionId)
    session.model = model
    this.sessions.set(sessionId, session)
    return session
  }

  getVariant(sessionId: string) {
    const session = this.get(sessionId)
    return session.variant
  }

  setVariant(sessionId: string, variant?: string) {
    const session = this.get(sessionId)
    session.variant = variant
    this.sessions.set(sessionId, session)
    return session
  }

  setMode(sessionId: string, modeId: string) {
    const session = this.get(sessionId)
    session.modeId = modeId
    this.sessions.set(sessionId, session)
    return session
  }
}
