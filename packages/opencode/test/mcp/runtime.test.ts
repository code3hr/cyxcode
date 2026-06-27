import { beforeEach, expect, mock, test } from "bun:test"
import type { Agent } from "../../src/agent/agent"

const defs = [
  {
    name: "tool",
    description: "Test tool",
    inputSchema: { type: "object", properties: {} },
  },
]
const resources = [
  { name: "same", uri: "file:///one.txt" },
  { name: "same", uri: "file:///two.txt" },
]
const templates = [{ name: "docs", uriTemplate: "file:///{name}.md" }]
const clients: MockClient[] = []
let output: unknown
let instructions = ""

class MockClient {
  onclose?: () => void

  async connect() {}

  async close() {}

  setNotificationHandler() {}

  async listTools() {
    return { tools: defs }
  }

  async callTool() {
    return output
  }

  async listResources() {
    return { resources }
  }

  async listResourceTemplates() {
    return { resourceTemplates: templates }
  }

  getInstructions() {
    return instructions
  }
}

mock.module("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class extends MockClient {
    constructor() {
      super()
      clients.push(this)
    }
  },
}))

mock.module("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: class {
    stderr = { on() {} }
  },
}))

beforeEach(() => {
  clients.length = 0
  output = {
    structuredContent: { ok: true },
    content: [{ type: "text", text: "fallback" }],
  }
  instructions = ""
})

const { MCP } = await import("../../src/mcp/index")
const { Instance } = await import("../../src/project/instance")
const { SystemPrompt } = await import("../../src/session/system")
const { tmpdir } = await import("../fixture/fixture")

test("returns structured MCP content as text", async () => {
  await using tmp = await tmpdir()

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await MCP.add("server.one", { type: "local", command: ["mock"] })

      const tools = await MCP.tools()
      const result = await tools.server_one_tool.execute!({}, undefined as never)

      expect(result).toEqual({
        structuredContent: { ok: true },
        content: [{ type: "text", text: '{"ok":true}' }],
      })
    },
  })
})

test("lists resource templates and keeps resource keys distinct by uri", async () => {
  await using tmp = await tmpdir()

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await MCP.add("server:one", { type: "local", command: ["mock"] })

      expect(Object.keys(await MCP.resources())).toEqual(["server%3Aone:file:///one.txt", "server%3Aone:file:///two.txt"])
      expect(await MCP.resourceTemplates()).toEqual({
        "server%3Aone:file:///{name}.md": {
          name: "docs",
          uriTemplate: "file:///{name}.md",
          client: "server:one",
        },
      })
    },
  })
})

test("injects MCP instructions when at least one server tool is allowed", async () => {
  await using tmp = await tmpdir()
  instructions = "Use server tools for docs."

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await MCP.add("server.one", { type: "local", command: ["mock"] })
      const agent = {
        name: "build",
        mode: "primary",
        options: {},
        permission: [],
      } satisfies Agent.Info

      expect(await SystemPrompt.mcp(agent)).toContain("Use server tools for docs.")
      expect(
        await SystemPrompt.mcp(agent, [{ permission: "server_one_tool", action: "deny", pattern: "*" }]),
      ).toBeUndefined()
    },
  })
})

test("clears closed MCP clients from active state", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        `${dir}/opencode.json`,
        JSON.stringify({
          $schema: "https://cyxcode.ai/config.json",
          mcp: {
            "server.one": {
              type: "local",
              command: ["mock"],
            },
          },
        }),
      )
    },
  })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await MCP.add("server.one", { type: "local", command: ["mock"] })
      expect(Object.keys(await MCP.tools())).toEqual(["server_one_tool"])

      clients.at(-1)?.onclose?.()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(Object.keys(await MCP.tools())).toEqual([])
      expect((await MCP.status())["server.one"]).toEqual({ status: "failed", error: "Connection closed" })
    },
  })
})
