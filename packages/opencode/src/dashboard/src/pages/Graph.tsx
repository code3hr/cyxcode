import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { A, useSearchParams } from "@solidjs/router"
import { graphApi, type GraphData, type GraphEdge, type GraphNode } from "../api/client"

type Pos = {
  id: string
  x: number
  y: number
  r: number
  act: boolean
  hit: boolean
  kind: GraphNode["kind"]
  title: string
  path?: string
  deg: number
  hop: number
}

type Ed = GraphEdge & {
  a: Pos
  b: Pos
  on: boolean
}

type View = {
  nodes: Pos[]
  edges: Ed[]
  act: string
}

const kinds: GraphNode["kind"][] = ["wiki", "code", "symbol", "memory", "learned", "concept"]

const colors: Record<GraphNode["kind"], { fill: string; stroke: string; glow: string }> = {
  wiki: { fill: "#1d4ed8", stroke: "#60a5fa", glow: "rgba(37,99,235,0.18)" },
  code: { fill: "#0f766e", stroke: "#5eead4", glow: "rgba(15,118,110,0.16)" },
  symbol: { fill: "#4c1d95", stroke: "#c084fc", glow: "rgba(76,29,149,0.16)" },
  memory: { fill: "#92400e", stroke: "#fbbf24", glow: "rgba(146,64,14,0.16)" },
  learned: { fill: "#7c2d12", stroke: "#fb7185", glow: "rgba(124,45,18,0.16)" },
  concept: { fill: "#334155", stroke: "#64748b", glow: "rgba(51,65,85,0.16)" },
}

function deg(id: string, edges: GraphEdge[]) {
  let n = 0
  for (const edge of edges) {
    if (edge.from === id || edge.to === id) n++
  }
  return n
}

function place(
  ids: string[],
  gap: number,
  cx: number,
  cy: number,
  map: Map<string, GraphNode>,
  sel: string,
  edges: GraphEdge[],
  hit: Set<string>,
  hop: number,
) {
  const out: Pos[] = []
  const step = (Math.PI * 2) / Math.max(1, ids.length)
  const start = -Math.PI / 2

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!
    const node = map.get(id)
    if (!node) continue

    const ang = start + step * i
    out.push({
      id,
      x: cx + Math.cos(ang) * gap,
      y: cy + Math.sin(ang) * gap,
      r: id === sel ? 20 : 12,
      act: id === sel,
      hit: hit.has(id),
      kind: node.kind,
      title: node.title,
      path: node.path,
      deg: deg(id, edges),
      hop,
    })
  }

  return out
}

function layout(data: GraphData, sel: string, q: string, allow: Set<GraphNode["kind"]>, hop: number): View {
  const nodes = data.nodes.filter((node) => allow.has(node.kind))
  const map = new Map(nodes.map((node) => [node.id, node]))
  const low = q.toLowerCase()
  const hit = new Set(
    nodes
      .filter((node) => {
        if (!low) return true
        const meta = node.meta ? JSON.stringify(node.meta) : ""
        return (
          node.title.toLowerCase().includes(low) ||
          node.id.toLowerCase().includes(low) ||
          (node.path ?? "").toLowerCase().includes(low) ||
          (node.summary ?? "").toLowerCase().includes(low) ||
          (node.tags ?? []).some((tag) => tag.includes(low)) ||
          meta.toLowerCase().includes(low)
        )
      })
      .map((node) => node.id),
  )

  const adj = new Map<string, Set<string>>()
  for (const edge of data.edges) {
    if (!map.has(edge.from) || !map.has(edge.to)) continue
    const a = adj.get(edge.from) ?? new Set<string>()
    a.add(edge.to)
    adj.set(edge.from, a)

    const b = adj.get(edge.to) ?? new Set<string>()
    b.add(edge.from)
    adj.set(edge.to, b)
  }

  const ids = nodes.map((node) => node.id)
  const act = sel && map.has(sel) ? sel : ids.find((id) => hit.has(id)) ?? ids[0] ?? ""

  const dist = new Map<string, number>()
  if (act) {
    dist.set(act, 0)
    const queue = [act]
    while (queue.length > 0) {
      const id = queue.shift()!
      const step = dist.get(id) ?? 0
      if (step >= hop) continue
      for (const next of adj.get(id) ?? []) {
        if (!map.has(next) || dist.has(next)) continue
        dist.set(next, step + 1)
        queue.push(next)
      }
    }
  }

  const view = new Map<string, number>()
  for (const [id, step] of dist) view.set(id, step)
  for (const id of hit) {
    if (!view.has(id) && map.has(id)) view.set(id, hop + 1)
  }

  const groups = new Map<number, string[]>()
  for (const [id, step] of view) {
    const list = groups.get(step) ?? []
    list.push(id)
    groups.set(step, list)
  }

  for (const list of groups.values()) {
    list.sort((a, b) => {
      const da = deg(a, data.edges)
      const db = deg(b, data.edges)
      return db - da || (map.get(a)?.title ?? "").localeCompare(map.get(b)?.title ?? "")
    })
  }

  const cx = 320
  const cy = 250
  const placed = [
    ...place(groups.get(0) ?? [], 0, cx, cy, map, act, data.edges, hit, 0),
    ...Array.from({ length: hop }, (_, idx) => {
      const step = idx + 1
      const list = groups.get(step) ?? []
      const gap = Math.max(140, 92 + step * 68)
      return place(list, gap, cx, cy, map, act, data.edges, hit, step)
    }).flat(),
    ...place(groups.get(hop + 1) ?? [], Math.max(320, 92 + (hop + 1) * 68), cx, cy, map, act, data.edges, hit, hop + 1),
  ]

  const pos = new Map(placed.map((node) => [node.id, node]))
  const edges = data.edges
    .filter((edge) => pos.has(edge.from) && pos.has(edge.to))
    .map((edge) => {
      const a = pos.get(edge.from)!
      const b = pos.get(edge.to)!
      return {
        ...edge,
        a,
        b,
        on: edge.from === act || edge.to === act || a.hit || b.hit,
      }
    })

  return { nodes: placed, edges, act }
}

const Graph: Component = () => {
  const [search, setSearch] = useSearchParams()
  const [data, setData] = createSignal<GraphData>({ nodes: [], edges: [], stats: { wiki: 0, code: 0, memory: 0, learned: 0, facts: 0 } })
  const [sel, setSel] = createSignal("")
  const [term, setTerm] = createSignal("")
  const [load, setLoad] = createSignal(true)
  const [busy, setBusy] = createSignal(false)
  const [err, setErr] = createSignal<string | null>(null)
  const [msg, setMsg] = createSignal<string | null>(null)
  const [allow, setAllow] = createSignal<Set<GraphNode["kind"]>>(new Set(kinds))
  const [hop, setHop] = createSignal(2)

  const fetchGraph = async () => {
    setLoad(true)
    setErr(null)
    const res = await graphApi.get()
    if (res.error) {
      setErr(res.error)
      setLoad(false)
      return
    }
    if (res.data) setData(res.data)
    setLoad(false)
  }

  createEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchGraph()
    }, 0)
    onCleanup(() => window.clearTimeout(timer))
  })

  const visible = createMemo(() => {
    const q = term().trim().toLowerCase()
    return data().nodes.filter((node) => {
      if (!allow().has(node.kind)) return false
      if (!q) return true
      const meta = node.meta ? JSON.stringify(node.meta) : ""
      return (
        node.title.toLowerCase().includes(q) ||
        node.id.toLowerCase().includes(q) ||
        (node.path ?? "").toLowerCase().includes(q) ||
        (node.summary ?? "").toLowerCase().includes(q) ||
        (node.tags ?? []).some((tag) => tag.includes(q)) ||
        meta.toLowerCase().includes(q)
      )
    })
  })

  createEffect(() => {
    const ids = visible().map((node) => node.id)
    if (ids.length === 0) return
    const id = search.id || ""
    if (id && ids.includes(id) && id !== sel()) {
      setSel(id)
      return
    }
    if (!sel() || !ids.includes(sel())) setSel(ids[0]!)
  })

  const view = createMemo(() => layout(data(), sel(), term().trim(), allow(), hop()))
  const cur = createMemo(() => data().nodes.find((node) => node.id === view().act) ?? null)
  const outs = createMemo(() => data().edges.filter((edge) => edge.from === cur()?.id))
  const ins = createMemo(() => data().edges.filter((edge) => edge.to === cur()?.id))

  createEffect(() => {
    const id = sel()
    if (!id) return
    setSearch({ id })
  })

  const toggle = (kind: GraphNode["kind"]) => {
    const next = new Set(allow())
    if (next.has(kind) && next.size > 1) next.delete(kind)
    else next.add(kind)
    setAllow(next)
  }

  const pick = (id: string) => setSel(id)

  const label = (text: string) => {
    if (text.length <= 16) return text
    return `${text.slice(0, 15)}...`
  }

  const href = (node: GraphNode | null) => {
    if (!node) return ""
    if (node.kind === "wiki") return `/dashboard/wiki?id=${encodeURIComponent(node.id)}`
    if (node.kind === "memory") return `/dashboard/memory?id=${encodeURIComponent(node.id)}`
    if (node.kind === "code") return `/dashboard/codegraph?id=${encodeURIComponent(node.id)}`
    if (node.kind === "symbol") {
      const fileId = typeof node.meta?.fileId === "string" ? node.meta.fileId : ""
      return fileId ? `/dashboard/codegraph?id=${encodeURIComponent(fileId)}` : ""
    }
    return ""
  }

  return (
    <div class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Knowledge Graph</h1>
          <p class="text-gray-400 mt-1">Explore wiki notes, code, memories, learned patterns, and semantic links</p>
        </div>

        <div class="flex flex-wrap gap-3">
          <div class="px-4 py-3 rounded-lg bg-gray-800 border border-gray-700">
            <div class="text-xs uppercase tracking-wide text-gray-500">Wiki</div>
            <div class="text-lg font-semibold text-gray-100">{data().stats.wiki}</div>
          </div>
          <div class="px-4 py-3 rounded-lg bg-gray-800 border border-gray-700">
            <div class="text-xs uppercase tracking-wide text-gray-500">Code</div>
            <div class="text-lg font-semibold text-gray-100">{data().stats.code}</div>
          </div>
          <div class="px-4 py-3 rounded-lg bg-gray-800 border border-gray-700">
            <div class="text-xs uppercase tracking-wide text-gray-500">Memory</div>
            <div class="text-lg font-semibold text-gray-100">{data().stats.memory}</div>
          </div>
          <div class="px-4 py-3 rounded-lg bg-gray-800 border border-gray-700">
            <div class="text-xs uppercase tracking-wide text-gray-500">Facts</div>
            <div class="text-lg font-semibold text-gray-100">{data().stats.facts}</div>
          </div>
          <button onClick={fetchGraph} class="btn btn-primary" disabled={load() || busy()}>
            Refresh
          </button>
        </div>
      </div>

      <Show when={err()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">{err()}</div>
      </Show>

      <Show when={msg()}>
        <div class="bg-blue-900/40 border border-blue-700 rounded-lg p-4 text-blue-200">{msg()}</div>
      </Show>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div class="xl:col-span-4 card">
          <div class="card-header">Filters</div>
          <div class="space-y-4">
            <input class="input w-full" type="text" placeholder="Search graph..." value={term()} onInput={(e) => setTerm(e.currentTarget.value)} />
            <div class="flex flex-wrap gap-2">
              <For each={kinds}>
                {(kind) => (
                  <button
                    class={`badge cursor-pointer ${
                      allow().has(kind) ? "bg-blue-900/40 text-blue-300" : "bg-gray-700 text-gray-400"
                    }`}
                    onClick={() => toggle(kind)}
                  >
                    {kind}
                  </button>
                )}
              </For>
            </div>

            <div class="space-y-2">
              <div class="text-xs uppercase tracking-wide text-gray-500">Hop depth</div>
              <div class="flex flex-wrap gap-2">
                <For each={[1, 2, 3, 4]}>
                  {(n) => (
                    <button
                      class={`badge cursor-pointer ${hop() === n ? "bg-blue-900/40 text-blue-300" : "bg-gray-700 text-gray-400"}`}
                      onClick={() => setHop(n)}
                    >
                      {n} hop{n > 1 ? "s" : ""}
                    </button>
                  )}
                </For>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="stat-card">
                <div class="stat-label">Visible</div>
                <div class="stat-value">{visible().length}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Edges</div>
                <div class="stat-value">{view().edges.length}</div>
              </div>
            </div>

            <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              <For each={visible().slice(0, 60)}>
                {(node) => (
                  <button
                    onClick={() => pick(node.id)}
                    class={`w-full text-left rounded-lg border p-3 transition-colors ${
                      view().act === node.id ? "bg-blue-900/30 border-blue-700" : "bg-gray-800 border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="font-medium text-gray-100 truncate">{node.title}</div>
                        <div class="text-xs text-gray-500 truncate">{node.path || node.id}</div>
                      </div>
                      <span class={`badge ${kindClass(node.kind)}`}>{node.kind}</span>
                    </div>
                    <div class="mt-2 text-sm text-gray-400 max-h-12 overflow-hidden">{node.summary || "No summary"}</div>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>

        <div class="xl:col-span-5 card">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="card-header">Graph</div>
              <div class="text-xs text-gray-500">Focused around {cur()?.title || "current node"}</div>
            </div>
            <div class="text-xs text-gray-500">{view().nodes.length} nodes</div>
            <div class="text-xs text-gray-500">{hop()} hop radius</div>
          </div>

          <div class="rounded-xl border border-gray-700 bg-gray-900/80 overflow-hidden">
            <svg class="w-full h-[72vh]" viewBox="0 0 640 520" role="img" aria-label="Knowledge graph">
              <defs>
                <linearGradient id="line" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#374151" />
                  <stop offset="100%" stop-color="#60a5fa" />
                </linearGradient>
              </defs>
              <g opacity="0.3">
                <circle cx="320" cy="250" r="98" fill="none" stroke="#1f2937" />
                <circle cx="320" cy="250" r="170" fill="none" stroke="#1f2937" stroke-dasharray="5 10" />
              </g>
              <For each={view().edges}>
                {(edge) => (
                  <line
                    x1={edge.a.x}
                    y1={edge.a.y}
                    x2={edge.b.x}
                    y2={edge.b.y}
                    stroke={edge.on ? "url(#line)" : "#374151"}
                    stroke-width={edge.on ? "2.5" : "1.5"}
                    opacity={edge.on ? "0.9" : "0.35"}
                  />
                )}
              </For>
              <For each={view().nodes}>
                {(node) => {
                  const c = colors[node.kind]
                  return (
                    <g transform={`translate(${node.x}, ${node.y})`} class="cursor-pointer" onClick={() => pick(node.id)}>
                      <circle
                        r={node.r + 9}
                        fill={node.act ? c.glow : node.hit ? "rgba(59,130,246,0.12)" : "rgba(17,24,39,0.9)"}
                        stroke={node.act ? c.stroke : node.hit ? "#3b82f6" : "#374151"}
                        stroke-width={node.act ? "2.5" : "1.5"}
                      />
                      <circle
                        r={node.r}
                        fill={c.fill}
                        stroke={node.act ? c.stroke : c.fill}
                        stroke-width="1.5"
                      />
                      <text y={node.r + 14} text-anchor="middle" class="fill-gray-300 text-[10px]">
                        {node.hop > hop() ? `${label(node.title)}*` : label(node.title)}
                      </text>
                    </g>
                  )
                }}
              </For>
            </svg>
          </div>
        </div>

        <div class="xl:col-span-3 card">
          <div class="card-header">Details</div>

          <Show when={cur()} fallback={<div class="text-sm text-gray-500">Select a node to inspect its context.</div>}>
            <div class="space-y-4">
              <div>
                <div class="text-xl font-semibold text-gray-100">{cur()!.title}</div>
                <div class="text-xs text-gray-500 mt-1">{cur()!.path || cur()!.id}</div>
              </div>

              <div class="flex flex-wrap gap-2">
                <span class={`badge ${kindClass(cur()!.kind)}`}>{cur()!.kind}</span>
                <span class="badge bg-gray-700 text-gray-300">{ins().length} incoming</span>
                <span class="badge bg-gray-700 text-gray-300">{outs().length} outgoing</span>
              </div>

              <Show when={href(cur())}>
                <A class="btn btn-secondary text-xs inline-flex" href={href(cur())}>
                  Open in {cur()!.kind === "symbol" ? "code" : cur()!.kind}
                </A>
              </Show>

              <div>
                <div class="text-sm text-gray-400 mb-1">Summary</div>
                <div class="text-sm text-gray-300 leading-6">{cur()!.summary || "No summary available."}</div>
              </div>

              <Show when={cur()!.tags && cur()!.tags!.length > 0}>
                <div>
                  <div class="text-sm text-gray-400 mb-2">Tags</div>
                  <div class="flex flex-wrap gap-2">
                    <For each={cur()!.tags}>
                      {(tag) => <span class="badge bg-gray-700 text-gray-300">{tag}</span>}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={cur()!.meta && Object.keys(cur()!.meta!).length > 0}>
                <div>
                  <div class="text-sm text-gray-400 mb-2">Meta</div>
                  <div class="space-y-2">
                    <For each={Object.entries(cur()!.meta ?? {})}>
                      {([k, v]) => (
                        <div class="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-gray-300">
                          <span class="text-gray-500">{k}</span>: <span class="text-gray-200">{String(v)}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              <div>
                <div class="text-sm text-gray-400 mb-2">Incoming</div>
                <div class="flex flex-wrap gap-2">
                  <For each={ins().slice(0, 12)}>
                    {(edge) => {
                      const node = data().nodes.find((item) => item.id === edge.from)
                      return (
                        <button class="badge bg-gray-700 text-gray-300 hover:bg-gray-600" onClick={() => node && pick(node.id)}>
                          {node?.title || edge.from}
                        </button>
                      )
                    }}
                  </For>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Outgoing</div>
                <div class="flex flex-wrap gap-2">
                  <For each={outs().slice(0, 12)}>
                    {(edge) => {
                      const node = data().nodes.find((item) => item.id === edge.to)
                      return (
                        <button class="badge bg-gray-700 text-gray-300 hover:bg-gray-600" onClick={() => node && pick(node.id)}>
                          {node?.title || edge.to}
                        </button>
                      )
                    }}
                  </For>
                </div>
              </div>

              <div class="text-xs text-gray-500">
                Select a node to inspect its relationships. Nodes marked with * are search matches outside the current hop radius.
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

function kindClass(kind: GraphNode["kind"]) {
  switch (kind) {
    case "wiki":
      return "bg-blue-900/40 text-blue-300"
    case "code":
      return "bg-emerald-900/40 text-emerald-300"
    case "symbol":
      return "bg-purple-900/40 text-purple-300"
    case "memory":
      return "bg-amber-900/40 text-amber-300"
    case "learned":
      return "bg-rose-900/40 text-rose-300"
    case "concept":
      return "bg-gray-700 text-gray-300"
  }
}

export default Graph
