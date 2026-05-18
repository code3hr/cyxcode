import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { useSearchParams, A } from "@solidjs/router"
import { codegraphApi, type CodeEdge, type CodeGraph, type CodeFile } from "../api/client"

type Pos = {
  id: string
  x: number
  y: number
  r: number
  act: boolean
  hit: boolean
  kind: "file" | "symbol"
  title: string
  path: string
  deg: number
}

type Ed = CodeEdge & {
  a: Pos
  b: Pos
  on: boolean
}

type View = {
  nodes: Pos[]
  edges: Ed[]
  act: string
}

function deg(id: string, edges: CodeEdge[]) {
  let n = 0
  for (const edge of edges) {
    if (edge.from === id || edge.to === id) n++
  }
  return n
}

function place(ids: string[], gap: number, cx: number, cy: number, map: Map<string, CodeFile>, sel: string, edges: CodeEdge[], hit: Set<string>) {
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
      kind: "file",
      title: node.title,
      path: node.path,
      deg: deg(id, edges),
    })
  }

  return out
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
  const near = [...(adj.get(act) ?? new Set<string>())]
    .filter((id) => map.has(id) && id !== act)
    .sort((a, b) => (map.get(a)?.title ?? "").localeCompare(map.get(b)?.title ?? ""))
  const rest = ids.filter((id) => id !== act && !near.includes(id))

  const cx = 320
  const cy = 250
  const ring = Math.max(150, 28 + near.length * 10)
  const outer = Math.max(250, 46 + rest.length * 8)

  const nodes = [
    ...place(act ? [act] : [], 0, cx, cy, map, act, graph.edges, hit),
    ...place(near, ring, cx, cy, map, act, graph.edges, hit),
    ...place(rest, outer, cx, cy, map, act, graph.edges, hit),
  ]

  const pos = new Map(nodes.map((node) => [node.id, node]))
  const edges = graph.edges
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

  return (
    <div class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Code Explorer</h1>
          <p class="text-gray-400 mt-1">Inspect code files, imports, symbols, and symbol usage</p>
        </div>

        <div class="flex flex-wrap gap-3">
          <div class="px-4 py-3 rounded-lg bg-gray-800 border border-gray-700">
            <div class="text-xs uppercase tracking-wide text-gray-500">Files</div>
            <div class="text-lg font-semibold text-gray-100">{files().length}</div>
          </div>
          <button onClick={rebuild} class="btn btn-primary" disabled={busy() || load()}>
            Rebuild
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
          <div class="card-header">Files</div>
          <input class="input w-full mb-4" type="text" placeholder="Search code..." value={term()} onInput={(e) => setTerm(e.currentTarget.value)} />
          <div class="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
            <For each={files()}>
              {(item) => (
                <button
                  onClick={() => pick(item.id)}
                  class={`w-full text-left rounded-lg border p-3 transition-colors ${
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
            <div class="text-xs text-gray-500">{data().nodes.length} nodes</div>
          </div>

          <div class="rounded-xl border border-gray-700 bg-gray-900/80 overflow-hidden">
            <svg class="w-full h-[72vh]" viewBox="0 0 640 520" role="img" aria-label="Code graph">
              <defs>
                <linearGradient id="line" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#374151" />
                  <stop offset="100%" stop-color="#34d399" />
                </linearGradient>
              </defs>
              <g opacity="0.3">
                <circle cx="320" cy="250" r="98" fill="none" stroke="#1f2937" />
                <circle cx="320" cy="250" r="170" fill="none" stroke="#1f2937" stroke-dasharray="5 10" />
              </g>
              <For each={data().edges}>
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
              <For each={data().nodes}>
                {(node) => (
                  <g transform={`translate(${node.x}, ${node.y})`} class="cursor-pointer" onClick={() => pick(node.id)}>
                    <circle
                      r={node.r + 8}
                      fill={node.act ? "rgba(16,185,129,0.16)" : node.hit ? "rgba(34,197,94,0.12)" : "rgba(17,24,39,0.9)"}
                      stroke={node.act ? "#34d399" : node.hit ? "#22c55e" : "#374151"}
                      stroke-width={node.act ? "2.5" : "1.5"}
                    />
                    <circle
                      r={node.r}
                      fill="#0f766e"
                      stroke={node.act ? "#6ee7b7" : "#14b8a6"}
                      stroke-width="1.5"
                    />
                    <text y={node.r + 14} text-anchor="middle" class="fill-gray-300 text-[10px]">
                      {node.title.length > 16 ? `${node.title.slice(0, 15)}...` : node.title}
                    </text>
                  </g>
                )}
              </For>
            </svg>
          </div>
        </div>

        <div class="xl:col-span-3 card">
          <div class="card-header">Details</div>
          <Show when={cur()} fallback={<div class="text-sm text-gray-500">Select a file to inspect its content.</div>}>
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
                  Back to graph
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
                <pre class="max-h-80 overflow-y-auto rounded-lg bg-gray-900 border border-gray-700 p-3 text-xs text-gray-300 whitespace-pre-wrap break-words">
                  {text().slice(0, 5000)}
                </pre>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

export default Codegraph
