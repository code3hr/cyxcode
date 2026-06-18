import { test, expect } from "../fixtures"
import { withSession } from "../actions"

test("can send a prompt and receive a reply", async ({ sdk }) => {
  test.setTimeout(120_000)

  const token = `E2E_OK_${Date.now()}`

  await withSession(sdk, `e2e prompt ${Date.now()}`, async (session) => {
    await sdk.session.promptAsync({
      sessionID: session.id,
      parts: [{ type: "text", text: `Reply with exactly: ${token}` }],
    })

    await expect
      .poll(
        async () => {
          const messages = await sdk.session.messages({ sessionID: session.id, limit: 50 }).then((r) => r.data ?? [])
          return messages
            .filter((m) => m.info.role === "assistant")
            .flatMap((m) => m.parts)
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("\n")
        },
        { timeout: 90_000 },
      )
      .toContain(token)
  })
})
