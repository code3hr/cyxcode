import cytoscape from "cytoscape"
import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { A, useSearchParams } from "@solidjs/router"
import { graphApi, type GraphData, type GraphEdge, type GraphNode } from "../api/client"

type Pos = {
  id: string
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
  on: boolean
}

type View = {
  nodes: Pos[]
  edges: Ed[]
  act: string
}

const max = 180
const scan = max * 3
const kinds: GraphNode["kind"][] = ["wiki", "code", "symbol", "memory", "learned", "concept", "cyxwatch"]
const base = kinds.filter((kind) => kind !== "symbol")

const colors: Record<GraphNode["kind"], { fill: string; stroke: string; glow: string }> = {
  wiki: { fill: "#1d4ed8", stroke: "#60a5fa", glow: "rgba(37,99,235,0.18)" },
  code: { fill: "#0f766e", stroke: "#5eead4", glow: "rgba(15,118,110,0.16)" },
  symbol: { fill: "#4c1d95", stroke: "#c084fc", glow: "rgba(76,29,149,0.16)" },
  memory: { fill: "#92400e", stroke: "#fbbf24", glow: "rgba(146,64,14,0.16)" },
  learned: { fill: "#7c2d12", stroke: "#fb7185", glow: "rgba(124,45,18,0.16)" },
  concept: { fill: "#334155", stroke: "#64748b", glow: "rgba(51,65,85,0.16)" },
  cyxwatch: { fill: "#991b1b", stroke: "#f87171", glow: "rgba(153,27,27,0.16)" },
}

function has(node: GraphNode, q: string) {
  if (!q) return false
  const meta = node.meta ? JSON.stringify(node.meta) : ""
  return (
    node.title.toLowerCase().includes(q) ||
    node.id.toLowerCase().includes(q) ||
    (node.path ?? "").toLowerCase().includes(q) ||
    (node.summary ?? "").toLowerCase().includes(q) ||
    (node.tags ?? []).some((tag) => tag.toLowerCase().includes(q)) ||
    meta.toLowerCase().includes(q)
  )
}

function layout(data: GraphData, sel: string, q: string, allow: Set<GraphNode["kind"]>, hop: number): View {
  const nodes = data.nodes.filter((node) => allow.has(node.kind))
  const map = new Map(nodes.map((node) => [node.id, node]))
  const low = q.toLowerCase()
  const hit = low ? new Set(nodes.filter((node) => has(node, low)).map((node) => node.id)) : new Set<string>()

  const adj = new Map<string, Set<string>>()
  const degree = new Map<string, number>()
  for (const edge of data.edges) {
    if (!map.has(edge.from) || !map.has(edge.to)) continue
    const a = adj.get(edge.from) ?? new Set<string>()
    a.add(edge.to)
    adj.set(edge.from, a)
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1)

    const b = adj.get(edge.to) ?? new Set<string>()
    b.add(edge.from)
    adj.set(edge.to, b)
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1)
  }

  const ids = nodes.map((node) => node.id)
  const act = sel && map.has(sel) ? sel : ids.find((id) => hit.has(id)) ?? ids[0] ?? ""

  const dist = new Map<string, number>()
  if (act) {
    dist.set(act, 0)
    const queue = [act]
    for (let i = 0; i < queue.length; i++) {
      if (dist.size >= scan) break
      const id = queue[i]!
      const step = dist.get(id) ?? 0
      if (step >= hop) continue
      for (const next of adj.get(id) ?? []) {
        if (!map.has(next) || dist.has(next)) continue
        dist.set(next, step + 1)
        queue.push(next)
        if (dist.size >= scan) break
      }
    }
  }

  const view = new Set<string>()
  for (const id of dist.keys()) view.add(id)
  for (const id of hit) {
    if (map.has(id)) view.add(id)
  }

  const raw = Array.from(view)
    .filter((id) => map.has(id))
    .map((id) => {
      const node = map.get(id)!
      const step = dist.get(id) ?? hop + 1
      const n = degree.get(id) ?? 0
      return {
        id,
        r: id === act ? 18 : node.kind === "wiki" ? 12 : Math.min(11, 7 + Math.sqrt(n) * 0.2),
        act: id === act,
        hit: hit.has(id),
        kind: node.kind,
        title: node.title,
        path: node.path,
        deg: n,
        hop: step,
      }
    })
    .sort((a, b) => {
      if (a.id === act) return -1
      if (b.id === act) return 1
      return a.hop - b.hop || Number(b.hit) - Number(a.hit) || b.deg - a.deg || a.title.localeCompare(b.title)
    })
    .slice(0, max)

  const keep = new Set(raw.map((node) => node.id))
  const linked = data.edges.filter((edge) => keep.has(edge.from) && keep.has(edge.to))
  const pos = new Map(raw.map((node) => [node.id, node]))
  const edges = linked.map((edge) => ({
    ...edge,
    on: edge.from === act || edge.to === act || !!pos.get(edge.from)?.hit || !!pos.get(edge.to)?.hit,
  }))

  return { nodes: raw, edges, act }
}

const Graph: Component = () => {
  const [search, setSearch] = useSearchParams()
  const [data, setData] = createSignal<GraphData>({ nodes: [], edges: [], stats: { wiki: 0, code: 0, memory: 0, learned: 0, facts: 0, cyxwatch: 0 } })
  const [sel, setSel] = createSignal("")
  const [term, setTerm] = createSignal("")
  const [load, setLoad] = createSignal(true)
  const [err, setErr] = createSignal<string | null>(null)
  const [allow, setAllow] = createSignal<Set<GraphNode["kind"]>>(new Set(base))
  const [hop, setHop] = createSignal(2)
  const [fit, setFit] = createSignal(0)
  const [full, setFull] = createSignal(false)

  const fetchGraph = async () => {
    setLoad(true)
    setErr(null)
    const res = await graphApi.get({
      id: sel(),
      q: term().trim(),
      hop: hop(),
      limit: max,
      symbols: allow().has("symbol"),
    })
    if (res.error) {
      setErr(res.error)
      setLoad(false)
      return
    }
    if (res.data) setData(res.data)
    setLoad(false)
  }

  createEffect(() => {
    const id = sel()
    const q = term().trim()
    const depth = hop()
    const symbols = allow().has("symbol")
    const timer = window.setTimeout(() => {
      id
      q
      depth
      symbols
      void fetchGraph()
    }, q ? 180 : 0)
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
        (node.tags ?? []).some((tag) => tag.toLowerCase().includes(q)) ||
        meta.toLowerCase().includes(q)
      )
    })
  })

  createEffect(() => {
    const ids = visible().map((node) => node.id)
    if (ids.length === 0) return
    const id = Array.isArray(search.id) ? search.id[0] ?? "" : search.id || ""
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

  const toggleFull = () => {
    setFull((value) => !value)
    setFit((n) => n + 1)
  }

  createEffect(() => {
    if (!full()) return
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setFull(false)
      setFit((n) => n + 1)
    }
    window.addEventListener("keydown", close)
    onCleanup(() => window.removeEventListener("keydown", close))
  })

  const href = (node: GraphNode | null) => {
    if (!node) return ""
    if (node.kind === "wiki") return `/dashboard/wiki?id=${encodeURIComponent(node.id)}`
    if (node.kind === "memory") return `/dashboard/memory?id=${encodeURIComponent(node.id)}`
    if (node.kind === "code") return `/dashboard/codegraph?id=${encodeURIComponent(node.id)}`
    if (node.kind === "cyxwatch") return "/dashboard/security"
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
          <p class="text-gray-400 mt-1">Wiki, code, memory, learned patterns, security signals, and semantic links</p>
        </div>

        <div class="flex flex-wrap gap-3">
          <div class="stat-card">
            <div class="text-xs uppercase tracking-wide text-gray-500">Wiki</div>
            <div class="text-lg font-semibold text-gray-100">{data().stats.wiki}</div>
          </div>
          <div class="stat-card">
            <div class="text-xs uppercase tracking-wide text-gray-500">Code</div>
            <div class="text-lg font-semibold text-gray-100">{data().stats.code}</div>
          </div>
          <div class="stat-card">
            <div class="text-xs uppercase tracking-wide text-gray-500">Memory</div>
            <div class="text-lg font-semibold text-gray-100">{data().stats.memory}</div>
          </div>
          <div class="stat-card">
            <div class="text-xs uppercase tracking-wide text-gray-500">Facts</div>
            <div class="text-lg font-semibold text-gray-100">{data().stats.facts}</div>
          </div>
          <div class="stat-card">
            <div class="text-xs uppercase tracking-wide text-gray-500">Watch</div>
            <div class="text-lg font-semibold text-gray-100">{data().stats.cyxwatch}</div>
          </div>
          <button onClick={fetchGraph} class="btn btn-primary" disabled={load()}>
            Refresh
          </button>
        </div>
      </div>

      <Show when={err()}>
        <div class="bg-red-900/50 border border-red-700 rounded p-4 text-red-200">{err()}</div>
      </Show>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div class="xl:col-span-3 card">
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
                    class={`w-full text-left rounded border p-3 transition-colors ${
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

        <div class="xl:col-span-6 card">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="card-header">Graph</div>
              <div class="text-xs text-gray-500">Focused around {cur()?.title || "current node"}</div>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-xs text-gray-500">{view().nodes.length} canvas nodes</div>
              <div class="text-xs text-gray-500">{hop()} hop radius</div>
              <button class="btn btn-secondary text-xs" onClick={() => setFit((n) => n + 1)} disabled={view().nodes.length === 0}>
                Fit
              </button>
              <button class="btn btn-secondary text-xs inline-flex items-center gap-2" onClick={toggleFull} disabled={view().nodes.length === 0}>
                <Icon path="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                Fullscreen
              </button>
            </div>
          </div>

          <div class="relative rounded border border-gray-700 bg-gray-900/80 overflow-hidden">
            <Show when={!full()}>
              <CyGraph view={view()} hop={hop()} fit={fit()} full={false} pick={pick} />
            </Show>
            <Show when={load()}>
              <div class="absolute inset-0 grid place-items-center bg-gray-950/70 text-sm text-gray-300">Loading graph...</div>
            </Show>
            <Show when={!load() && view().nodes.length === 0}>
              <div class="absolute inset-0 grid place-items-center bg-gray-950/70 text-sm text-gray-400">No matching graph nodes.</div>
            </Show>
          </div>
        </div>

        <div class="xl:col-span-3 card">
          <div class="card-header">Details</div>

          <Show when={cur()} fallback={<div class="text-sm text-gray-500">No node selected.</div>}>
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
                        <div class="rounded bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-gray-300">
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
            </div>
          </Show>
        </div>
      </div>

      <Show when={full()}>
        <div class="fixed inset-0 z-50 flex flex-col bg-gray-950">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/95 px-4 py-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-gray-100 truncate">Knowledge Graph</div>
              <div class="text-xs text-gray-500 truncate">
                {view().nodes.length} nodes, {view().edges.length} edges, focused on {cur()?.title || "current node"}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button class="btn btn-secondary text-xs" onClick={() => setFit((n) => n + 1)} disabled={view().nodes.length === 0}>
                Fit
              </button>
              <button class="btn btn-secondary text-xs inline-flex items-center gap-2" onClick={toggleFull}>
                <Icon path="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                Exit
              </button>
            </div>
          </div>
          <div class="relative min-h-0 flex-1">
            <CyGraph view={view()} hop={hop()} fit={fit()} full={true} pick={pick} />
            <Show when={load()}>
              <div class="absolute inset-0 grid place-items-center bg-gray-950/70 text-sm text-gray-300">Loading graph...</div>
            </Show>
            <Show when={!load() && view().nodes.length === 0}>
              <div class="absolute inset-0 grid place-items-center bg-gray-950/70 text-sm text-gray-400">No matching graph nodes.</div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}

function CyGraph(props: { view: View; hop: number; fit: number; full: boolean; pick: (id: string) => void }) {
  let el: HTMLDivElement | undefined

  createEffect(() => {
    const root = el
    if (!root) return
    props.fit

    const nodes = props.view.nodes.map((node) => {
      const c = colors[node.kind]
      return {
        group: "nodes" as const,
        data: {
          id: node.id,
          label: node.hop > props.hop ? `${short(node.title)}*` : short(node.title),
          kind: node.kind,
          size: node.r * 2,
          fill: node.act ? c.stroke : node.hit ? "#3b82f6" : c.fill,
          border: node.act ? "#f9fafb" : c.stroke,
          glow: c.glow,
          act: node.act,
          hit: node.hit,
          dim: !node.act && !node.hit && props.view.nodes.length > 120,
        },
        classes: [node.kind, node.act ? "act" : "", node.hit ? "hit" : ""].filter(Boolean).join(" "),
      }
    }) satisfies cytoscape.ElementDefinition[]

    const edges = props.view.edges.map((edge, i) => ({
      group: "edges" as const,
      data: {
        id: `${edge.from}->${edge.to}:${edge.type}:${i}`,
        source: edge.from,
        target: edge.to,
        type: edge.type,
        on: edge.on,
        width: edge.on ? 2.2 : 1,
        color: edge.on ? "#60a5fa" : "#374151",
        opacity: edge.on ? 0.86 : props.view.nodes.length > 120 ? 0.12 : 0.34,
      },
      classes: edge.on ? "on" : "",
    })) satisfies cytoscape.ElementDefinition[]

    const cy = cytoscape({
      container: root,
      elements: [...nodes, ...edges],
      autoungrabify: false,
      boxSelectionEnabled: false,
      maxZoom: 4,
      minZoom: 0.08,
      wheelSensitivity: 0.18,
      style: [
        {
          selector: "core",
          style: {
            "active-bg-color": "#1f2937",
            "active-bg-opacity": 0.28,
            "selection-box-color": "#60a5fa",
            "selection-box-opacity": 0.12,
          },
        },
        {
          selector: "node",
          style: {
            "background-color": "data(fill)",
            "border-color": "data(border)",
            "border-width": 1.4,
            color: "#d1d5db",
            content: "data(label)",
            "font-family": "Inter, ui-sans-serif, system-ui",
            "font-size": 10,
            height: "data(size)",
            label: "data(label)",
            "min-zoomed-font-size": 7,
            opacity: "data(dim)",
            "overlay-color": "#60a5fa",
            "overlay-opacity": 0,
            "text-background-color": "#111827",
            "text-background-opacity": 0.72,
            "text-background-padding": 2,
            "text-margin-y": 8,
            "text-outline-color": "#111827",
            "text-outline-width": 1.5,
            width: "data(size)",
          },
        },
        {
          selector: "node[dim]",
          style: {
            opacity: 0.62,
          },
        },
        {
          selector: "node.act",
          style: {
            "border-width": 3,
            "font-size": 12,
            height: 42,
            opacity: 1,
            "text-background-opacity": 0.9,
            width: 42,
            "z-index": 20,
          },
        },
        {
          selector: "node.hit",
          style: {
            "border-width": 2.4,
            opacity: 1,
            "z-index": 15,
          },
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "line-color": "data(color)",
            opacity: "data(opacity)",
            "target-arrow-color": "data(color)",
            "target-arrow-shape": "triangle",
            "target-arrow-width": 4,
            width: "data(width)",
          },
        },
        {
          selector: "edge.on",
          style: {
            "z-index": 10,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        componentSpacing: 88,
        edgeElasticity: 110,
        fit: true,
        gravity: 0.32,
        idealEdgeLength: 92,
        nestingFactor: 1.15,
        nodeOverlap: 18,
        nodeRepulsion: 7600,
        numIter: props.view.nodes.length > 120 ? 650 : 950,
        padding: 36,
        randomize: true,
      },
    })

    cy.on("tap", "node", (event) => {
      props.pick(event.target.id())
    })
    cy.on("mouseover", "node", () => {
      root.style.cursor = "pointer"
    })
    cy.on("mouseout", "node", () => {
      root.style.cursor = "default"
    })

    const resize = new ResizeObserver(() => {
      cy.resize()
      cy.fit(undefined, 36)
    })
    resize.observe(root)

    onCleanup(() => {
      resize.disconnect()
      cy.destroy()
    })
  })

  return <div ref={el} class={props.full ? "h-full w-full" : "h-[72vh] w-full"} role="img" aria-label="Knowledge graph" />
}

function short(text: string) {
  if (text.length <= 18) return text
  return `${text.slice(0, 17)}...`
}

function Icon(props: { path: string }) {
  return (
    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={props.path} stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
    </svg>
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
    case "cyxwatch":
      return "bg-red-950/60 text-red-300"
  }
}

export default Graph
