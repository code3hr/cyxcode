import { Component, For, Show, createEffect, createMemo, createSignal } from "solid-js"
import { watchApi, type WatchAlert, type WatchEvent, type WatchPolicy, type WatchReport } from "../api/client"

type Period = "1h" | "1d" | "7d" | "30d" | "all"

const periods: Array<{ id: Period; label: string }> = [
  { id: "1h", label: "1h" },
  { id: "1d", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All" },
]

const decisions = ["all", "allow", "warn", "require-approval", "block"] as const
const actions = ["allow", "warn", "require-approval", "block"] as const
const groups = [
  { id: "all", label: "All events" },
  { id: "file", label: "Files" },
  { id: "shell", label: "Shell" },
  { id: "network", label: "Network" },
  { id: "memory", label: "Memory" },
  { id: "secret", label: "Secrets" },
  { id: "prompt", label: "Prompts" },
] as const

type Rule = WatchPolicy["rules"][number]
type Group = (typeof groups)[number]["id"]

const split = (text: string) =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

const join = (list?: string[]) => list?.join(", ") ?? ""

const num = (text: string) => {
  if (!text.trim()) return undefined
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

const label = (rule: Rule) => {
  const bytes = [
    rule.bytes_gt === undefined ? undefined : `bytes > ${rule.bytes_gt}`,
    rule.bytes_gte === undefined ? undefined : `bytes >= ${rule.bytes_gte}`,
    rule.bytes_lt === undefined ? undefined : `bytes < ${rule.bytes_lt}`,
    rule.bytes_lte === undefined ? undefined : `bytes <= ${rule.bytes_lte}`,
  ].filter((item): item is string => !!item)
  const text = rule.path?.join(", ")
    ?? rule.host?.join(", ")
    ?? rule.cmd?.join(", ")
    ?? rule.pattern?.join(", ")
    ?? rule.method?.join(", ")
    ?? bytes.join(", ")
  return text || "global match"
}

const Security: Component = () => {
  const [period, setPeriod] = createSignal<Period>("7d")
  const [report, setReport] = createSignal<WatchReport | null>(null)
  const [events, setEvents] = createSignal<WatchEvent[]>([])
  const [alerts, setAlerts] = createSignal<WatchAlert[]>([])
  const [policy, setPolicy] = createSignal<WatchPolicy | null>(null)
  const [draft, setDraft] = createSignal("")
  const [editing, setEditing] = createSignal<number | null>(null)
  const [ruleId, setRuleId] = createSignal("")
  const [desc, setDesc] = createSignal("")
  const [enabled, setEnabled] = createSignal(true)
  const [perm, setPerm] = createSignal("webfetch")
  const [pattern, setPattern] = createSignal("")
  const [path, setPath] = createSignal("")
  const [host, setHost] = createSignal("")
  const [cmd, setCmd] = createSignal("")
  const [method, setMethod] = createSignal("")
  const [bytesGt, setBytesGt] = createSignal("")
  const [bytesGte, setBytesGte] = createSignal("")
  const [bytesLt, setBytesLt] = createSignal("")
  const [bytesLte, setBytesLte] = createSignal("")
  const [risk, setRisk] = createSignal("")
  const [flags, setFlags] = createSignal("")
  const [decision, setDecision] = createSignal<Rule["decision"]>("warn")
  const [filter, setFilter] = createSignal<(typeof decisions)[number]>("all")
  const [group, setGroup] = createSignal<Group>("all")
  const [loading, setLoading] = createSignal(true)
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [msg, setMsg] = createSignal<string | null>(null)

  const sync = (cfg: WatchPolicy) => {
    setPolicy(cfg)
    setDraft(JSON.stringify(cfg, null, 2))
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    setMsg(null)

    const [rep, evt, alt, cfg] = await Promise.all([
      watchApi.report(period()),
      watchApi.recent(80),
      watchApi.alerts(40),
      watchApi.policy(),
    ])

    if (rep.error) setError(rep.error)
    if (evt.error) setError((prev) => prev ?? evt.error)
    if (alt.error) setError((prev) => prev ?? alt.error)
    if (cfg.error) setError((prev) => prev ?? cfg.error)

    if (rep.data) setReport(rep.data.report)
    if (evt.data) setEvents(evt.data.events)
    if (alt.data) setAlerts(alt.data.alerts)
    if (cfg.data) {
      sync(cfg.data.policy)
    }

    setLoading(false)
  }

  createEffect(() => {
    void load()
  })

  const rows = createMemo(() => {
    const match = (event: WatchEvent) => {
      if (group() === "all") return true
      if (group() === "file") return event.kind.startsWith("file.")
      if (group() === "network") return event.kind.startsWith("network.")
      if (group() === "memory") return event.kind.startsWith("memory.")
      if (group() === "secret") return event.kind === "output.secret"
      if (group() === "shell") return event.kind === "shell.command"
      return event.kind === "prompt.turn"
    }
    return events().filter((event) => match(event) && (filter() === "all" || (event.decision ?? "allow") === filter()))
  })

  const reset = () => {
    setEditing(null)
    setRuleId("")
    setDesc("")
    setEnabled(true)
    setPerm("webfetch")
    setPattern("")
    setPath("")
    setHost("")
    setCmd("")
    setMethod("")
    setBytesGt("")
    setBytesGte("")
    setBytesLt("")
    setBytesLte("")
    setRisk("")
    setFlags("")
    setDecision("warn")
  }

  const read = (rule: Rule, index: number) => {
    setEditing(index)
    setRuleId(rule.id ?? "")
    setDesc(rule.description ?? "")
    setEnabled(rule.enabled !== false)
    setPerm(join(rule.permission))
    setPattern(join(rule.pattern))
    setPath(join(rule.path))
    setHost(join(rule.host))
    setCmd(join(rule.cmd))
    setMethod(join(rule.method))
    setBytesGt(rule.bytes_gt === undefined ? "" : String(rule.bytes_gt))
    setBytesGte(rule.bytes_gte === undefined ? "" : String(rule.bytes_gte))
    setBytesLt(rule.bytes_lt === undefined ? "" : String(rule.bytes_lt))
    setBytesLte(rule.bytes_lte === undefined ? "" : String(rule.bytes_lte))
    setRisk(rule.risk === undefined ? "" : String(rule.risk))
    setFlags(join(rule.flags))
    setDecision(rule.decision)
  }

  const build = (): Rule => {
    const out: Rule = {
      decision: decision(),
    }
    if (ruleId().trim()) out.id = ruleId().trim()
    if (desc().trim()) out.description = desc().trim()
    if (!enabled()) out.enabled = false
    if (split(perm()).length > 0) out.permission = split(perm())
    if (split(pattern()).length > 0) out.pattern = split(pattern())
    if (split(path()).length > 0) out.path = split(path())
    if (split(host()).length > 0) out.host = split(host())
    if (split(cmd()).length > 0) out.cmd = split(cmd())
    if (split(method()).length > 0) out.method = split(method())
    if (num(bytesGt()) !== undefined) out.bytes_gt = num(bytesGt())
    if (num(bytesGte()) !== undefined) out.bytes_gte = num(bytesGte())
    if (num(bytesLt()) !== undefined) out.bytes_lt = num(bytesLt())
    if (num(bytesLte()) !== undefined) out.bytes_lte = num(bytesLte())
    if (num(risk()) !== undefined) out.risk = num(risk())
    if (split(flags()).length > 0) out.flags = split(flags())
    return out
  }

  const storeRule = () => {
    const cfg = policy() ?? { version: 2, rules: [] }
    const list = [...cfg.rules]
    const index = editing()
    if (index === null) list.push(build())
    else list[index] = build()
    sync({ version: 2, rules: list })
    reset()
  }

  const remove = (index: number) => {
    const cfg = policy()
    if (!cfg) return
    sync({ version: 2, rules: cfg.rules.filter((_, i) => i !== index) })
    reset()
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setMsg(null)

    const parsed = (() => {
      try {
        return JSON.parse(draft()) as WatchPolicy
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return undefined
      }
    })()

    if (!parsed) {
      setSaving(false)
      return
    }

    const res = await watchApi.savePolicy(parsed)
    if (res.error) {
      setError(res.error)
      setSaving(false)
      return
    }

    if (res.data) {
      sync(res.data.policy)
      setMsg("Policy saved")
    }
    setSaving(false)
  }

  const fmt = (n: number) => n.toLocaleString()
  const when = (ts: number) => new Date(ts).toLocaleString()
  const short = (text?: string) => {
    if (!text) return ""
    return text.length > 120 ? `${text.slice(0, 117)}...` : text
  }

  return (
    <div class="space-y-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">CyxWatch</h1>
          <p class="text-gray-400 mt-1">Runtime telemetry, policy decisions, and secret-leak signals</p>
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
          <button onClick={load} class="btn btn-secondary" disabled={loading()}>
            {loading() ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-950/60 border border-red-800 rounded p-3 text-sm text-red-200">{error()}</div>
      </Show>
      <Show when={msg()}>
        <div class="bg-cyan-950/50 border border-cyan-800 rounded p-3 text-sm text-cyan-200">{msg()}</div>
      </Show>

      <Show when={report()}>
        <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <Metric label="Events" value={fmt(report()!.total)} />
          <Metric label="Risk Score" value={fmt(report()!.risk)} tone="text-red-300" />
          <Metric label="Alerts" value={fmt(report()!.alerts)} tone="text-orange-300" />
          <Metric label="Network" value={fmt(report()!.network)} />
          <Metric label="Reads" value={fmt(report()!.read)} />
          <Metric label="Writes" value={fmt(report()!.write)} />
          <Metric label="Require" value={fmt(report()!.decisions.requireApproval)} tone="text-yellow-300" />
          <Metric label="Blocked" value={fmt(report()!.decisions.block)} tone="text-red-300" />
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section class="xl:col-span-8 card">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div class="card-header mb-0">Events</div>
                <div class="text-xs text-gray-500">{rows().length} visible of {events().length}</div>
              </div>
              <div class="flex flex-wrap gap-2">
                <select class="select text-sm" value={group()} onChange={(e) => setGroup(e.currentTarget.value as Group)}>
                  <For each={groups}>
                    {(item) => <option value={item.id}>{item.label}</option>}
                  </For>
                </select>
                <select class="select text-sm" value={filter()} onChange={(e) => setFilter(e.currentTarget.value as typeof filter extends () => infer T ? T : never)}>
                  <For each={decisions}>
                    {(item) => <option value={item}>{item === "all" ? "All decisions" : item}</option>}
                  </For>
                </select>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Kind</th>
                    <th>Decision</th>
                    <th>Risk</th>
                    <th>Target</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={rows()}>
                    {(event) => (
                      <tr>
                        <td class="whitespace-nowrap">{when(event.ts)}</td>
                        <td>{event.kind}</td>
                        <td><Decision value={event.decision ?? "allow"} /></td>
                        <td>{event.risk}</td>
                        <td class="max-w-md truncate" title={event.path ?? event.cmd ?? event.host ?? event.prompt ?? ""}>
                          {short(event.path ?? event.cmd ?? event.host ?? event.prompt)}
                        </td>
                        <td>
                          <div class="flex flex-wrap gap-1">
                            <For each={event.flags.slice(0, 3)}>
                              {(flag) => <span class="badge bg-gray-700 text-gray-300">{flag}</span>}
                            </For>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </section>

          <section class="xl:col-span-4 card">
            <div class="card-header">Alerts</div>
            <div class="space-y-3 max-h-[38rem] overflow-y-auto pr-1">
              <Show when={alerts().length > 0} fallback={<div class="text-sm text-gray-500">No alerts in this window.</div>}>
                <For each={alerts()}>
                  {(row) => (
                    <div class="rounded border border-gray-700 bg-gray-900 p-3">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="text-sm font-medium text-gray-100 truncate">{row.title}</div>
                          <div class="text-xs text-gray-500">{when(row.ts)}</div>
                        </div>
                        <Decision value={row.decision} />
                      </div>
                      <div class="mt-2 text-sm text-gray-400 break-words">{short(row.summary)}</div>
                      <div class="mt-2 flex flex-wrap gap-1">
                        <span class="badge bg-gray-700 text-gray-300">{row.kind}</span>
                        <For each={row.flags.slice(0, 2)}>
                          {(flag) => <span class="badge bg-gray-700 text-gray-300">{flag}</span>}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section class="xl:col-span-4 card">
            <div class="flex items-center justify-between gap-3 mb-4">
              <div>
                <div class="card-header mb-0">Policy Rules</div>
                <div class="text-xs text-gray-500">{policy()?.rules.length ?? 0} configured</div>
              </div>
              <button class="btn btn-secondary text-sm" onClick={reset}>
                New
              </button>
            </div>
            <div class="space-y-2">
              <Show when={policy()?.rules.length} fallback={<div class="text-sm text-gray-500">No project policy rules configured.</div>}>
                <For each={policy()?.rules ?? []}>
                  {(rule, index) => (
                    <div class={`rounded border p-3 ${editing() === index() ? "border-cyan-700 bg-cyan-950/20" : "border-gray-700 bg-gray-900"}`}>
                      <div class="flex items-center justify-between gap-3">
                        <div class="font-medium text-gray-100 truncate">{rule.id ?? rule.description ?? "rule"}</div>
                        <Decision value={rule.decision} />
                      </div>
                      <div class="mt-2 text-xs text-gray-500">{rule.permission?.join(", ") ?? "all permissions"}</div>
                      <div class="mt-2 text-sm text-gray-400 truncate">
                        {label(rule)}
                      </div>
                      <div class="mt-3 flex gap-2">
                        <button class="btn btn-secondary text-xs px-3 py-1" onClick={() => read(rule, index())}>
                          Edit
                        </button>
                        <button class="btn btn-danger text-xs px-3 py-1" onClick={() => remove(index())}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>

          <section class="xl:col-span-8 card">
            <div class="flex items-center justify-between gap-3 mb-4">
              <div>
                <div class="card-header mb-0">{editing() === null ? "Add Rule" : "Edit Rule"}</div>
                <div class="text-xs text-gray-500">Rules are saved locally under the project CyxWatch state directory</div>
              </div>
              <button class="btn btn-primary" onClick={save} disabled={saving()}>
                {saving() ? "Saving..." : "Save Policy"}
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label class="space-y-1">
                <div class="text-xs text-gray-500">ID</div>
                <input class="input w-full" value={ruleId()} onInput={(e) => setRuleId(e.currentTarget.value)} />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Decision</div>
                <select class="select w-full" value={decision()} onChange={(e) => setDecision(e.currentTarget.value as Rule["decision"])}>
                  <For each={actions}>
                    {(item) => <option value={item}>{item}</option>}
                  </For>
                </select>
              </label>
              <label class="space-y-1 md:col-span-2">
                <div class="text-xs text-gray-500">Description</div>
                <input class="input w-full" value={desc()} onInput={(e) => setDesc(e.currentTarget.value)} />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Permissions</div>
                <input class="input w-full" value={perm()} onInput={(e) => setPerm(e.currentTarget.value)} placeholder="webfetch, websocket" />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Host</div>
                <input class="input w-full" value={host()} onInput={(e) => setHost(e.currentTarget.value)} placeholder="example.com" />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Path</div>
                <input class="input w-full" value={path()} onInput={(e) => setPath(e.currentTarget.value)} placeholder="**/.env*" />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Command</div>
                <input class="input w-full" value={cmd()} onInput={(e) => setCmd(e.currentTarget.value)} placeholder="*printenv*" />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Pattern</div>
                <input class="input w-full" value={pattern()} onInput={(e) => setPattern(e.currentTarget.value)} />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Method</div>
                <input class="input w-full" value={method()} onInput={(e) => setMethod(e.currentTarget.value)} placeholder="POST, WEBSOCKET" />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Bytes greater than</div>
                <input class="input w-full" value={bytesGt()} onInput={(e) => setBytesGt(e.currentTarget.value)} inputmode="numeric" />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Bytes at least</div>
                <input class="input w-full" value={bytesGte()} onInput={(e) => setBytesGte(e.currentTarget.value)} inputmode="numeric" />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Bytes less than</div>
                <input class="input w-full" value={bytesLt()} onInput={(e) => setBytesLt(e.currentTarget.value)} inputmode="numeric" />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Bytes at most</div>
                <input class="input w-full" value={bytesLte()} onInput={(e) => setBytesLte(e.currentTarget.value)} inputmode="numeric" />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Risk</div>
                <input class="input w-full" value={risk()} onInput={(e) => setRisk(e.currentTarget.value)} inputmode="numeric" />
              </label>
              <label class="space-y-1">
                <div class="text-xs text-gray-500">Flags</div>
                <input class="input w-full" value={flags()} onInput={(e) => setFlags(e.currentTarget.value)} placeholder="large_upload, tracked_host" />
              </label>
              <label class="flex items-center gap-2 pt-6">
                <input type="checkbox" checked={enabled()} onChange={(e) => setEnabled(e.currentTarget.checked)} />
                <span class="text-sm text-gray-300">Enabled</span>
              </label>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button class="btn btn-primary" onClick={storeRule}>
                {editing() === null ? "Add Rule" : "Update Rule"}
              </button>
              <button class="btn btn-secondary" onClick={reset}>
                Clear
              </button>
            </div>

            <div class="mt-6">
              <div class="mb-2 text-sm font-medium text-gray-200">Raw Policy JSON</div>
            <textarea
              class="input w-full min-h-[24rem] font-mono text-xs leading-5"
              spellcheck={false}
              value={draft()}
              onInput={(e) => {
                setDraft(e.currentTarget.value)
                try {
                  setPolicy(JSON.parse(e.currentTarget.value) as WatchPolicy)
                } catch {}
              }}
            />
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

const Decision: Component<{ value: WatchEvent["decision"] }> = (props) => {
  const cls = () => {
    if (props.value === "block") return "bg-red-950 text-red-300 border-red-800"
    if (props.value === "require-approval") return "bg-yellow-950 text-yellow-300 border-yellow-800"
    if (props.value === "warn") return "bg-orange-950 text-orange-300 border-orange-800"
    return "bg-emerald-950 text-emerald-300 border-emerald-800"
  }

  return <span class={`inline-flex rounded border px-2 py-0.5 text-xs ${cls()}`}>{props.value}</span>
}

export default Security
