import cytoscape from "cytoscape"
import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { useSearchParams, A } from "@solidjs/router"
import { codegraphApi, type CodeEdge, type CodeGraph, type CodeFile } from "../api/client"

type Pos = {
  id: string
  r: number
  act: boolean
  hit: boolean
  kind: "file" | "symbol"
  title: string
  path: string
  deg: number
}

type Ed = CodeEdge & {
  on: boolean
}

type View = {
  nodes: Pos[]
  edges: Ed[]
  act: string
}

const colors = {
  fill: "#0f766e",
  stroke: "#6ee7b7",
  hit: "#22c55e",
}

function deg(id: string, edges: CodeEdge[]) {
  let n = 0
  for (const edge of edges) {
    if (edge.from === id || edge.to === id) n++
  }
  return n
}

function layout(graph: CodeGraph, files: CodeFile[], sel: string, q: string): View {
  const map = new Map(files.map((file) => [file.id, file]))
  const low = q.toLowerCase()
  const hit = new Set(
    files
      .filter((file) => {
        if (!low) return true
        return (
          file.title.toLowerCase().includes(low) ||
          file.path.toLowerCase().includes(low) ||
          file.id.toLowerCase().includes(low) ||
          file.symbols.some((item) => item.toLowerCase().includes(low)) ||
          file.imports.some((item) => item.toLowerCase().includes(low)) ||
          file.uses.some((item) => item.toLowerCase().includes(low))
        )
      })
      .map((file) => file.id),
  )

  const adj = new Map<string, Set<string>>()
  for (const edge of graph.edges) {
    if (!map.has(edge.from) || !map.has(edge.to)) continue
    const a = adj.get(edge.from) ?? new Set<string>()
    a.add(edge.to)
    adj.set(edge.from, a)

    const b = adj.get(edge.to) ?? new Set<string>()
    b.add(edge.from)
    adj.set(edge.to, b)
  }

  const ids = files
    .filter((file) => hit.has(file.id) || file.id === sel)
    .sort((a, b) => deg(b.id, graph.edges) - deg(a.id, graph.edges) || a.title.localeCompare(b.title))
    .map((file) => file.id)

  const act = sel && map.has(sel) ? sel : ids[0] ?? ""
  const near = new Set([act, ...(adj.get(act) ?? new Set<string>())].filter(Boolean))
  const nodes = ids
    .filter((id) => near.has(id) || hit.has(id))
    .slice(0, 140)
    .map((id) => {
      const file = map.get(id)!
      const n = deg(id, graph.edges)
      return {
        id,
        r: id === act ? 19 : Math.min(15, 10 + Math.sqrt(n) * 0.5),
        act: id === act,
        hit: hit.has(id),
        kind: "file" as const,
        title: file.title,
        path: file.path,
        deg: n,
      }
    })

  const pos = new Map(nodes.map((node) => [node.id, node]))
  const edges = graph.edges.filter((edge) => pos.has(edge.from) && pos.has(edge.to)).map((edge) => ({
    ...edge,
    on: edge.from === act || edge.to === act || !!pos.get(edge.from)?.hit || !!pos.get(edge.to)?.hit,
  }))

  return { nodes, edges, act }
}

const Codegraph: Component = () => {
  const [search, setSearch] = useSearchParams()
  const [term, setTerm] = createSignal("")
  const [files, setFiles] = createSignal<CodeFile[]>([])
  const [graph, setGraph] = createSignal<CodeGraph>({ nodes: [], edges: [] })
  const [sel, setSel] = createSignal("")
  const [page, setPage] = createSignal<CodeFile | null>(null)
  const [text, setText] = createSignal("")
  const [load, setLoad] = createSignal(true)
  const [busy, setBusy] = createSignal(false)
  const [err, setErr] = createSignal<string | null>(null)
  const [msg, setMsg] = createSignal<string | null>(null)
  const [fit, setFit] = createSignal(0)
  const [full, setFull] = createSignal(false)

  const fetchList = async (q = "") => {
    setLoad(true)
    setErr(null)
    const [list, tree] = await Promise.all([codegraphApi.list({ search: q || undefined, limit: 100 }), codegraphApi.graph()])
    if (list.error) setErr(list.error)
    if (list.data) setFiles(list.data.files)
    if (tree.error) setErr(tree.error)
    if (tree.data) setGraph(tree.data)
    setLoad(false)
  }

  const fetchPage = async (id: string) => {
    const res = await codegraphApi.get(id)
    if (res.error) {
      setErr(res.error)
      setPage(null)
      setText("")
      return
    }
    if (!res.data) return
    setPage(res.data.file)
    setText(res.data.content)
  }

  const rebuild = async () => {
    setBusy(true)
    setMsg(null)
    const res = await codegraphApi.rebuild()
    if (res.error) {
      setMsg(res.error)
      setBusy(false)
      return
    }
    if (res.data) setMsg(`Indexed ${res.data.files} files and ${res.data.symbols} symbols`)
    await fetchList(term().trim())
    if (sel()) await fetchPage(sel())
    setBusy(false)
  }

  createEffect(() => {
    const q = term().trim()
    const timer = window.setTimeout(() => void fetchList(q), 180)
    onCleanup(() => window.clearTimeout(timer))
  })

  createEffect(() => {
    const id = search.id || files()[0]?.id || ""
    if (!id) return
    if (id !== sel()) setSel(id)
  })

  createEffect(() => {
    const id = sel()
    if (!id) return
    setPage(null)
    setText("")
    void fetchPage(id)
    setSearch({ id })
  })

  const data = createMemo(() => layout(graph(), files(), sel(), term().trim()))
  const cur = createMemo(() => page() ?? files().find((item) => item.id === sel()) ?? null)
  const imp = createMemo(() => cur()?.imports ?? [])
  const use = createMemo(() => cur()?.uses ?? [])

  const pick = (id: string) => {
    setSel(id)
    setSearch({ id })
  }

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

  return (
    <div class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Code Graph</h1>
          <p class="text-gray-400 mt-1">Files, imports, symbols, and usage links</p>
        </div>

        <div class="flex flex-wrap gap-3">
          <div class="stat-card">
            <div class="text-xs uppercase tracking-wide text-gray-500">Files</div>
            <div class="text-lg font-semibold text-gray-100">{files().length}</div>
          </div>
          <button onClick={rebuild} class="btn btn-primary" disabled={busy() || load()}>
            Rebuild
          </button>
        </div>
      </div>

      <Show when={err()}>
        <div class="bg-red-900/50 border border-red-700 rounded p-4 text-red-200">{err()}</div>
      </Show>

      <Show when={msg()}>
        <div class="bg-blue-900/40 border border-blue-700 rounded p-4 text-blue-200">{msg()}</div>
      </Show>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div class="xl:col-span-4 card">
          <div class="card-header">Files</div>
          <input class="input w-full mb-4" type="text" placeholder="Search code..." value={term()} onInput={(e) => setTerm(e.currentTarget.value)} />
          <div class="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
            <For each={files()}>
              {(item) => (
                <button
                  onClick={() => pick(item.id)}
                  class={`w-full text-left rounded border p-3 transition-colors ${
                    sel() === item.id ? "bg-emerald-900/30 border-emerald-700" : "bg-gray-800 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div class="font-medium text-gray-100 truncate">{item.title}</div>
                  <div class="text-xs text-gray-500 truncate">{item.path}</div>
                  <div class="mt-2 text-sm text-gray-400 max-h-12 overflow-hidden">
                    {item.symbols.slice(0, 4).join(", ") || "No symbols"}
                  </div>
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="xl:col-span-5 card">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="card-header">Graph</div>
              <div class="text-xs text-gray-500">Focused around {cur()?.title || "current file"}</div>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-xs text-gray-500">{data().nodes.length} nodes</div>
              <button class="btn btn-secondary text-xs" onClick={() => setFit((n) => n + 1)} disabled={data().nodes.length === 0}>
                Fit
              </button>
              <button class="btn btn-secondary text-xs inline-flex items-center gap-2" onClick={toggleFull} disabled={data().nodes.length === 0}>
                <Icon path="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                Fullscreen
              </button>
            </div>
          </div>

          <div class="relative rounded border border-gray-700 bg-gray-900/80 overflow-hidden">
            <Show when={!full()}>
              <CodeGraphView view={data()} fit={fit()} full={false} pick={pick} />
            </Show>
            <Show when={load()}>
              <div class="absolute inset-0 grid place-items-center bg-gray-950/70 text-sm text-gray-300">Loading graph...</div>
            </Show>
            <Show when={!load() && data().nodes.length === 0}>
              <div class="absolute inset-0 grid place-items-center bg-gray-950/70 text-sm text-gray-400">No matching code graph nodes.</div>
            </Show>
          </div>
        </div>

        <div class="xl:col-span-3 card">
          <div class="card-header">Details</div>
          <Show when={cur()} fallback={<div class="text-sm text-gray-500">No file selected.</div>}>
            <div class="space-y-4">
              <div>
                <div class="text-xl font-semibold text-gray-100">{cur()!.title}</div>
                <div class="text-xs text-gray-500 mt-1">{cur()!.path}</div>
              </div>

              <div class="flex flex-wrap gap-2">
                <span class="badge bg-emerald-900/40 text-emerald-300">{cur()!.kind}</span>
                <span class="badge bg-gray-700 text-gray-300">{imp().length} imports</span>
                <span class="badge bg-gray-700 text-gray-300">{use().length} uses</span>
              </div>

              <div class="flex flex-wrap gap-2">
                <A class="btn btn-secondary text-xs" href={`/dashboard/graph?id=${encodeURIComponent(cur()!.id)}`}>
                  Graph
                </A>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Imports</div>
                <div class="flex flex-wrap gap-2">
                  <For each={imp()}>
                    {(item) => <span class="badge bg-gray-700 text-gray-300">{item}</span>}
                  </For>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Uses</div>
                <div class="flex flex-wrap gap-2">
                  <For each={use()}>
                    {(item) => <span class="badge bg-gray-700 text-gray-300">{item}</span>}
                  </For>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Symbols</div>
                <div class="flex flex-wrap gap-2">
                  <For each={cur()!.symbols}>
                    {(item) => <span class="badge bg-gray-700 text-gray-300">{item}</span>}
                  </For>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Content</div>
                <pre class="max-h-80 overflow-y-auto rounded bg-gray-900 border border-gray-700 p-3 text-xs text-gray-300 whitespace-pre-wrap break-words">
                  {text().slice(0, 5000)}
                </pre>
              </div>
            </div>
          </Show>
        </div>
      </div>

      <Show when={full()}>
        <div class="fixed inset-0 z-50 flex flex-col bg-gray-950">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/95 px-4 py-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-gray-100 truncate">Code Graph</div>
              <div class="text-xs text-gray-500 truncate">
                {data().nodes.length} nodes, {data().edges.length} links, focused on {cur()?.title || "current file"}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button class="btn btn-secondary text-xs" onClick={() => setFit((n) => n + 1)} disabled={data().nodes.length === 0}>
                Fit
              </button>
              <button class="btn btn-secondary text-xs inline-flex items-center gap-2" onClick={toggleFull}>
                <Icon path="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                Exit
              </button>
            </div>
          </div>
          <div class="relative min-h-0 flex-1">
            <CodeGraphView view={data()} fit={fit()} full={true} pick={pick} />
            <Show when={load()}>
              <div class="absolute inset-0 grid place-items-center bg-gray-950/70 text-sm text-gray-300">Loading graph...</div>
            </Show>
            <Show when={!load() && data().nodes.length === 0}>
              <div class="absolute inset-0 grid place-items-center bg-gray-950/70 text-sm text-gray-400">No matching code graph nodes.</div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}

function CodeGraphView(props: { view: View; fit: number; full: boolean; pick: (id: string) => void }) {
  let el: HTMLDivElement | undefined

  createEffect(() => {
    const root = el
    if (!root) return
    props.fit

    const nodes = props.view.nodes.map((node) => ({
      group: "nodes" as const,
      data: {
        id: node.id,
        label: short(node.title),
        size: node.r * 2,
        fill: node.act ? colors.stroke : node.hit ? colors.hit : colors.fill,
        border: node.act ? "#f9fafb" : colors.stroke,
        dim: !node.act && !node.hit && props.view.nodes.length > 90,
      },
      classes: [node.kind, node.act ? "act" : "", node.hit ? "hit" : ""].filter(Boolean).join(" "),
    })) satisfies cytoscape.ElementDefinition[]

    const edges = props.view.edges.map((edge, i) => ({
      group: "edges" as const,
      data: {
        id: `${edge.from}->${edge.to}:${edge.type}:${i}`,
        source: edge.from,
        target: edge.to,
        color: edge.on ? "#34d399" : "#374151",
        opacity: edge.on ? 0.85 : props.view.nodes.length > 90 ? 0.14 : 0.34,
        width: edge.on ? 2.2 : 1,
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
            "selection-box-color": "#34d399",
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
            "min-zoomed-font-size": 7,
            opacity: "data(dim)",
            "overlay-color": "#34d399",
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
        componentSpacing: 78,
        edgeElasticity: 110,
        fit: true,
        gravity: 0.34,
        idealEdgeLength: 86,
        nestingFactor: 1.15,
        nodeOverlap: 18,
        nodeRepulsion: 7000,
        numIter: props.view.nodes.length > 90 ? 620 : 900,
        padding: 34,
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
      cy.fit(undefined, 34)
    })
    resize.observe(root)

    onCleanup(() => {
      resize.disconnect()
      cy.destroy()
    })
  })

  return <div ref={el} class={props.full ? "h-full w-full" : "h-[72vh] w-full"} role="img" aria-label="Code graph" />
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

export default Codegraph
