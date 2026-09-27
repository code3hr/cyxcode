import { expect, test } from "bun:test"
import { redactConfig } from "../../src/cli/cmd/debug/redact"

test("masks nested credentials in debug config without changing the resolved config", () => {
  const config = {
    provider: {
      example: { options: { apiKey: "sk-example", headers: { Authorization: "Bearer example" } } },
    },
    mcp: {
      remote: { oauth: { clientSecret: "oauth-secret", clientId: "public" } },
      local: { environment: { SERVICE_TOKEN: "env-secret", PATH: "/usr/bin" } },
    },
    endpoint: "https://user:pass@example.com/path",
    normal: { context_tokens: 200_000, name: "example" },
  }
  const before = structuredClone(config)

  expect(redactConfig(config)).toEqual({
    provider: {
      example: { options: { apiKey: "***", headers: { Authorization: "***" } } },
    },
    mcp: {
      remote: { oauth: { clientSecret: "***", clientId: "public" } },
      local: { environment: { SERVICE_TOKEN: "***", PATH: "/usr/bin" } },
    },
    endpoint: "***",
    normal: config.normal,
  })
  expect(config).toEqual(before)
})
