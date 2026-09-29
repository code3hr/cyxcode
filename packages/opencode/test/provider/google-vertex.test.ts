import { expect, spyOn, test } from "bun:test"
import { OAuth2Client } from "google-auth-library"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { Http } from "../../src/util/http"
import { tmpdir } from "../fixture/fixture"

test.each([
  ["global", "aiplatform.googleapis.com", undefined],
  ["us", "aiplatform.us.rep.googleapis.com", undefined],
  ["eu", "aiplatform.eu.rep.googleapis.com", undefined],
  ["us-central1", "us-central1-aiplatform.googleapis.com", undefined],
  ["europe-west4", "europe-west4-aiplatform.googleapis.com", undefined],
  ["eu", "proxy.example.invalid", "https://proxy.example.invalid/v1"],
])("Vertex SDK routes %s through %s", async (location, host, proxy) => {
  await using tmp = await tmpdir({
    config: {
      provider: {
        "google-vertex": {
          api: "https://${GOOGLE_VERTEX_ENDPOINT}/v1/projects/${GOOGLE_VERTEX_PROJECT}/locations/${GOOGLE_VERTEX_LOCATION}/publishers/google",
          models: { "gemini-2.5-flash": { name: "Gemini" } },
          options: { project: "test-project", location, ...(proxy && { baseURL: proxy }) },
        },
      },
    },
  })
  const requests: Request[] = []
  const fetcher = spyOn(Http, "fetch").mockImplementation(async (input, init) => {
    requests.push(new Request(input, init))
    return Response.json({
      candidates: [{ content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    })
  })
  try {
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const client = new OAuth2Client()
        client.setCredentials({ access_token: "test-vertex-token", expiry_date: Date.now() + 3600000 })
        const provider = await Provider.getProvider(ProviderID.make("google-vertex"))
        provider.options.googleAuthOptions = { authClient: client }
        const model = await Provider.getLanguage(
          await Provider.getModel(ProviderID.make("google-vertex"), ModelID.make("gemini-2.5-flash")),
        )
        const result = await model.doGenerate({
          prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
        })
        expect(result.content).toContainEqual({ type: "text", text: "ok" })
      },
    })
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0].url).host).toBe(host)
    expect(new URL(requests[0].url).pathname).toBe(
      `${proxy ? "/v1" : `/v1/projects/test-project/locations/${location}/publishers/google`}/models/gemini-2.5-flash:generateContent`,
    )
    expect(requests[0].headers.get("authorization")).toBe("Bearer test-vertex-token")
  } finally {
    fetcher.mockRestore()
  }
})
