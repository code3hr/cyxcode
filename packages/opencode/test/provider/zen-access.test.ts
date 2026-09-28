import { afterEach, beforeEach, expect, test } from "bun:test"
import { Auth } from "../../src/auth"
import { Env } from "../../src/env"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { tmpdir } from "../fixture/fixture"

const zen = ProviderID.make("opencode")

beforeEach(async () => {
  Env.remove("OPENCODE_API_KEY")
  await Auth.remove(zen)
})

afterEach(async () => {
  Env.remove("OPENCODE_API_KEY")
  await Auth.remove(zen)
})

test.each([false, true])("Zen without credentials is unavailable, configured: %s", async (configured) => {
  await using tmp = await tmpdir({
    config: { enabled_providers: [zen], ...(configured ? { provider: { opencode: {} } } : {}) },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      expect(Object.keys(await Provider.list())).toEqual([])
      await expect(Provider.getModel(zen, ModelID.make("big-pickle"))).rejects.toBeInstanceOf(
        Provider.ModelNotFoundError,
      )
      await expect(Provider.defaultModel()).rejects.toThrow("Connect a provider")
    },
  })
})

test.each(["env", "auth", "config"])("Zen rejects the public placeholder from %s", async (source) => {
  await using tmp = await tmpdir({
    config: {
      enabled_providers: [zen],
      ...(source === "config" ? { provider: { opencode: { options: { apiKey: "public" } } } } : {}),
    },
  })
  if (source === "env") Env.set("OPENCODE_API_KEY", "public")
  if (source === "auth") await Auth.set(zen, { type: "api", key: "public" })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => expect(Object.keys(await Provider.list())).toEqual([]),
  })
})

test.each(["env", "auth", "config"])("Zen preserves credentials from %s", async (source) => {
  await using tmp = await tmpdir({
    config: {
      enabled_providers: [zen],
      ...(source === "config" ? { provider: { opencode: { options: { apiKey: "test-key" } } } } : {}),
    },
  })
  if (source === "env") Env.set("OPENCODE_API_KEY", "test-key")
  if (source === "auth") await Auth.set(zen, { type: "api", key: "test-key" })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const provider = await Provider.getProvider(zen)
      expect(provider).toBeDefined()
      expect(provider.options.apiKey ?? provider.key).toBe("test-key")
      expect(Object.keys(provider.models).length).toBeGreaterThan(0)
      expect((await Provider.defaultModel()).providerID).toBe(zen)
    },
  })
})

test("Zen retains an explicitly configured custom endpoint without injecting public credentials", async () => {
  await using tmp = await tmpdir({
    config: {
      enabled_providers: [zen],
      provider: { opencode: { options: { baseURL: "http://127.0.0.1:1234/v1" } } },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const provider = await Provider.getProvider(zen)
      expect(provider.options.baseURL).toBe("http://127.0.0.1:1234/v1")
      expect(provider.options.apiKey).toBeUndefined()
    },
  })
})

test("an authenticated provider becomes the default instead of anonymous Zen", async () => {
  await using tmp = await tmpdir({
    config: {
      enabled_providers: [zen, "anthropic"],
      provider: { anthropic: { options: { apiKey: "test-key" } } },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      expect(Object.keys(await Provider.list())).not.toContain(zen)
      expect((await Provider.defaultModel()).providerID).toBe(ProviderID.anthropic)
    },
  })
})
