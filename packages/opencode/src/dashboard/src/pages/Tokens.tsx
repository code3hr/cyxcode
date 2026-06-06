import { Component, For, Show, createEffect, createSignal } from "solid-js"
import { cyxApi, type AuditEntry, type TokenReport } from "../api/client"

type Period = "1h" | "1d" | "7d" | "30d" | "all"

const periods: Array<{ id: Period; label: string }> = [
  { id: "1h", label: "1h" },
  { id: "1d", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All" },
]

const Tokens: Component = () => {
  const [period, setPeriod] = createSignal<Period>("7d")
  const [report, setReport] = createSignal<TokenReport | null>(null)
  const [events, setEvents] = createSignal<AuditEntry[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)

    const [rep, audit] = await Promise.all([cyxApi.report(period()), cyxApi.audit(period(), 50)])
    if (rep.error) setError(rep.error)
    if (audit.error) setError((prev) => prev ?? audit.error)
    if (rep.data) setReport(rep.data.report)
    if (audit.data) setEvents(audit.data.entries)

    setLoading(false)
  }

  createEffect(() => {
    void load()
  })

  const num = (n: number) => n.toLocaleString()
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const usd = (n: number) => `$${n.toFixed(2)}`
  const time = (ts: number) => new Date(ts).toLocaleString()

  return (
    <div class="space-y-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Token Efficiency</h1>
          <p class="text-gray-400 mt-1">Pattern matches, misses, correction drift, and memory load savings</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex rounded border border-gray-700 overflow-hidden">
            <For each={periods}>
              {(item) => (
                <button
                  class={`px-3 py-2 text-sm border-r border-gray-700 last:border-r-0 ${
                    period() === item.id ? "bg-cyan-500/15 text-cyan-300" : "bg-gray-900 text-gray-400 hover:text-gray-100"
                  }`}
                  onClick={() => setPeriod(item.id)}
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>
          <button class="btn btn-secondary" onClick={load} disabled={loading()}>
            {loading() ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-950/60 border border-red-800 rounded p-3 text-sm text-red-200">{error()}</div>
      </Show>

      <Show when={report()}>
        <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <Metric label="Saved" value={num(report()!.tokens.saved)} tone="text-emerald-300" />
          <Metric label="Used" value={num(report()!.tokens.used)} />
          <Metric label="Efficiency" value={`${report()!.tokens.savingsPercent.toFixed(1)}%`} tone="text-cyan-300" />
          <Metric label="Cost Saved" value={usd(report()!.tokens.costSaved)} tone="text-emerald-300" />
          <Metric label="Matches" value={num(report()!.patterns.matches)} />
          <Metric label="Misses" value={num(report()!.patterns.misses)} tone="text-orange-300" />
          <Metric label="Learned" value={num(report()!.patterns.learned)} />
          <Metric label="Drift" value={num(report()!.corrections.driftEvents)} tone="text-red-300" />
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section class="xl:col-span-4 card">
            <div class="card-header">Pattern Health</div>
            <div class="space-y-4">
              <Bar label="Hit Rate" value={report()!.patterns.hitRate} />
              <Bar label="Correction Compliance" value={report()!.corrections.complianceRate} />
              <div class="grid grid-cols-2 gap-3">
                <Panel label="Corrections" value={num(report()!.corrections.added + report()!.corrections.reinforced)} />
                <Panel label="Promoted" value={num(report()!.corrections.promoted)} />
                <Panel label="Memory Loads" value={num(report()!.memory.loaded)} />
                <Panel label="Sessions" value={num(report()!.sessions)} />
              </div>
            </div>
          </section>

          <section class="xl:col-span-4 card">
            <div class="card-header">Top Patterns</div>
            <div class="space-y-2">
              <Show when={report()!.patterns.top.length > 0} fallback={<div class="text-sm text-gray-500">No pattern matches recorded in this period.</div>}>
                <For each={report()!.patterns.top}>
                  {(item) => (
                    <div class="rounded border border-gray-700 bg-gray-900 p-3">
                      <div class="flex items-center justify-between gap-3">
                        <div class="font-medium text-gray-100 truncate">{item.id}</div>
                        <div class="text-sm text-emerald-300">{num(item.tokensSaved)}</div>
                      </div>
                      <div class="mt-2 text-xs text-gray-500">{item.matches} matches</div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>

          <section class="xl:col-span-4 card">
            <div class="card-header">Recent Audit Events</div>
            <div class="space-y-2 max-h-[30rem] overflow-y-auto pr-1">
              <Show when={events().length > 0} fallback={<div class="text-sm text-gray-500">No CyxCode audit events recorded yet.</div>}>
                <For each={events()}>
                  {(event) => (
                    <div class="rounded border border-gray-700 bg-gray-900 p-3">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="text-sm font-medium text-gray-100 truncate">{event.type.replace("cyxcode.", "")}</div>
                          <div class="text-xs text-gray-500">{time(event.timestamp)}</div>
                        </div>
                        <span class={`badge ${tone(event.type)}`}>{kind(event.type)}</span>
                      </div>
                      <div class="mt-2 text-sm text-gray-400 truncate">{summary(event)}</div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>
        </div>
      </Show>
    </div>
  )
}

const Metric: Component<{ label: string; value: string; tone?: string }> = (props) => (
  <div class="stat-card">
    <div class={`stat-value ${props.tone ?? ""}`}>{props.value}</div>
    <div class="stat-label">{props.label}</div>
  </div>
)

const Panel: Component<{ label: string; value: string }> = (props) => (
  <div class="rounded border border-gray-700 bg-gray-900 p-3">
    <div class="text-lg font-semibold text-gray-100">{props.value}</div>
    <div class="text-xs text-gray-500">{props.label}</div>
  </div>
)

const Bar: Component<{ label: string; value: number }> = (props) => (
  <div>
    <div class="mb-2 flex items-center justify-between text-sm">
      <span class="text-gray-400">{props.label}</span>
      <span class="text-gray-100">{pct(props.value)}</span>
    </div>
    <div class="h-2 rounded bg-gray-900 overflow-hidden">
      <div class="h-full bg-cyan-500" style={{ width: `${Math.max(0, Math.min(1, props.value)) * 100}%` }} />
    </div>
  </div>
)

function kind(type: string) {
  if (type.includes("pattern")) return "pattern"
  if (type.includes("correction")) return "correction"
  if (type.includes("drift")) return "drift"
  if (type.includes("memory")) return "memory"
  if (type.includes("session")) return "session"
  return "event"
}

function tone(type: string) {
  if (type.includes("match")) return "bg-emerald-950 text-emerald-300"
  if (type.includes("miss")) return "bg-orange-950 text-orange-300"
  if (type.includes("drift")) return "bg-red-950 text-red-300"
  if (type.includes("memory")) return "bg-cyan-950 text-cyan-300"
  return "bg-gray-700 text-gray-300"
}

function summary(event: AuditEntry) {
  if (event.data.patternId) return event.data.patternId
  if (event.data.rule) return event.data.rule
  if (event.data.tokensSaved) return `${event.data.tokensSaved.toLocaleString()} tokens saved`
  if (event.data.tokensUsed) return `${event.data.tokensUsed.toLocaleString()} tokens used`
  if (event.data.tags) return event.data.tags.join(", ")
  if (event.data.message) return event.data.message
  return ""
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

export default Tokens
