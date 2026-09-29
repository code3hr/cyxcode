import { afterEach, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { McpOAuthCallback } from "../../src/mcp/oauth-callback"
import { McpOAuthProvider, OAUTH_CALLBACK_PORT } from "../../src/mcp/oauth-provider"

afterEach(() => McpOAuthCallback.stop())

function port() {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
  const value = server.port!
  server.stop(true)
  return value
}

function callback(port: number, query: string) {
  return fetch(`http://127.0.0.1:${port}/mcp/oauth/callback?${query}`)
}

test.each([undefined, 1, 24567, 65535])("OAuth metadata uses callback port %s and CyxCode branding", (port) => {
  const cfg = Config.McpOAuth.parse({ callbackPort: port })
  const provider = new McpOAuthProvider("test", "https://example.com/mcp", cfg, { onRedirect() {} })
  expect(provider.redirectUrl).toBe(`http://127.0.0.1:${port ?? OAUTH_CALLBACK_PORT}/mcp/oauth/callback`)
  expect(provider.clientMetadata.redirect_uris).toEqual([provider.redirectUrl])
  expect(provider.clientMetadata.client_name).toBe("CyxCode")
})

test.each([0, -1, 65536, 1.5, "24567", null])("rejects invalid callback port %s", (port) => {
  expect(Config.McpOAuth.safeParse({ callbackPort: port }).success).toBe(false)
})

test("default callback listener completes authorization", async () => {
  await McpOAuthCallback.ensureRunning()
  const pending = McpOAuthCallback.waitForCallback("default")
  const response = await callback(OAUTH_CALLBACK_PORT, "state=default&code=accepted")
  expect(response.status).toBe(200)
  expect(await response.text()).toContain("return to CyxCode")
  expect(await pending).toBe("accepted")
})

test("independent ports isolate callback states and remain reusable", async () => {
  const first = port()
  await McpOAuthCallback.ensureRunning(first)
  const second = port()
  await McpOAuthCallback.ensureRunning(second)
  await McpOAuthCallback.ensureRunning(first)
  const left = McpOAuthCallback.waitForCallback("left", "first", first)
  const right = McpOAuthCallback.waitForCallback("right", "second", second)

  expect((await callback(second, "state=left&code=wrong-port")).status).toBe(400)
  expect((await callback(first, "code=missing-state")).status).toBe(400)
  expect((await callback(first, "state=unknown&code=unknown-state")).status).toBe(400)
  expect((await callback(first, "state=left")).status).toBe(400)
  expect((await fetch(`http://127.0.0.1:${first}/wrong-path`)).status).toBe(404)
  expect((await callback(first, "state=left&code=one")).status).toBe(200)
  expect(await left).toBe("one")
  expect(await McpOAuthCallback.isPortInUse(second)).toBe(true)
  expect((await callback(second, "state=right&code=two")).status).toBe(200)
  expect(await right).toBe("two")
})

test("OAuth errors are escaped and only reject the matching port", async () => {
  const first = port()
  await McpOAuthCallback.ensureRunning(first)
  const second = port()
  await McpOAuthCallback.ensureRunning(second)
  const pending = McpOAuthCallback.waitForCallback("error", "test", first).catch((err: unknown) => err)
  await callback(second, "state=error&error=wrong-port")
  const response = await callback(first, "state=error&error=denied&error_description=%3Cscript%3E")
  expect(await response.text()).toContain("&lt;script&gt;")
  expect(await pending).toEqual(new Error("<script>"))
})

test("a shared port remains open for its other pending authorization", async () => {
  const value = port()
  await McpOAuthCallback.ensureRunning(value)
  const first = McpOAuthCallback.waitForCallback("first", "first", value)
  const second = McpOAuthCallback.waitForCallback("second", "second", value)
  await callback(value, "state=first&code=one")
  expect(await first).toBe("one")
  await callback(value, "state=second&code=two")
  expect(await second).toBe("two")
})

test("cancelling by MCP name preserves another port's authorization", async () => {
  const first = port()
  await McpOAuthCallback.ensureRunning(first)
  const second = port()
  await McpOAuthCallback.ensureRunning(second)
  const cancelled = McpOAuthCallback.waitForCallback("cancel", "first", first).catch((err: unknown) => err)
  const pending = McpOAuthCallback.waitForCallback("keep", "second", second)
  McpOAuthCallback.cancelPending("first")
  expect(await cancelled).toEqual(new Error("Authorization cancelled"))
  expect((await callback(second, "state=keep&code=accepted")).status).toBe(200)
  expect(await pending).toBe("accepted")
})

test("shutdown rejects pending callbacks and releases every listener", async () => {
  const first = port()
  await McpOAuthCallback.ensureRunning(first)
  const second = port()
  await McpOAuthCallback.ensureRunning(second)
  const pending = [first, second].map((port) =>
    McpOAuthCallback.waitForCallback(String(port), "test", port).catch((err: unknown) => err),
  )
  await McpOAuthCallback.stop()
  expect(await Promise.all(pending)).toEqual([
    new Error("OAuth callback server stopped"),
    new Error("OAuth callback server stopped"),
  ])
  expect(McpOAuthCallback.isRunning()).toBe(false)
  expect(await McpOAuthCallback.isPortInUse(first)).toBe(false)
  expect(await McpOAuthCallback.isPortInUse(second)).toBe(false)
})

test("occupied ports fail without claiming another process's listener", async () => {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("occupied") })
  try {
    await expect(McpOAuthCallback.ensureRunning(server.port)).rejects.toThrow()
    expect(McpOAuthCallback.isRunning()).toBe(false)
    expect(await (await fetch(server.url)).text()).toBe("occupied")
  } finally {
    server.stop(true)
  }
})
