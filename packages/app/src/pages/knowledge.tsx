import { Button } from "@cyxcode/ui/button"
import { useParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { useSDK } from "@/context/sdk"
import { useServer } from "@/context/server"
import { decode64 } from "@/utils/base64"

type Page = {
  id: string
  path: string
  kind: "doc" | "wiki"
  title: string
  summary: string
  tags: string[]
  links: string[]
  backlinks: string[]
}

type Node = {
  id: string
  kind: "wiki" | "code" | "symbol" | "memory" | "learned" | "concept"
  title: string
  path?: string
  summary?: string
  meta?: Record<string, unknown>
}

type Edge = {
  from: string
  to: string
  type: string
}

type Wiki = {
  pages: Page[]
  total: number
}

type Graph = {
  nodes: Node[]
  edges: Edge[]
  stats: {
    wiki: number
    code: number
    memory: number
    learned: number
    facts: number
  }
}

function auth(server: ReturnType<typeof useServer>): Record<string, string> {
  const cur = server.current?.http
  if (!cur?.password) return {}
  return {
    Authorization: `Basic ${btoa(`${cur.username ?? "opencode"}:${cur.password}`)}`,
  }
}

function label(kind: Node["kind"]) {
  if (kind === "wiki") return "Wiki"
  if (kind === "code") return "Code"
  if (kind === "symbol") return "Symbol"
  if (kind === "memory") return "Memory"
  if (kind === "learned") return "Learned"
  return "Concept"
}

function color(kind: Node["kind"]) {
  if (kind === "wiki") return "var(--text-interactive-base)"
  if (kind === "code") return "var(--text-success-base)"
  if (kind === "symbol") return "var(--text-warning-base)"
  if (kind === "memory") return "var(--text-accent-base)"
  if (kind === "learned") return "var(--text-diff-add-base)"
  return "var(--text-base)"
}

function badge(kind: Node["kind"]) {
  if (kind === "wiki") return "bg-blue-900/40 text-blue-300"
  if (kind === "code") return "bg-emerald-900/40 text-emerald-300"
  if (kind === "symbol") return "bg-violet-900/40 text-violet-300"
  if (kind === "memory") return "bg-amber-900/40 text-amber-300"
  if (kind === "learned") return "bg-rose-900/40 text-rose-300"
  return "bg-slate-700 text-slate-300"
}

function paint(kind: Node["kind"]) {
  if (kind === "wiki") return "#60a5fa"
  if (kind === "code") return "#34d399"
  if (kind === "symbol") return "#a78bfa"
  if (kind === "memory") return "#f59e0b"
  if (kind === "learned") return "#fb7185"
  return "#94a3b8"
}

function title(node: Node) {
  if (node.kind === "code" && node.title.toLowerCase() === "acp") return "ACP"
  if (node.kind === "code" && /^[a-z]{2,4}$/.test(node.title)) return node.title.toUpperCase()
  return node.title
}

function note(node: Node) {
  if (node.kind === "code" && node.path?.includes("/acp/")) return "Agent Client Protocol"
  if (node.kind === "code") return node.path?.split("/").pop() ?? node.id
  if (node.kind === "symbol") return node.path ? `${node.path} · symbol` : "symbol"
  if (node.kind === "wiki") return node.path ?? "wiki"
  return node.path ?? node.id
}

function short(text: string, len = 24) {
  return text.length > len ? `${text.slice(0, len - 1)}…` : text
}

type Pos = {
  id: string
  x: number
  y: number
  r: number
  act: boolean
  hit: boolean
  kind: Node["kind"]
  title: string
  path?: string
  deg: number
  hop: number
}

type View = {
  nodes: Pos[]
  edges: Array<Edge & { a: Pos; b: Pos; on: boolean }>
  act: string
}

const kinds: Node["kind"][] = ["wiki", "code", "symbol", "memory", "learned", "concept"]

function place(
  ids: string[],
  gap: number,
  cx: number,
  cy: number,
  map: Map<string, Node>,
  sel: string,
  degs: Map<string, number>,
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
      r: id === sel ? 18 : 10 + Math.min(5, Math.floor((degs.get(id) ?? 0) / 4)),
      act: id === sel,
      hit: hit.has(id),
      kind: node.kind,
      title: title(node),
      path: node.path,
      deg: degs.get(id) ?? 0,
      hop,
    })
  }

  return out
}

function layout(data: Graph, sel: string, q: string, allow: Set<Node["kind"]>, hop: number): View {
  const nodes = data.nodes.filter((node) => allow.has(node.kind))
  const map = new Map(nodes.map((node) => [node.id, node]))
  const low = q.trim().toLowerCase()
  const hit = new Set(
    low
      ? nodes
          .filter((node) => {
            const meta = node.meta ? JSON.stringify(node.meta) : ""
            return (
              node.title.toLowerCase().includes(low) ||
              node.id.toLowerCase().includes(low) ||
              (node.path ?? "").toLowerCase().includes(low) ||
              (node.summary ?? "").toLowerCase().includes(low) ||
              meta.toLowerCase().includes(low)
            )
          })
          .map((node) => node.id)
      : [],
  )

  const degs = new Map<string, number>()
  for (const edge of data.edges) {
    if (!map.has(edge.from) || !map.has(edge.to)) continue
    degs.set(edge.from, (degs.get(edge.from) ?? 0) + 1)
    degs.set(edge.to, (degs.get(edge.to) ?? 0) + 1)
  }

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
      const da = degs.get(a) ?? 0
      const db = degs.get(b) ?? 0
      return db - da || (map.get(a)?.title ?? "").localeCompare(map.get(b)?.title ?? "")
    })
  }

  const keep = new Set<string>()
  const max = 160
  for (const [id] of [...view.entries()].sort((a, b) => {
    const sa = a[1]
    const sb = b[1]
    return sa - sb || (degs.get(b[0]) ?? 0) - (degs.get(a[0]) ?? 0) || a[0].localeCompare(b[0])
  })) {
    keep.add(id)
    if (keep.size >= max) break
  }

  if (sel && map.has(sel)) keep.add(sel)
  for (const id of hit) keep.add(id)

  const cx = 360
  const cy = 260
  const placed = [
    ...place((groups.get(0) ?? []).filter((id) => keep.has(id)), 0, cx, cy, map, act, degs, hit, 0),
    ...Array.from({ length: hop }, (_, idx) => {
      const step = idx + 1
      const list = (groups.get(step) ?? []).filter((id) => keep.has(id))
      const gap = Math.max(140, 96 + step * 62)
      return place(list, gap, cx, cy, map, act, degs, hit, step)
    }).flat(),
    ...place((groups.get(hop + 1) ?? []).filter((id) => keep.has(id)), Math.max(320, 96 + (hop + 1) * 62), cx, cy, map, act, degs, hit, hop + 1),
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

function kindClass(kind: Node["kind"]) {
  if (kind === "wiki") return "bg-blue-900/40 text-blue-300"
  if (kind === "code") return "bg-emerald-900/40 text-emerald-300"
  if (kind === "symbol") return "bg-violet-900/40 text-violet-300"
  if (kind === "memory") return "bg-amber-900/40 text-amber-300"
  if (kind === "learned") return "bg-rose-900/40 text-rose-300"
  return "bg-slate-700 text-slate-300"
}

function Empty(props: { text: string }) {
  return <div class="p-6 text-14-regular text-text-weak">{props.text}</div>
}

export default function Knowledge() {
  const sdk = useSDK()
  const server = useServer()
  const params = useParams()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()
  const [query, setQuery] = createSignal("")
  const [tab, setTab] = createSignal<"wiki" | "graph">("wiki")
  const [pick, setPick] = createSignal<string>()
  const [tick, setTick] = createSignal(0)

  const dir = createMemo(() => decode64(params.dir) || sdk.directory)
  const api = (path: string, input?: RequestInit) => {
    const url = new URL(path, sdk.url)
    url.searchParams.set("directory", dir())
    const headers = new Headers(input?.headers)
    for (const [key, value] of Object.entries(auth(server))) headers.set(key, value)
    return fetch(url, {
      ...input,
      headers,
    }).then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return res.json()
    })
  }

  const [wiki, wikiActions] = createResource(
    () => [query(), tick()] as const,
    ([q]) => api(`/experimental/wiki${q ? `?search=${encodeURIComponent(q)}` : ""}`) as Promise<Wiki>,
  )
  const [graph, graphActions] = createResource(
    () => tick(),
    () => api("/experimental/graph") as Promise<Graph>,
  )
  const [page] = createResource(
    () => pick(),
    (id) => api(`/experimental/wiki/page?id=${encodeURIComponent(id)}`) as Promise<{ page: Page; content: string }>,
  )

  const pages = createMemo(() => wiki()?.pages ?? [])
  const graphData = createMemo(() => graph() ?? { nodes: [], edges: [], stats: { wiki: 0, code: 0, memory: 0, learned: 0, facts: 0 } })
  const [search, setSearch] = createSignal("")
  const [focus, setFocus] = createSignal("")
  const [hop, setHop] = createSignal(2)
  const [allow, setAllow] = createSignal<Set<Node["kind"]>>(new Set(kinds))
  const visible = createMemo(() => {
    const q = search().trim().toLowerCase()
    return graphData().nodes.filter((node) => {
      if (!allow().has(node.kind)) return false
      if (!q) return true
      const meta = node.meta ? JSON.stringify(node.meta) : ""
      return (
        node.title.toLowerCase().includes(q) ||
        node.id.toLowerCase().includes(q) ||
        (node.path ?? "").toLowerCase().includes(q) ||
        (node.summary ?? "").toLowerCase().includes(q) ||
        meta.toLowerCase().includes(q)
      )
    })
  })
  const view = createMemo(() => layout(graphData(), focus(), search(), allow(), hop()))
  const cur = createMemo(() => graphData().nodes.find((node) => node.id === view().act) ?? null)
  const outs = createMemo(() => graphData().edges.filter((edge) => edge.from === cur()?.id))
  const ins = createMemo(() => graphData().edges.filter((edge) => edge.to === cur()?.id))
  const selected = createMemo(() => pages().find((page) => page.id === pick()) ?? pages()[0])

  const rebuild = async () => {
    await Promise.all([
      api("/experimental/wiki/rebuild", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: true }),
      }),
      api("/experimental/codegraph/rebuild", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: true }),
      }),
    ])
    setTick((n) => n + 1)
    wikiActions.refetch()
    graphActions.refetch()
  }

  const draw = () => {
    const el = canvas()
    if (!el) return
    const ctx = el.getContext("2d")
    if (!ctx) return

    const box = el.getBoundingClientRect()
    const w = Math.max(1, box.width)
    const h = Math.max(1, box.height)
    const dpr = window.devicePixelRatio || 1

    el.width = Math.floor(w * dpr)
    el.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const scale = Math.min(w / 720, h / 520)
    const s = Math.max(0.42, scale)
    const ox = (w - 720 * s) / 2
    const oy = (h - 520 * s) / 2
    const on = (x: number, y: number) => ({ x: ox + x * s, y: oy + y * s })

    ctx.fillStyle = "#0b1220"
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = "rgba(15, 23, 42, 0.55)"
    for (let x = 0; x < w; x += 64 * s) {
      ctx.fillRect(x, 0, 1, h)
    }
    for (let y = 0; y < h; y += 64 * s) {
      ctx.fillRect(0, y, w, 1)
    }

    ctx.save()
    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(ox + 360 * s, oy + 260 * s, 112 * s, 0, Math.PI * 2)
    ctx.arc(ox + 360 * s, oy + 260 * s, 182 * s, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    for (const edge of view().edges) {
      const a = on(edge.a.x, edge.a.y)
      const b = on(edge.b.x, edge.b.y)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = edge.on ? "rgba(96, 165, 250, 0.92)" : "rgba(148, 163, 184, 0.18)"
      ctx.lineWidth = edge.on ? 2.2 : 1
      ctx.stroke()
    }

    const nodes = [...view().nodes].sort((a, b) => a.deg - b.deg)
    for (const node of nodes) {
      const p = on(node.x, node.y)
      const r = (node.r + 8) * s

      ctx.beginPath()
      ctx.fillStyle = node.act ? "rgba(59, 130, 246, 0.18)" : node.hit ? "rgba(59, 130, 246, 0.1)" : "rgba(15, 23, 42, 0.9)"
      ctx.strokeStyle = node.act ? "#38bdf8" : node.hit ? "rgba(96, 165, 250, 0.75)" : "rgba(148, 163, 184, 0.5)"
      ctx.lineWidth = node.act ? 2.5 : 1.15
      ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.beginPath()
      ctx.fillStyle = paint(node.kind)
      ctx.strokeStyle = node.act ? "#38bdf8" : paint(node.kind)
      ctx.lineWidth = 1.4
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = "#e2e8f0"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.font = "600 10px Inter, system-ui, sans-serif"
      ctx.fillText(short(node.title, node.act ? 18 : 14), p.x, p.y + r + 12)
      ctx.font = "500 8px Inter, system-ui, sans-serif"
      ctx.fillStyle = "rgba(226, 232, 240, 0.72)"
      ctx.fillText(short(node.kind === "code" && node.path ? note(node) : label(node.kind), 22), p.x, p.y + r + 23)
    }
  }

  createEffect(() => {
    tab()
    canvas()
    view()
    draw()
  })

  createEffect(() => {
    const el = canvas()
    if (!el) return
    const on = () => draw()
    window.addEventListener("resize", on)
    onCleanup(() => window.removeEventListener("resize", on))
  })

  onMount(() => {
    requestAnimationFrame(() => draw())
  })

  return (
    <main class="h-full min-h-0 bg-background-base text-text-base overflow-hidden">
      <div class="h-full min-h-0 flex flex-col">
        <div class="shrink-0 px-6 max-md:px-4 py-4 border-b border-border-weak-base flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <h1 class="text-18-medium text-text-strong">Knowledge</h1>
            <div class="text-12-regular text-text-weak truncate">{dir()}</div>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2 max-md:w-full max-md:justify-start">
            <Button variant={tab() === "wiki" ? "primary" : "ghost"} onClick={() => setTab("wiki")}>
              Wiki
            </Button>
            <Button variant={tab() === "graph" ? "primary" : "ghost"} onClick={() => setTab("graph")}>
              Graph
            </Button>
            <Button variant="ghost" onClick={rebuild}>
              Rebuild
            </Button>
          </div>
        </div>

        <Switch>
          <Match when={tab() === "wiki"}>
            <div class="flex-1 min-h-0 grid grid-cols-[minmax(18rem,24rem)_1fr] max-lg:grid-cols-1 overflow-hidden">
              <aside class="min-h-0 border-r border-border-weak-base flex flex-col">
                <div class="shrink-0 p-3 border-b border-border-weak-base">
                  <input
                    value={query()}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                    placeholder="Search wiki"
                    class="w-full h-9 px-3 rounded-md bg-surface-base border border-border-weak-base text-14-regular text-text-strong outline-none focus:border-border-strong-base"
                  />
                  <div class="mt-2 text-12-regular text-text-weak">
                    {wiki.loading ? "Loading" : `${wiki()?.total ?? 0} pages`}
                  </div>
                </div>
                <div class="flex-1 min-h-0 overflow-y-auto">
                  <Show when={pages().length > 0} fallback={<Empty text="No wiki pages found." />}>
                    <For each={pages()}>
                      {(page) => (
                        <button
                          type="button"
                          class="w-full text-left px-4 py-3 border-b border-border-weak-base hover:bg-surface-base-hover"
                          classList={{ "bg-surface-base": selected()?.id === page.id }}
                          onClick={() => setPick(page.id)}
                        >
                          <div class="text-14-medium text-text-strong truncate">{page.title}</div>
                          <div class="mt-1 text-12-regular text-text-weak truncate">{page.path}</div>
                        </button>
                      )}
                    </For>
                  </Show>
                </div>
              </aside>

              <section class="min-h-0 overflow-y-auto">
                <Show when={selected()} fallback={<Empty text="Select a page." />}>
                  {(item) => (
                    <article class="max-w-4xl px-8 py-6">
                      <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0">
                          <h2 class="text-24-medium text-text-strong">{item().title}</h2>
                          <div class="mt-1 text-12-regular text-text-weak">{item().path}</div>
                        </div>
                        <div class="text-12-medium text-text-weak shrink-0">{item().kind}</div>
                      </div>
                      <p class="mt-4 text-14-regular text-text-base leading-6">{item().summary || "No summary."}</p>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <For each={item().tags.slice(0, 12)}>
                          {(tag) => <span class="px-2 py-1 rounded bg-surface-base text-12-regular text-text-base">{tag}</span>}
                        </For>
                      </div>
                      <div class="mt-6 grid grid-cols-2 max-md:grid-cols-1 gap-3">
                        <div class="border border-border-weak-base rounded-md p-3">
                          <div class="text-12-medium text-text-weak">Links</div>
                          <div class="mt-1 text-18-medium text-text-strong">{item().links.length}</div>
                        </div>
                        <div class="border border-border-weak-base rounded-md p-3">
                          <div class="text-12-medium text-text-weak">Backlinks</div>
                          <div class="mt-1 text-18-medium text-text-strong">{item().backlinks.length}</div>
                        </div>
                      </div>
                      <Show when={page()?.page.id === item().id && page()?.content}>
                        <pre class="mt-6 p-4 rounded-md bg-surface-base text-12-regular text-text-base overflow-x-auto whitespace-pre-wrap leading-5">
                          {page()?.content}
                        </pre>
                      </Show>
                    </article>
                  )}
                </Show>
              </section>
            </div>
          </Match>

          <Match when={tab() === "graph"}>
            <div class="flex-1 min-h-0 grid grid-cols-[18rem_minmax(0,1fr)_18rem] max-xl:grid-cols-1 overflow-hidden">
              <aside class="min-h-0 border-r max-xl:border-r-0 max-xl:border-b border-border-weak-base overflow-y-auto p-4 max-md:p-3">
                <div class="space-y-4">
                  <div>
                    <div class="text-12-medium text-text-weak uppercase tracking-wide">Search</div>
                    <input
                      value={search()}
                      onInput={(e) => setSearch(e.currentTarget.value)}
                      placeholder="Find nodes"
                      class="mt-2 w-full h-9 px-3 rounded-md bg-surface-base border border-border-weak-base text-14-regular text-text-strong outline-none focus:border-border-strong-base"
                    />
                  </div>
                  <div>
                    <div class="text-12-medium text-text-weak uppercase tracking-wide">Kinds</div>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <For each={kinds}>
                        {(kind) => (
                          <button
                            class={`px-2 py-1 rounded-md text-12-medium border border-border-weak-base ${allow().has(kind) ? kindClass(kind) : "bg-surface-base text-text-weak"}`}
                            onClick={() => {
                              const next = new Set(allow())
                              if (next.has(kind) && next.size > 1) next.delete(kind)
                              else next.add(kind)
                              setAllow(next)
                            }}
                          >
                            {label(kind)}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                  <div>
                    <div class="text-12-medium text-text-weak uppercase tracking-wide">Hops</div>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <For each={[1, 2, 3, 4]}>
                        {(n) => (
                          <button
                            class={`px-2 py-1 rounded-md text-12-medium border border-border-weak-base ${hop() === n ? "bg-surface-base text-text-strong" : "bg-background-base text-text-weak"}`}
                            onClick={() => setHop(n)}
                          >
                            {n}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="border border-border-weak-base rounded-md p-3">
                      <div class="text-12-medium text-text-weak">Visible</div>
                      <div class="mt-1 text-18-medium text-text-strong">{visible().length}</div>
                    </div>
                    <div class="border border-border-weak-base rounded-md p-3">
                      <div class="text-12-medium text-text-weak">Edges</div>
                      <div class="mt-1 text-18-medium text-text-strong">{view().edges.length}</div>
                    </div>
                  </div>
                  <div class="space-y-2 max-h-[44vh] overflow-y-auto pr-1">
                    <For each={visible().slice(0, 50)}>
                      {(node) => (
                        <button
                          type="button"
                          onClick={() => setFocus(node.id)}
                          class={`w-full text-left rounded-md border p-3 transition-colors ${view().act === node.id ? "bg-surface-base border-border-strong-base" : "bg-background-base border-border-weak-base hover:border-border-strong-base"}`}
                        >
                          <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                              <div class="text-14-medium text-text-strong truncate">{node.title}</div>
                              <div class="text-12-regular text-text-weak truncate">{node.path || node.id}</div>
                            </div>
                            <span class={`px-2 py-1 rounded-md text-12-medium ${badge(node.kind)}`}>{label(node.kind)}</span>
                          </div>
                          <div class="mt-2 text-12-regular text-text-weak line-clamp-2">{node.summary || "No summary."}</div>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </aside>

              <section class="min-h-0 overflow-hidden p-4 max-md:p-2">
                <div class="h-full rounded-md border border-border-weak-base bg-surface-base overflow-hidden">
                  <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-weak-base">
                    <div class="min-w-0">
                      <div class="text-14-medium text-text-strong">Graph</div>
                      <div class="text-12-regular text-text-weak truncate">Focused around {cur()?.title || "selected node"}</div>
                    </div>
                    <div class="text-12-regular text-text-weak">{view().nodes.length} nodes</div>
                  </div>
                  <div class="flex flex-wrap gap-2 px-4 py-2 border-b border-border-weak-base bg-background-base/60">
                    <For each={kinds}>
                      {(kind) => (
                        <span class={`px-2 py-1 rounded-md text-11-medium ${badge(kind)}`}>{label(kind)}</span>
                      )}
                    </For>
                  </div>
                  <div class="grid grid-cols-[1fr_14rem] max-xl:grid-cols-1 min-h-0">
                    <div class="relative min-h-0 h-[72vh] max-lg:h-[60vh] overflow-hidden">
                      <div class="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-border-weak-base bg-background-base/90 px-3 py-2 text-11-medium text-text-weak shadow-sm">
                        <div class="text-text-strong">Canvas graph</div>
                        <div>{view().nodes.length} visible nodes</div>
                        <div>{cur()?.title || "Select a node"}</div>
                      </div>
                      <canvas
                        ref={(el) => {
                          setCanvas(el)
                          requestAnimationFrame(() => draw())
                        }}
                        class="size-full block cursor-pointer"
                        role="img"
                        aria-label="Knowledge graph"
                        onClick={(e) => {
                          const el = e.currentTarget
                          const box = el.getBoundingClientRect()
                          const w = Math.max(1, box.width)
                          const h = Math.max(1, box.height)
                          const s = Math.max(0.42, Math.min(w / 720, h / 520))
                          const ox = (w - 720 * s) / 2
                          const oy = (h - 520 * s) / 2
                          const x = e.clientX - box.left
                          const y = e.clientY - box.top

                          let best: { id: string; d: number } | null = null
                          for (const node of view().nodes) {
                            const nx = ox + node.x * s
                            const ny = oy + node.y * s
                            const d = Math.hypot(x - nx, y - ny)
                            const r = (node.r + 12) * s
                            if (d > r) continue
                            if (!best || d < best.d) best = { id: node.id, d }
                          }

                          if (best) setFocus(best.id)
                        }}
                      />
                    </div>
                    <div class="min-h-0 border-l max-xl:border-l-0 max-xl:border-t border-border-weak-base p-3 overflow-y-auto">
                      <div class="text-12-medium text-text-weak uppercase tracking-wide">Visible nodes</div>
                      <div class="mt-2 space-y-2">
                        <For each={view().nodes.slice(0, 24)}>
                          {(node) => (
                            <button
                              type="button"
                              class={`w-full text-left rounded-md border px-3 py-2 ${view().act === node.id ? "border-border-strong-base bg-surface-base" : "border-border-weak-base bg-background-base"}`}
                              onClick={() => setFocus(node.id)}
                            >
                              <div class="flex items-center justify-between gap-2">
                                <div class="min-w-0">
                                  <div class="text-12-medium text-text-strong truncate">{node.title}</div>
                                  <div class="text-11-regular text-text-weak truncate">{node.path || node.id}</div>
                                </div>
                                <span class={`px-2 py-1 rounded-md text-11-medium ${badge(node.kind)}`}>{label(node.kind)}</span>
                              </div>
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <aside class="min-h-0 border-l max-xl:border-l-0 max-xl:border-t border-border-weak-base overflow-y-auto p-4 max-md:p-3">
                <div class="space-y-4">
                  <div class="grid grid-cols-2 gap-2">
                    <For each={Object.entries(graphData().stats)}>
                      {([key, value]) => (
                        <div class="border border-border-weak-base rounded-md p-3">
                          <div class="text-12-medium text-text-weak capitalize">{key}</div>
                          <div class="mt-1 text-18-medium text-text-strong">{value}</div>
                        </div>
                      )}
                    </For>
                  </div>

                  <Show when={cur()} fallback={<div class="p-4 text-14-regular text-text-weak">Select a node to inspect its relationships.</div>}>
                    <div class="border border-border-weak-base rounded-md p-4 space-y-4">
                      <div>
                        <div class="text-18-medium text-text-strong">{cur()!.title}</div>
                        <div class="mt-1 text-12-regular text-text-weak truncate">{cur()!.path || cur()!.id}</div>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <span class={`px-2 py-1 rounded-md text-12-medium ${badge(cur()!.kind)}`}>{label(cur()!.kind)}</span>
                        <span class="px-2 py-1 rounded-md bg-surface-base text-12-medium text-text-weak">{ins().length} incoming</span>
                        <span class="px-2 py-1 rounded-md bg-surface-base text-12-medium text-text-weak">{outs().length} outgoing</span>
                      </div>
                      <Show when={cur()!.summary}>
                        <p class="text-14-regular text-text-base leading-6">{cur()!.summary}</p>
                      </Show>
                      <Show when={cur()!.meta && Object.keys(cur()!.meta ?? {}).length > 0}>
                        <div class="space-y-2">
                          <For each={Object.entries(cur()!.meta ?? {})}>
                            {([key, value]) => (
                              <div class="rounded-md border border-border-weak-base px-3 py-2 text-12-regular text-text-base">
                                <span class="text-text-weak">{key}</span>: <span>{String(value)}</span>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                      <Show when={cur()!.kind === "wiki"}>
                        <Button variant="ghost" onClick={() => { setTab("wiki"); setPick(cur()!.id); }}>
                          Open wiki note
                        </Button>
                      </Show>
                      <div>
                        <div class="text-12-medium text-text-weak uppercase tracking-wide">Incoming</div>
                        <div class="mt-2 flex flex-wrap gap-2">
                          <For each={ins().slice(0, 12)}>
                            {(edge) => {
                              const node = graphData().nodes.find((item) => item.id === edge.from)
                              return (
                                <button class="px-2 py-1 rounded-md bg-background-base border border-border-weak-base text-12-medium text-text-base hover:border-border-strong-base" onClick={() => node && setFocus(node.id)}>
                                  {node?.title || edge.from}
                                </button>
                              )
                            }}
                          </For>
                        </div>
                      </div>
                      <div>
                        <div class="text-12-medium text-text-weak uppercase tracking-wide">Outgoing</div>
                        <div class="mt-2 flex flex-wrap gap-2">
                          <For each={outs().slice(0, 12)}>
                            {(edge) => {
                              const node = graphData().nodes.find((item) => item.id === edge.to)
                              return (
                                <button class="px-2 py-1 rounded-md bg-background-base border border-border-weak-base text-12-medium text-text-base hover:border-border-strong-base" onClick={() => node && setFocus(node.id)}>
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
              </aside>
            </div>
          </Match>
        </Switch>
      </div>
    </main>
  )
}
