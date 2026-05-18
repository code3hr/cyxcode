import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { useSearchParams } from "@solidjs/router"
import { wikiApi, type WikiEdge, type WikiGraph, type WikiPage } from "../api/client"

type Pos = {
  id: string
  x: number
  y: number
  r: number
  act: boolean
  hit: boolean
  kind: "doc" | "wiki"
  title: string
  path: string
  deg: number
}

type Ed = WikiEdge & {
  a: Pos
  b: Pos
  on: boolean
}

type View = {
  nodes: Pos[]
  edges: Ed[]
  act: string
}

function deg(id: string, edges: WikiEdge[]) {
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
  map: Map<string, WikiPage>,
  sel: string,
  edges: WikiEdge[],
  hit: Set<string>,
) {
  const out: Pos[] = []
  const step = (Math.PI * 2) / Math.max(1, ids.length)
  const start = -Math.PI / 2

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!
    const page = map.get(id)
    if (!page) continue

    const ang = start + step * i
    out.push({
      id,
      x: cx + Math.cos(ang) * gap,
      y: cy + Math.sin(ang) * gap,
      r: id === sel ? 20 : 13,
      act: id === sel,
      hit: hit.has(id),
      kind: page.kind,
      title: page.title,
      path: page.path,
      deg: deg(id, edges),
    })
  }

  return out
}

function layout(graph: WikiGraph, pages: WikiPage[], sel: string, q: string): View {
  const map = new Map(pages.map((page) => [page.id, page]))
  const low = q.toLowerCase()
  const hit = new Set(
    pages
      .filter((page) => {
        if (!low) return true
        return (
          page.title.toLowerCase().includes(low) ||
          page.path.toLowerCase().includes(low) ||
          page.summary.toLowerCase().includes(low) ||
          page.tags.some((tag) => tag.includes(low))
        )
      })
      .map((page) => page.id),
  )

  const adj = new Map<string, Set<string>>()
  for (const edge of graph.edges) {
    const a = adj.get(edge.from) ?? new Set<string>()
    a.add(edge.to)
    adj.set(edge.from, a)

    const b = adj.get(edge.to) ?? new Set<string>()
    b.add(edge.from)
    adj.set(edge.to, b)
  }

  const ids = pages
    .filter((page) => hit.has(page.id) || page.id === sel)
    .sort((a, b) => {
      const da = deg(a.id, graph.edges)
      const db = deg(b.id, graph.edges)
      return db - da || a.title.localeCompare(b.title)
    })
    .map((page) => page.id)

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

function body(text: string) {
  return text
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/^#\s+.+\n?/, "")
    .trim()
}

const Wiki: Component = () => {
  const [search, setSearch] = useSearchParams()
  const [term, setTerm] = createSignal("")
  const [pages, setPages] = createSignal<WikiPage[]>([])
  const [graph, setGraph] = createSignal<WikiGraph>({ nodes: [], edges: [] })
  const [sel, setSel] = createSignal("")
  const [page, setPage] = createSignal<WikiPage | null>(null)
  const [text, setText] = createSignal("")
  const [load, setLoad] = createSignal(true)
  const [busy, setBusy] = createSignal(false)
  const [err, setErr] = createSignal<string | null>(null)
  const [note, setNote] = createSignal<string | null>(null)
  const [msg, setMsg] = createSignal<string | null>(null)
  const [nTitle, setNTitle] = createSignal("")
  const [nBody, setNBody] = createSignal("")
  const [nTags, setNTags] = createSignal("")
  const [eTitle, setETitle] = createSignal("")
  const [eBody, setEBody] = createSignal("")
  const [eTags, setETags] = createSignal("")

  const fetchList = async (q = "") => {
    setLoad(true)
    setErr(null)

    const [list, tree] = await Promise.all([
      wikiApi.list({ search: q || undefined, limit: 100 }),
      wikiApi.graph(),
    ])

    if (list.error) setErr(list.error)
    if (list.data) setPages(list.data.pages)
    if (tree.error) setErr(tree.error)
    if (tree.data) setGraph(tree.data)

    setLoad(false)
  }

  const fetchPage = async (id: string) => {
    setNote(null)

    const res = await wikiApi.get(id)
    if (res.error) {
      setNote(res.error)
      setPage(null)
      setText("")
      return
    }
    if (!res.data) return

    setPage(res.data.page)
    setText(res.data.content)
  }

  const sync = (item: WikiPage | null, body = "") => {
    if (!item) return
    setETitle(item.title)
    setEBody(body || "")
    setETags(item.tags.join(", "))
  }

  const rebuild = async () => {
    setBusy(true)
    setMsg(null)

    const res = await wikiApi.rebuild()
    if (res.error) {
      setMsg(res.error)
      setBusy(false)
      return
    }

    if (res.data) {
      setMsg(`Indexed ${res.data.indexed} pages and ${res.data.links} links`)
    }

    await fetchList(term().trim())
    if (sel()) await fetchPage(sel())
    setBusy(false)
  }

  const create = async () => {
    const title = nTitle().trim()
    if (!title) {
      setMsg("Title is required")
      return
    }

    setBusy(true)
    setMsg(null)
    const res = await wikiApi.create({
      title,
      body: nBody().trim(),
      tags: nTags()
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    })

    if (res.error) {
      setMsg(res.error)
      setBusy(false)
      return
    }

    setNTitle("")
    setNBody("")
    setNTags("")
    await fetchList(term().trim())
    if (res.data?.page.id) {
      setSel(res.data.page.id)
      setSearch({ id: res.data.page.id })
    }
    setBusy(false)
  }

  const save = async () => {
    const item = cur()
    if (!item) return

    setBusy(true)
    setMsg(null)
    const tag = eTags()
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
    const res = await wikiApi.update(item.id, {
      title: eTitle().trim() || item.title,
      body: eBody(),
      tags: tag,
    })

    if (res.error) {
      setMsg(res.error)
      setBusy(false)
      return
    }

    await fetchList(term().trim())
    if (res.data?.page.id) {
      setSel(res.data.page.id)
      setSearch({ id: res.data.page.id })
    }
    setBusy(false)
  }

  createEffect(() => {
    const q = term().trim()
    const timer = window.setTimeout(() => {
      void fetchList(q)
    }, 180)
    onCleanup(() => window.clearTimeout(timer))
  })

  createEffect(() => {
    const id = search.id || pages()[0]?.id || ""
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

  createEffect(() => {
    const item = cur()
    if (!item) return
    sync(item, body(text()))
  })

  const remove = async () => {
    const item = cur()
    if (!item || item.kind !== "wiki") return
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return

    setBusy(true)
    setMsg(null)
    const res = await wikiApi.delete(item.id)
    if (res.error) {
      setMsg(res.error)
      setBusy(false)
      return
    }

    setSel("")
    setPage(null)
    setText("")
    await fetchList(term().trim())
    setBusy(false)
  }

  const data = createMemo(() => layout(graph(), pages(), sel(), term().trim()))
  const cur = createMemo(() => page() ?? pages().find((item) => item.id === sel()) ?? null)
  const links = createMemo(() => new Set(pages().flatMap((item) => item.links)))

  const pick = (id: string) => {
    setSel(id)
    setSearch({ id })
  }

  return (
    <div class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Wiki Explorer</h1>
          <p class="text-gray-400 mt-1">Browse notes, links, and backlinks from the CyxCode knowledge index</p>
        </div>

        <div class="flex flex-wrap gap-3">
          <div class="px-4 py-3 rounded-lg bg-gray-800 border border-gray-700">
            <div class="text-xs uppercase tracking-wide text-gray-500">Notes</div>
            <div class="text-lg font-semibold text-gray-100">{pages().length}</div>
          </div>
          <div class="px-4 py-3 rounded-lg bg-gray-800 border border-gray-700">
            <div class="text-xs uppercase tracking-wide text-gray-500">Links</div>
            <div class="text-lg font-semibold text-gray-100">{links().size}</div>
          </div>
          <button onClick={rebuild} class="btn btn-primary flex items-center gap-2" disabled={busy() || load()}>
            <svg class={`w-4 h-4 ${busy() ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
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
          <div class="card-header">New Note</div>
          <div class="grid gap-3 mt-4">
            <input class="input" type="text" placeholder="Title" value={nTitle()} onInput={(e) => setNTitle(e.currentTarget.value)} />
            <textarea
              class="input min-h-28"
              placeholder="Body"
              value={nBody()}
              onInput={(e) => setNBody(e.currentTarget.value)}
            />
            <input class="input" type="text" placeholder="Tags, comma separated" value={nTags()} onInput={(e) => setNTags(e.currentTarget.value)} />
            <button onClick={create} class="btn btn-primary" disabled={busy()}>
              Create Note
            </button>
          </div>

          <div class="flex items-center justify-between gap-3 mb-4">
            <div>
              <div class="card-header">Pages</div>
              <div class="text-xs text-gray-500">{pages().length} results</div>
            </div>
            <input
              class="input max-w-44"
              type="text"
              placeholder="Search..."
              value={term()}
              onInput={(e) => setTerm(e.currentTarget.value)}
            />
          </div>

          <div class="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
            <Show when={!load() || pages().length > 0} fallback={<div class="text-sm text-gray-500">Loading wiki index...</div>}>
              <For each={pages()}>
                {(item) => (
                  <button
                    onClick={() => pick(item.id)}
                    class={`w-full text-left rounded-lg border p-3 transition-colors ${
                      sel() === item.id ? "bg-blue-900/30 border-blue-700" : "bg-gray-800 border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="font-medium text-gray-100 truncate">{item.title}</div>
                        <div class="text-xs text-gray-500 truncate">{item.path}</div>
                      </div>
                      <span class={`badge ${item.kind === "wiki" ? "bg-blue-900/40 text-blue-300" : "bg-gray-700 text-gray-300"}`}>
                        {item.kind}
                      </span>
                    </div>
                    <div class="mt-2 text-sm text-gray-400 max-h-12 overflow-hidden">{item.summary || "No summary"}</div>
                    <div class="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <span>{item.links.length} links</span>
                      <span>|</span>
                      <span>{item.backlinks.length} backlinks</span>
                      <span>|</span>
                      <span>{new Date(item.modified).toLocaleDateString()}</span>
                    </div>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </div>

        <div class="xl:col-span-5 card">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="card-header">Graph</div>
              <div class="text-xs text-gray-500">Focused around {cur()?.title || "current page"}</div>
            </div>
            <div class="text-xs text-gray-500">{data().nodes.length} nodes</div>
          </div>

          <div class="rounded-xl border border-gray-700 bg-gray-900/80 overflow-hidden">
            <svg class="w-full h-[72vh]" viewBox="0 0 640 520" role="img" aria-label="Wiki graph">
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
                      fill={node.act ? "rgba(37,99,235,0.16)" : node.hit ? "rgba(59,130,246,0.12)" : "rgba(17,24,39,0.9)"}
                      stroke={node.act ? "#60a5fa" : node.hit ? "#3b82f6" : "#374151"}
                      stroke-width={node.act ? "2.5" : "1.5"}
                    />
                    <circle
                      r={node.r}
                      fill={node.kind === "wiki" ? "#1d4ed8" : "#334155"}
                      stroke={node.act ? "#93c5fd" : "#475569"}
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

          <Show when={cur()} fallback={<div class="text-sm text-gray-500">Select a note to inspect its content.</div>}>
            <div class="space-y-4">
              <div>
                <div class="text-xl font-semibold text-gray-100">{cur()!.title}</div>
                <div class="text-xs text-gray-500 mt-1">{cur()!.path}</div>
              </div>

              <div class="flex flex-wrap gap-2">
                <span class={`badge ${cur()!.kind === "wiki" ? "bg-blue-900/40 text-blue-300" : "bg-gray-700 text-gray-300"}`}>
                  {cur()!.kind}
                </span>
                <span class="badge bg-gray-700 text-gray-300">{cur()!.links.length} links</span>
                <span class="badge bg-gray-700 text-gray-300">{cur()!.backlinks.length} backlinks</span>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-1">Summary</div>
                <div class="text-sm text-gray-300 leading-6">{cur()!.summary || "No summary available."}</div>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Links</div>
                <div class="flex flex-wrap gap-2">
                  <For each={cur()!.links}>
                    {(item) => <span class="badge bg-gray-700 text-gray-300">{item}</span>}
                  </For>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Backlinks</div>
                <div class="flex flex-wrap gap-2">
                  <For each={cur()!.backlinks}>
                    {(item) => <span class="badge bg-gray-700 text-gray-300">{item}</span>}
                  </For>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Content</div>
                <Show
                  when={!note()}
                  fallback={<div class="bg-red-900/40 border border-red-700 rounded-lg p-3 text-sm text-red-200">{note()}</div>}
                >
                  <pre class="max-h-80 overflow-y-auto rounded-lg bg-gray-900 border border-gray-700 p-3 text-xs text-gray-300 whitespace-pre-wrap break-words">
                    {text().slice(0, 3000)}
                  </pre>
                </Show>
              </div>

              <div class="pt-4 border-t border-gray-700">
                <div class="text-sm font-medium text-gray-200 mb-3">Edit Note</div>
                <div class="grid gap-3">
                  <input class="input" type="text" value={eTitle()} onInput={(e) => setETitle(e.currentTarget.value)} />
                  <textarea class="input min-h-40" value={eBody()} onInput={(e) => setEBody(e.currentTarget.value)} />
                  <input class="input" type="text" value={eTags()} onInput={(e) => setETags(e.currentTarget.value)} />
                  <div class="flex gap-2">
                    <button onClick={save} class="btn btn-secondary" disabled={busy()}>
                      Save Changes
                    </button>
                    <Show when={cur()!.kind === "wiki"}>
                      <button onClick={remove} class="btn btn-danger" disabled={busy()}>
                        Delete Note
                      </button>
                    </Show>
                  </div>
                </div>
              </div>

              <div class="text-xs text-gray-500">
                Updated {new Date(cur()!.modified).toLocaleString()} | accessed {cur()!.accessCount} times
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

export default Wiki
