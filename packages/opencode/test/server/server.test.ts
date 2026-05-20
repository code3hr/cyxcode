import { describe, expect, test } from "bun:test"

process.env.CYXCODE_DISABLE_MODELS_FETCH = "1"

const { Server } = await import("../../src/server/server")

describe("server routes", () => {
  test("serves global health", async () => {
    const res = await Server.createApp({}).request("/global/health")
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ healthy: true })
  })

  test("does not proxy api-looking misses to the dashboard", async () => {
    const res = await Server.createApp({}).request("/api/missing")
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "API route not found" })
  })
})
