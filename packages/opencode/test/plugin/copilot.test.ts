import { expect, test } from "bun:test"
import type { Hooks, PluginInput } from "@cyxcode/plugin"
import { createOpencodeClient } from "@cyxcode/sdk"
import { CopilotAuthPlugin } from "../../src/plugin/copilot"

test.each(["root", "child", "compaction", "unavailable", "unrelated"])(
  "Copilot interaction ID preserves existing header behavior: %s",
  async (mode) => {
    const requests: string[] = []
    const client = createOpencodeClient({
      baseUrl: "https://example.invalid",
      fetch: Object.assign(
        async (input: RequestInfo | URL) => {
          const url = new URL(input instanceof Request ? input.url : String(input))
          requests.push(url.pathname)
          if (mode === "unavailable") return new Response("Unavailable", { status: 503 })
          if (url.pathname.endsWith("/message/msg-test")) {
            return Response.json({ parts: mode === "compaction" ? [{ type: "compaction" }] : [] })
          }
          return Response.json({ id: "session-test", ...(mode === "child" && { parentID: "parent-test" }) })
        },
        { preconnect: fetch.preconnect },
      ),
    })
    const hooks = await CopilotAuthPlugin({ client, directory: "/test" } as PluginInput)
    const output = { headers: { existing: "preserved" } as Record<string, string> }
    await hooks["chat.headers"]!(
      {
        sessionID: "session-test",
        model: {
          providerID: mode === "unrelated" ? "anthropic" : "github-copilot-enterprise",
          api: { npm: "@ai-sdk/anthropic" },
        },
        message: { sessionID: "session-test", id: "msg-test" },
      } as Parameters<NonNullable<Hooks["chat.headers"]>>[0],
      output,
    )
    expect(output.headers.existing).toBe("preserved")
    if (mode === "unrelated") {
      expect(output.headers).toEqual({ existing: "preserved" })
      expect(requests).toEqual([])
      return
    }
    expect(output.headers["X-Interaction-Id"]).toBe("session-test")
    expect(output.headers["anthropic-beta"]).toBe("interleaved-thinking-2025-05-14")
    if (mode === "child" || mode === "compaction") expect(output.headers["x-initiator"]).toBe("agent")
    if (mode !== "child" && mode !== "compaction") expect(output.headers["x-initiator"]).toBeUndefined()
    expect(requests).toEqual(
      mode === "compaction"
        ? ["/session/session-test/message/msg-test"]
        : ["/session/session-test/message/msg-test", "/session/session-test"],
    )
  },
)
