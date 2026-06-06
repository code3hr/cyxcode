import fs from "fs/promises"
import path from "path"
import type { MessageV2 } from "@/session/message-v2"
import { Codegraph } from "./codegraph"
import { LearnedPatterns } from "./learned"
import { Memory } from "./memory"
import { Wiki } from "./wiki"
import { CyxPaths } from "./paths"
import { listFacts } from "./recall/facts"
import { CyxWatch, type WatchAlert, type WatchEntry } from "./watch"

export type GraphKind = "wiki" | "code" | "symbol" | "memory" | "learned" | "concept" | "cyxwatch"

export type GraphNode = {
  id: string
  kind: GraphKind
  title: string
  path?: string
  summary?: string
  tags?: string[]
  meta?: Record<string, unknown>
}

export type GraphEdge = {
  from: string
  to: string
  type: string
}

export type GraphData = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    wiki: number
    code: number
    memory: number
    learned: number
    facts: number
    cyxwatch: number
  }
}

export type GraphOpts = {
  symbols?: boolean
}

export type FocusOpts = {
  id?: string
  q?: string
  hop?: number
  limit?: number
}

type Alias = Map<string, string>
type Rank = { node: GraphNode; score: number }
type Link = {
  edge: GraphEdge
  node: GraphNode
}

type Item = {
  id: string
  title: string
  path?: string
  summary?: string
  tags?: string[]
  kind: GraphKind
  meta?: Record<string, unknown>
}

type Cache = {
  at: number
  data?: GraphData
  task?: Promise<GraphData>
}

const ttl = 30_000
const cache = new Map<string, Cache>()

function norm(text: string): string {
  return text
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\.md$/i, "")
    .trim()
    .toLowerCase()
}

function base(text: string): string {
  return path.basename(text, path.extname(text)).toLowerCase()
}

function key(text: string): string[] {
  const out = new Set<string>()
  const clean = norm(text)
  if (!clean) return []
  out.add(clean)
  out.add(clean.replaceAll("/", " "))
  out.add(clean.replaceAll("/", "-"))
  out.add(clean.replaceAll("/", "_"))
  out.add(base(clean))
  return [...out].filter(Boolean)
}

function add(alias: Alias, item: Item, out: GraphNode[]): GraphNode {
  const node: GraphNode = {
    id: item.id,
    kind: item.kind,
    title: item.title,
    path: item.path,
    summary: item.summary,
    tags: item.tags,
    meta: item.meta,
  }

  out.push(node)
  for (const value of [item.id, item.path, item.title, item.summary, ...(item.tags ?? [])]) {
    if (!value) continue
    for (const k of key(value)) {
      if (!alias.has(k)) alias.set(k, node.id)
    }
  }

  return node
}

function by(alias: Alias, text: string): string | undefined {
  for (const k of key(text)) {
    const hit = alias.get(k)
    if (hit) return hit
  }
  return undefined
}

function aliasify(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function digest(text: string): string {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function concept(text: string): Item {
  const id = `concept:${aliasify(text) || "unknown"}`
  return {
    id,
    kind: "concept",
    title: text,
    summary: text,
  }
}

function join(nodes: Item[], alias: Alias, out: GraphNode[]) {
  for (const item of nodes) add(alias, item, out)
}

async function body(page: { kind: "doc" | "wiki"; path: string }): Promise<string> {
  const file = page.kind === "wiki"
    ? path.join(Wiki.basePath(), page.path)
    : path.join(CyxPaths.projectRoot(), page.path)
  return await fs.readFile(file, "utf-8").catch(() => "")
}

function refs(text: string): string[] {
  const out = new Set<string>()
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const raw = match[1]?.trim()
    if (!raw) continue
    out.add(raw)
  }
  for (const match of text.matchAll(/\b[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts|md)\b/g)) {
    const raw = match[0]?.trim()
    if (!raw) continue
    out.add(raw)
  }
  return [...out]
}

function extract(msgs: MessageV2.WithParts[]): string[] {
  const out = new Set<string>()
  const stop = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "has", "her",
    "was", "one", "our", "out", "this", "that", "with", "have", "from", "they", "been",
    "said", "each", "which", "their", "will", "other", "about", "many", "then", "them",
    "let", "run", "use", "try", "also", "just", "how", "its", "may", "new", "now", "old",
    "see", "way", "who", "did", "get", "got", "had", "him", "his", "she", "too", "any",
  ])

  for (const msg of msgs.slice(-5)) {
    for (const part of msg.parts) {
      if (part.type === "text" && !part.synthetic) {
        for (const word of part.text.split(/[\s,;:(){}[\]'"]+/)) {
          const clean = word.toLowerCase().trim()
          if (clean.length <= 2 || clean.length >= 50) continue
          if (!/^[a-zA-Z]/.test(clean)) continue
          if (stop.has(clean)) continue
          out.add(clean)
        }
      }

      if (part.type !== "tool" || part.state.status !== "completed") continue
      const input = part.state.input
      if (input?.file_path) {
        const fp = String(input.file_path)
        out.add(path.basename(fp).toLowerCase())
        out.add(path.basename(fp, path.extname(fp)).toLowerCase())
      }
      if (input?.pattern) out.add(String(input.pattern).toLowerCase())
      if (input?.command) {
        for (const bit of String(input.command).split(/\s+/).slice(0, 3)) {
          const clean = bit.toLowerCase().trim()
          if (clean.length > 2) out.add(clean)
        }
      }
    }
  }

  return [...out].filter(Boolean)
}

function score(node: GraphNode, key: string): number {
  const low = key.toLowerCase()
  let out = 0
  const hit = (text?: string) => !!text && text.toLowerCase().includes(low)
  if (hit(node.id)) out += 6
  if (hit(node.title)) out += 5
  if (hit(node.path)) out += 4
  if (hit(node.summary)) out += 3
  for (const tag of node.tags ?? []) if (tag.toLowerCase().includes(low)) out += 2
  return out
}

function rank(nodes: GraphNode[], keys: string[]): Rank[] {
  return nodes
    .map((node) => ({ node, score: keys.reduce((n, key) => n + score(node, key), 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.node.kind.localeCompare(b.node.kind) || a.node.title.localeCompare(b.node.title))
}

function uniq(edges: GraphEdge[]) {
  const seen = new Set<string>()
  return edges.filter((edge) => {
    const id = `${edge.from}|${edge.to}|${edge.type}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function label(text: string, max = 96): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 3)}...`
}

function title(entry: WatchEntry) {
  if (entry.path) return label(entry.path)
  if (entry.cmd) return label(entry.cmd)
  if (entry.host) return entry.host
  if (entry.prompt) return label(entry.prompt)
  return entry.kind
}

function target(raw: string, alias: Alias, nodes: GraphNode[], kind: string) {
  for (const k of key(raw)) {
    const hit = alias.get(k)
    if (hit && nodes.find((node) => node.id === hit)?.kind !== "cyxwatch") return hit
  }
  const id = `cyxwatch:${kind}:${digest(raw)}`
  if (!nodes.some((node) => node.id === id)) {
    add(alias, {
      id,
      kind: "cyxwatch",
      title: kind === "path" ? path.basename(raw) || label(raw) : label(raw),
      path: kind === "path" ? raw : undefined,
      summary: raw,
      tags: [kind],
      meta: { kind },
    }, nodes)
  }
  return id
}

function watch(events: WatchEntry[], alerts: WatchAlert[], alias: Alias, nodes: GraphNode[], edges: GraphEdge[]) {
  const seen = new Set(nodes.map((node) => node.id))
  const put = (item: Item) => {
    if (seen.has(item.id)) return item.id
    seen.add(item.id)
    add(alias, item, nodes)
    return item.id
  }

  for (const entry of events) {
    const id = put({
      id: `cyxwatch:event:${entry.id}`,
      kind: "cyxwatch",
      title: entry.kind,
      summary: title(entry),
      tags: [entry.kind, entry.decision ?? "allow", ...entry.flags],
      meta: {
        eventID: entry.id,
        ts: entry.ts,
        risk: entry.risk,
        decision: entry.decision,
        bytes: entry.bytes,
        method: entry.method,
      },
    })

    if (entry.sessionID) {
      const ses = put({
        id: `cyxwatch:session:${entry.sessionID}`,
        kind: "cyxwatch",
        title: `Session ${entry.sessionID}`,
        summary: entry.prompt,
        tags: ["session"],
        meta: { sessionID: entry.sessionID },
      })
      edges.push({ from: id, to: ses, type: "in_session" })
    }

    if (entry.messageID) {
      const msg = put({
        id: `cyxwatch:prompt:${entry.messageID}`,
        kind: "cyxwatch",
        title: "Prompt turn",
        summary: entry.prompt ?? entry.text,
        tags: ["prompt"],
        meta: {
          sessionID: entry.sessionID,
          messageID: entry.messageID,
        },
      })
      edges.push({ from: id, to: msg, type: "from_prompt" })
      if (entry.sessionID) edges.push({ from: msg, to: `cyxwatch:session:${entry.sessionID}`, type: "in_session" })
    }

    if (entry.path && !entry.kind.startsWith("network.")) {
      edges.push({ from: id, to: target(entry.path, alias, nodes, "path"), type: "touches" })
    }

    if (entry.cmd) {
      edges.push({ from: id, to: target(entry.cmd, alias, nodes, "command"), type: "runs" })
    }

    if (entry.host) {
      edges.push({ from: id, to: target(entry.host, alias, nodes, "host"), type: "contacts" })
    }
  }

  for (const note of alerts) {
    const id = put({
      id: `cyxwatch:alert:${note.id}`,
      kind: "cyxwatch",
      title: note.title,
      summary: note.summary,
      tags: [note.kind, note.decision, ...note.flags],
      meta: {
        alertID: note.id,
        eventID: note.eventID,
        ts: note.ts,
        risk: note.risk,
        decision: note.decision,
      },
    })
    edges.push({ from: id, to: `cyxwatch:event:${note.eventID}`, type: "raised_from" })
    if (note.sessionID) edges.push({ from: id, to: `cyxwatch:session:${note.sessionID}`, type: "in_session" })
    if (note.messageID) edges.push({ from: id, to: `cyxwatch:prompt:${note.messageID}`, type: "from_prompt" })
    if (note.path) edges.push({ from: id, to: target(note.path, alias, nodes, "path"), type: "touches" })
    if (note.cmd) edges.push({ from: id, to: target(note.cmd, alias, nodes, "command"), type: "runs" })
    if (note.host) edges.push({ from: id, to: target(note.host, alias, nodes, "host"), type: "contacts" })
  }
}

function links(data: GraphData, id: string): Link[] {
  const ref = new Map(data.nodes.map((node) => [node.id, node] as const))
  const out: Link[] = []
  for (const edge of data.edges) {
    if (edge.from !== id && edge.to !== id) continue
    const other = edge.from === id ? ref.get(edge.to) : ref.get(edge.from)
    if (!other) continue
    out.push({ edge, node: other })
  }
  return out
}

export namespace Graph {
  export async function build(opts: GraphOpts = {}): Promise<GraphData> {
    const key = opts.symbols === false ? "nosymbols" : "symbols"
    const now = Date.now()
    const hit = cache.get(key)
    if (hit?.data && now - hit.at < ttl) return hit.data
    if (hit?.task) return hit.task

    const task = buildFresh(opts).then((data) => {
      cache.set(key, { at: Date.now(), data })
      return data
    }).finally(() => {
      const item = cache.get(key)
      if (item?.task) cache.set(key, { at: item.at, data: item.data })
    })
    cache.set(key, { at: now, data: hit?.data, task })
    return task
  }

  async function buildFresh(opts: GraphOpts = {}): Promise<GraphData> {
    const [wi, ci, mi, li, fa, ev, wa] = await Promise.all([
      Wiki.readIndex(),
      Codegraph.readIndex(),
      Memory.readIndex(),
      LearnedPatterns.read(),
      Promise.resolve(listFacts()),
      CyxWatch.recent(120),
      CyxWatch.alerts(120),
    ])

    const alias: Alias = new Map()
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []

    join(
      wi.pages.map((page) => ({
        id: page.id,
        kind: "wiki" as const,
        title: page.title,
        path: page.path,
        summary: page.summary,
        tags: page.tags,
        meta: {
          links: page.links.length,
          backlinks: page.backlinks.length,
        },
      })),
      alias,
      nodes,
    )

    join(
      ci.files.map((file) => ({
        id: file.id,
        kind: "code" as const,
        title: file.title,
        path: file.path,
        summary: file.exports.length > 0 ? `Exports ${file.exports.join(", ")}` : undefined,
        tags: file.symbols.slice(0, 8),
        meta: {
          imports: file.imports.length,
          uses: file.uses.length,
          symbols: file.symbols.length,
        },
      })),
      alias,
      nodes,
    )

    if (opts.symbols ?? true) {
      join(
        ci.symbols.map((sym) => ({
          id: sym.id,
          kind: "symbol" as const,
          title: sym.name,
          path: ci.files.find((file) => file.id === sym.fileId)?.path,
          summary: sym.kind,
          meta: {
            fileId: sym.fileId,
            exported: sym.exported,
          },
        })),
        alias,
        nodes,
      )
    }

    join(
      mi.entries.map((item) => ({
        id: item.id,
        kind: "memory" as const,
        title: item.summary.slice(0, 80) || item.id,
        summary: item.summary,
        tags: item.tags,
        meta: {
          file: item.file,
          accessed: item.accessed,
          accessCount: item.accessCount,
        },
      })),
      alias,
      nodes,
    )

    join(
      li.approved.map((item) => {
        const p = (item as { generatedPattern?: { id: string; regex: string; category?: string; description?: string } }).generatedPattern ?? item
        return {
          id: p.id,
          kind: "learned" as const,
          title: p.description || p.id,
          summary: p.regex,
          tags: [p.category || "learned"],
          meta: {
            category: p.category || "learned",
          },
        }
      }),
      alias,
      nodes,
    )

    for (const page of wi.pages) {
      for (const to of page.links) {
        const hit = by(alias, to)
        if (hit) edges.push({ from: page.id, to: hit, type: "wikilink" })
      }
    }

    for (const file of ci.files) {
      for (const to of file.imports) edges.push({ from: file.id, to, type: "import" })
      for (const to of file.uses) edges.push({ from: file.id, to, type: "uses" })
    }

    if (opts.symbols ?? true) {
      for (const sym of ci.symbols) {
        edges.push({ from: sym.fileId, to: sym.id, type: "declares" })
      }
    }

    for (const item of mi.entries) {
      for (const tag of item.tags) {
        const id = by(alias, tag) ?? addConcept(tag, alias, nodes)
        edges.push({ from: item.id, to: id, type: "tag" })
      }
    }

    for (const item of li.approved) {
      const p = (item as { generatedPattern?: { id: string; regex: string; category?: string; description?: string } }).generatedPattern ?? item
      if (p.category) {
        const id = addConcept(p.category, alias, nodes)
        edges.push({ from: p.id, to: id, type: "category" })
      }
    }

    for (const fact of fa) {
      const a = by(alias, fact.subject) ?? addConcept(fact.subject, alias, nodes)
      const b = by(alias, fact.object) ?? addConcept(fact.object, alias, nodes)
      edges.push({ from: a, to: b, type: fact.predicate })
    }

    watch(ev, wa, alias, nodes, edges)

    const ref = await Promise.all(wi.pages.map(async (page) => {
      const text = await body(page)
      if (!text) return []
      const seen = new Set<string>()
      const out: GraphEdge[] = []

      for (const raw of refs(text)) {
        const hit = by(alias, raw)
        if (!hit || hit === page.id || seen.has(hit)) continue
        seen.add(hit)
        out.push({ from: page.id, to: hit, type: "references" })
      }
      return out
    }))
    edges.push(...ref.flat())

    return {
      nodes,
      edges: uniq(edges),
      stats: {
        wiki: wi.pages.length,
        code: ci.files.length,
        memory: mi.entries.length,
        learned: li.approved.length,
        facts: fa.length,
        cyxwatch: ev.length + wa.length,
      },
    }
  }

  export function focus(data: GraphData, opts: FocusOpts): GraphData {
    const limit = Math.max(20, Math.min(opts.limit ?? 180, 500))
    const hop = Math.max(1, Math.min(opts.hop ?? 2, 4))
    const ref = new Map(data.nodes.map((node) => [node.id, node]))
    const q = opts.q?.trim().toLowerCase() ?? ""
    const hits = q ? rank(data.nodes, [q]).map((item) => item.node.id) : []
    const act = opts.id && ref.has(opts.id)
      ? opts.id
      : hits[0] ?? data.nodes.find((node) => node.kind === "wiki")?.id ?? data.nodes[0]?.id ?? ""
    if (!act) return { ...data, nodes: [], edges: [] }

    const adj = new Map<string, Set<string>>()
    const degree = new Map<string, number>()
    for (const edge of data.edges) {
      if (!ref.has(edge.from) || !ref.has(edge.to)) continue
      const a = adj.get(edge.from) ?? new Set<string>()
      a.add(edge.to)
      adj.set(edge.from, a)
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1)

      const b = adj.get(edge.to) ?? new Set<string>()
      b.add(edge.from)
      adj.set(edge.to, b)
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1)
    }

    const dist = new Map<string, number>([[act, 0]])
    const queue = [act]
    for (let i = 0; i < queue.length; i++) {
      if (dist.size >= limit * 3) break
      const id = queue[i]!
      const step = dist.get(id) ?? 0
      if (step >= hop) continue
      for (const next of adj.get(id) ?? []) {
        if (dist.has(next)) continue
        dist.set(next, step + 1)
        queue.push(next)
        if (dist.size >= limit * 3) break
      }
    }

    for (const id of hits.slice(0, limit)) {
      if (ref.has(id) && !dist.has(id)) dist.set(id, hop + 1)
    }

    const keep = new Set(
      Array.from(dist.keys())
        .sort((a, b) => {
          if (a === act) return -1
          if (b === act) return 1
          return (dist.get(a) ?? 0) - (dist.get(b) ?? 0) || (degree.get(b) ?? 0) - (degree.get(a) ?? 0)
        })
        .slice(0, limit),
    )

    return {
      ...data,
      nodes: data.nodes.filter((node) => keep.has(node.id)),
      edges: data.edges.filter((edge) => keep.has(edge.from) && keep.has(edge.to)),
    }
  }

  export function query(data: GraphData, keys: string[]): GraphNode[] {
    if (keys.length === 0) return []
    return rank(data.nodes, keys).map((item) => item.node)
  }

  export async function relevant(msgs: MessageV2.WithParts[]): Promise<string[]> {
    const keys = extract(msgs)
    if (keys.length === 0) return []

    const data = await build()
    if (data.nodes.length === 0) return []

    const nodes = rank(data.nodes, keys).slice(0, 4)
    if (nodes.length === 0) return []

    const out: string[] = []

    for (const item of nodes) {
      const edge = links(data, item.node.id).slice(0, 6)
      const rel = edge.map((item) => {
        const label = item.node.title || item.node.id
        return `${item.edge.type}: ${label}`
      })

      out.push(
        [
          `<graph-node id="${item.node.id}" kind="${item.node.kind}" title="${item.node.title}">`,
          item.node.path ? `Path: ${item.node.path}` : "",
          item.node.summary ? `Summary: ${item.node.summary}` : "",
          item.node.tags?.length ? `Tags: ${item.node.tags.join(", ")}` : "",
          rel.length ? `Related: ${rel.join(", ")}` : "",
          `</graph-node>`,
        ]
          .filter(Boolean)
          .join("\n"),
      )
    }

    return out
  }
}

function addConcept(text: string, alias: Alias, nodes: GraphNode[]): string {
  const id = concept(text).id
  if (!alias.has(norm(text))) {
    const node = concept(text)
    add(alias, node, nodes)
  }
  return id
}
