import { Button } from "@cyxcode/ui/button"
import { createEffect, createSignal, Show } from "solid-js"
import { useServer } from "@/context/server"
import { reportsApi, type Report } from "@/utils/dashboard-api"

export default function Reports() {
  const server = useServer()
  const [type, setType] = createSignal<"executive" | "technical" | "compliance">("executive")
  const [framework, setFramework] = createSignal<"pci-dss" | "hipaa" | "soc2">("pci-dss")
  const [report, setReport] = createSignal<Report | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const run = async () => {
    const cur = server.current?.http.url
    if (!cur) {
      setError("No server connected")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await reportsApi.generate(server, {
        type: type(),
        framework: type() === "compliance" ? framework() : undefined,
      })
      setReport(result.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    const cur = server.current?.http.url
    type()
    framework()
    if (!cur) return
    void run()
  })

  const text = () => {
    const row = report()
    if (!row) return ""
    return JSON.stringify(row, null, 2)
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Reports</h1>
          <p class="text-gray-400 mt-1">Generate security assessment reports</p>
        </div>
        <Button onClick={run} disabled={loading()}>
          Generate
        </Button>
      </div>

      <Show when={error()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">{error()}</div>
      </Show>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card space-y-4">
          <div class="card-header">Report Type</div>
          <div class="flex gap-2">
            <button classList={{ "btn btn-secondary": true, "ring-2 ring-blue-500": type() === "executive" }} onClick={() => setType("executive")}>
              Executive
            </button>
            <button classList={{ "btn btn-secondary": true, "ring-2 ring-blue-500": type() === "technical" }} onClick={() => setType("technical")}>
              Technical
            </button>
            <button classList={{ "btn btn-secondary": true, "ring-2 ring-blue-500": type() === "compliance" }} onClick={() => setType("compliance")}>
              Compliance
            </button>
          </div>

          <Show when={type() === "compliance"}>
            <div class="space-y-2">
              <div class="text-sm text-gray-400">Framework</div>
              <select
                value={framework()}
                onChange={(e) => setFramework(e.currentTarget.value as typeof framework extends () => infer T ? T : never)}
                class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 w-full"
              >
                <option value="pci-dss">PCI-DSS</option>
                <option value="hipaa">HIPAA</option>
                <option value="soc2">SOC2</option>
              </select>
            </div>
          </Show>

          <Button onClick={run} disabled={loading()} class="w-full">
            {loading() ? "Generating..." : "Generate Report"}
          </Button>
        </div>

        <div class="card">
          <div class="card-header">Preview</div>
          <Show when={report()} fallback={<div class="text-sm text-gray-400">Generate a report to see the preview.</div>}>
            <pre class="text-xs text-gray-200 overflow-auto max-h-[40rem] whitespace-pre-wrap">{text()}</pre>
          </Show>
        </div>
      </div>
    </div>
  )
}
