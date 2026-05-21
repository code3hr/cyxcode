import fs from "fs/promises"
import path from "path"
import matter from "gray-matter"
import { Log } from "@/util/log"
import { Hash } from "@/util/hash"
import { ConfigMarkdown } from "@/config/markdown"
import { CyxPaths } from "./paths"
import { redactSecrets } from "./audit"
import { CyxWatch } from "./watch"
import { embedBatch, isDisabled } from "./recall/embedder"
import { upsertVector, bumpAccessBySourceId } from "./recall/db"
import type { MessageV2 } from "@/session/message-v2"

const log = Log.create({ service: "cyxcode-wiki" })

const MAX_TEXT = 4000
const MAX_CTX = 3

export type WikiPage = {
  id: string
  path: string
  kind: "doc" | "wiki"
  title: string
  summary: string
  tags: string[]
  links: string[]
  backlinks: string[]
  hash: string
  created: number
  modified: number
  accessed: number
  accessCount: number
}

export type WikiIndex = {
  version: 1
  pages: WikiPage[]
}

export type WikiNode = {
  id: string
  path: string
  kind: WikiPage["kind"]
  title: string
}

export type WikiEdge = {
  from: string
  to: string
  type: "wikilink"
}

export type WikiGraph = {
  nodes: WikiNode[]
  edges: WikiEdge[]
}

export type WikiCreate = {
  title: string
  body?: string
  tags?: string[]
}

export type WikiWrite = WikiCreate & {
  file: string
}

const g = globalThis as any
if (!g.__cyxcode_wiki_write) g.__cyxcode_wiki_write = Promise.resolve()
let writeLock: Promise<void> = g.__cyxcode_wiki_write

function syncLock(next: Promise<void>): Promise<void> {
  g.__cyxcode_wiki_write = next
  writeLock = next
  return next
}

function base(): string {
  return CyxPaths.wikiDir()
}

function indexPath(): string {
  return path.join(base(), "index.json")
}

function norm(text: string): string {
  return text
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\.md$/i, "")
    .trim()
    .toLowerCase()
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function exists(file: string): Promise<boolean> {
  return await fs.access(file).then(() => true, () => false)
}

async function note(title: string): Promise<string> {
  const dir = base()
  await fs.mkdir(dir, { recursive: true })

  const root = slug(title) || "note"
  let file = path.join(dir, `${root}.md`)
  let n = 2

  while (await exists(file)) {
    file = path.join(dir, `${root}-${n}.md`)
    n++
  }

  return file
}

function render(opts: WikiCreate) {
  return matter.stringify(
    [`# ${opts.title}`, opts.body?.trim() || ""].filter(Boolean).join("\n\n"),
    {
      title: opts.title,
      tags: opts.tags ?? [],
    },
  )
}

function strip(text: string): string {
  return text
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/^#\s+.+\n?/, "")
    .trim()
}

function rootId(file: string): string {
  const root = CyxPaths.projectRoot()
  const rel = path.relative(root, file).replaceAll("\\", "/")
  const id = rel.replace(/\.md$/i, "")
  if (rel.startsWith(".cyxcode/")) return id.slice(".cyxcode/".length)
  if (rel.startsWith(".opencode/")) return id.slice(".opencode/".length)
  return id
}

function kind(file: string): WikiPage["kind"] {
  const rel = path.relative(CyxPaths.projectRoot(), file).replaceAll("\\", "/")
  if (rel.startsWith(".cyxcode/wiki/") || rel.startsWith(".opencode/wiki/")) return "wiki"
  return "doc"
}

function full(page: Pick<WikiPage, "path" | "kind">): string {
  if (page.kind === "wiki") return path.join(CyxPaths.projectDir(), page.path)
  return path.join(CyxPaths.projectRoot(), page.path)
}

function isHidden(file: string): boolean {
  const rel = path.relative(CyxPaths.projectRoot(), file).replaceAll("\\", "/")
  if (rel.includes("/node_modules/") || rel.startsWith("node_modules/")) return true
  if (rel.includes("/.git/") || rel.startsWith(".git/")) return true
  if (rel.startsWith(".cyxcode/")) return !rel.startsWith(".cyxcode/wiki/")
  if (rel.startsWith(".opencode/")) return !rel.startsWith(".opencode/wiki/")
  return false
}

function link(raw: string): string {
  return norm(raw.split("|")[0].split("#")[0] ?? raw)
}

function links(text: string): string[] {
  const out = new Set<string>()
  for (const match of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const raw = link(match[1] ?? "")
    if (raw) out.add(raw)
  }
  return [...out]
}

function title(data: Record<string, unknown>, text: string, file: string): string {
  const front = typeof data.title === "string" ? data.title.trim() : ""
  if (front) return front
  const head = text.match(/^#\s+(.+)$/m)?.[1]?.trim()
  if (head) return head
  return path.basename(file, path.extname(file)).replace(/[-_]+/g, " ").trim()
}

function summary(text: string): string {
  const clean = text
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/^#.+$/m, "")
    .trim()

  if (!clean) return ""

  const para = clean
    .split(/\n\s*\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .find((line) => line.length > 0)

  return (para ?? clean).slice(0, 240)
}

function tags(page: Pick<WikiPage, "path" | "title" | "summary">): string[] {
  const out = new Set<string>()
  const add = (text: string) => {
    for (const word of text.split(/[\s./\\:_-]+/)) {
      const low = word.toLowerCase().trim()
      if (low.length < 3) continue
      out.add(low)
    }
  }
  add(page.path)
  add(page.title)
  add(page.summary)
  return [...out].slice(0, 16)
}

function keys(page: WikiPage): string[] {
  const out = new Set<string>()
  const stem = path.basename(page.path, path.extname(page.path))
  out.add(norm(page.id))
  out.add(norm(page.path))
  out.add(norm(stem))
  out.add(slug(page.title))
  out.add(slug(stem))
  out.add(path.basename(page.path).toLowerCase())
  return [...out].filter(Boolean)
}

function map(pages: WikiPage[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const page of pages) {
    for (const key of keys(page)) {
      if (!out.has(key)) out.set(key, page.id)
    }
  }
  return out
}

function score(page: WikiPage, key: string): number {
  const low = key.toLowerCase()
  let n = 0
  const hit = (text: string) => text.toLowerCase().includes(low)
  if (hit(page.id)) n += 5
  if (hit(page.title)) n += 5
  if (hit(page.summary)) n += 2
  for (const tag of page.tags) if (tag.includes(low) || low.includes(tag)) n += 1
  for (const l of page.links) if (l.includes(low)) n += 1
  for (const l of page.backlinks) if (l.includes(low)) n += 1
  return n
}

function extract(msgs: MessageV2.WithParts[]): string[] {
  const out = new Set<string>()
  const recent = msgs.slice(-5)
  for (const msg of recent) {
    for (const part of msg.parts) {
      if (part.type === "text" && !part.synthetic) {
        for (const word of part.text.split(/[\s,;:(){}[\]'"]+/)) {
          const low = word.toLowerCase().trim()
          if (low.length < 3) continue
          out.add(low)
        }
      }
      if (part.type === "tool" && part.state.status === "completed") {
        const input = part.state.input
        if (input?.file_path) {
          const fp = String(input.file_path)
          out.add(path.basename(fp).toLowerCase())
          out.add(path.basename(fp, path.extname(fp)).toLowerCase())
        }
      }
    }
  }
  return [...out]
}

async function scan(): Promise<string[]> {
  const root = CyxPaths.projectRoot()
  const files = new Set<string>()

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (isHidden(full)) continue
        await walk(full)
        continue
      }
      if (!entry.isFile()) continue
      if (!full.toLowerCase().endsWith(".md")) continue
      if (isHidden(full)) continue
      files.add(full)
    }
  }

  await walk(root)

  const wiki = base()
  if (wiki && wiki !== root) {
    await walk(wiki)
  }

  return [...files]
}

async function read(file: string, prev?: WikiPage): Promise<WikiPage | null> {
  const stat = await fs.stat(file).catch(() => null)
  if (!stat) return null

  const md = await ConfigMarkdown.parse(file).catch(() => undefined)
  if (!md) return null

  const text = md.content.trim()
  const id = rootId(file)
  const rel = path.relative(CyxPaths.projectRoot(), file).replaceAll("\\", "/")
  const p = rel.startsWith(".cyxcode/") ? rel.slice(".cyxcode/".length) : rel.startsWith(".opencode/") ? rel.slice(".opencode/".length) : rel
  const page: WikiPage = {
    id,
    path: p,
    kind: kind(file),
    title: title(md.data as Record<string, unknown>, text, file),
    summary: summary(text),
    tags: [],
    links: links(text),
    backlinks: prev?.backlinks ?? [],
    hash: Hash.fast(text),
    created: stat.birthtimeMs || stat.mtimeMs,
    modified: stat.mtimeMs,
    accessed: prev?.accessed ?? stat.mtimeMs,
    accessCount: prev?.accessCount ?? 0,
  }
  page.tags = tags(page)
  return page
}

async function write(idx: WikiIndex): Promise<void> {
  await syncLock(
    writeLock.then(async () => {
      await fs.mkdir(base(), { recursive: true })
      await fs.writeFile(indexPath(), JSON.stringify(idx, null, 2))
    }).catch((err) => log.warn("Failed to write wiki index", { error: err })),
  )
}

export namespace Wiki {
  export function basePath(): string {
    return base()
  }

  export function file(page: Pick<WikiPage, "path" | "kind">): string {
    return full(page)
  }

  export async function readIndex(): Promise<WikiIndex> {
    const content = await fs.readFile(indexPath(), "utf-8").catch(() => "")
    if (!content) return { version: 1, pages: [] }
    try {
      return JSON.parse(content) as WikiIndex
    } catch {
      return { version: 1, pages: [] }
    }
  }

  export async function writeIndex(idx: WikiIndex): Promise<void> {
    await write(idx)
  }

  export async function rebuild(opts: { force?: boolean } = {}): Promise<{ pages: number; indexed: number; links: number; errors: number }> {
    const prev = await readIndex()
    const old = new Map(prev.pages.map((page) => [page.id, page]))
    const raw = await scan()
    const pages: WikiPage[] = []
    let errors = 0

    for (const file of raw) {
      const page = await read(file, old.get(rootId(file)))
      if (!page) {
        errors++
        continue
      }
      pages.push(page)
    }

    const ref = map(pages)
    const links = new Map<string, Set<string>>()
    for (const page of pages) {
      for (const rawLink of page.links) {
        const to = ref.get(rawLink) ?? ref.get(slug(rawLink)) ?? ref.get(path.basename(rawLink).toLowerCase())
        if (!to || to === page.id) continue
        const set = links.get(to) ?? new Set<string>()
        set.add(page.id)
        links.set(to, set)
      }
    }

    for (const page of pages) {
      page.backlinks = [...(links.get(page.id) ?? new Set<string>())].sort()
      const oldPage = old.get(page.id)
      if (oldPage) {
        page.accessed = oldPage.accessed
        page.accessCount = oldPage.accessCount
      }
    }

    const idx: WikiIndex = { version: 1, pages: pages.sort((a, b) => a.title.localeCompare(b.title) || a.path.localeCompare(b.path)) }
    await write(idx)

    if (isDisabled()) {
      return { pages: pages.length, indexed: 0, links: [...links.values()].reduce((n, set) => n + set.size, 0), errors }
    }

    const changed = opts.force ? pages : pages.filter((page) => old.get(page.id)?.hash !== page.hash)
    if (changed.length === 0) {
      return { pages: pages.length, indexed: 0, links: [...links.values()].reduce((n, set) => n + set.size, 0), errors }
    }

    const texts = changed.map((page) => {
      const body = redactSecrets(
        [
          `# ${page.title}`,
          page.summary,
          page.links.length > 0 ? `Links: ${page.links.join(", ")}` : "",
          page.backlinks.length > 0 ? `Backlinks: ${page.backlinks.join(", ")}` : "",
          "",
          page.path,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      return body.slice(0, MAX_TEXT)
    })

    let vecs: Float32Array[]
    try {
      vecs = await embedBatch(texts)
    } catch (err) {
      log.warn("Failed to embed wiki pages", { error: err })
      return { pages: pages.length, indexed: 0, links: [...links.values()].reduce((n, set) => n + set.size, 0), errors: changed.length }
    }

    for (let i = 0; i < changed.length; i++) {
      try {
        upsertVector({
          source: "wiki",
          sourceId: changed[i].id,
          text: texts[i],
          embedding: vecs[i],
          meta: {
            path: changed[i].path,
            title: changed[i].title,
            links: changed[i].links,
            backlinks: changed[i].backlinks,
            kind: changed[i].kind,
          },
          createdAt: changed[i].created,
        })
      } catch (err) {
        errors++
        log.warn("Failed to index wiki page", { id: changed[i].id, error: err })
      }
    }

    return {
      pages: pages.length,
      indexed: Math.max(0, changed.length - errors),
      links: [...links.values()].reduce((n, set) => n + set.size, 0),
      errors,
    }
  }

  export function graph(idx: WikiIndex): WikiGraph {
    const nodes = idx.pages.map((page) => ({
      id: page.id,
      path: page.path,
      kind: page.kind,
      title: page.title,
    }))
    const edges: WikiEdge[] = []
    const ref = map(idx.pages)
    for (const page of idx.pages) {
      for (const raw of page.links) {
        const to = ref.get(raw) ?? ref.get(slug(raw)) ?? ref.get(path.basename(raw).toLowerCase())
        if (!to || to === page.id) continue
        edges.push({ from: page.id, to, type: "wikilink" })
      }
    }
    return { nodes, edges }
  }

  export function query(keys: string[], pages: WikiPage[]): WikiPage[] {
    if (keys.length === 0) return []
    return pages
      .map((page) => ({ page, score: keys.reduce((n, key) => n + score(page, key), 0) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.page.accessCount - a.page.accessCount || b.page.modified - a.page.modified)
      .map((item) => item.page)
  }

  export async function relevant(msgs: MessageV2.WithParts[]): Promise<string[]> {
    const idx = await readIndex()
    if (idx.pages.length === 0) return []

    const keys = extract(msgs)
    const pages = query(keys, idx.pages)
    if (pages.length === 0) return []

    const out: string[] = []
    const now = Date.now()

    for (const page of pages.slice(0, MAX_CTX)) {
      const text = await fs.readFile(full(page), "utf-8").catch(() => "")
      const body = text.trim().slice(0, MAX_TEXT)
      if (!body) continue
      void CyxWatch.memory({
        action: "read",
        source: full(page),
        bytes: body.length,
      }).catch(() => {})

      out.push(
        [
          `<wiki-note path="${page.path}" title="${page.title}">`,
          `Summary: ${page.summary}`,
          page.links.length > 0 ? `Links: ${page.links.join(", ")}` : "",
          page.backlinks.length > 0 ? `Backlinks: ${page.backlinks.join(", ")}` : "",
          "",
          body,
          `</wiki-note>`,
        ]
          .filter(Boolean)
          .join("\n"),
      )

      page.accessed = now
      page.accessCount++
      bumpAccessBySourceId("wiki", page.id)
    }

    if (out.length > 0) {
      void CyxWatch.memory({
        action: "retrieve",
        source: "wiki:relevant",
        bytes: out.reduce((sum, row) => sum + row.length, 0),
        count: out.length,
      }).catch(() => {})
      void CyxWatch.memory({
        action: "send",
        source: "wiki:prompt-context",
        bytes: out.reduce((sum, row) => sum + row.length, 0),
        count: out.length,
      }).catch(() => {})
      const current = idx.pages.map((page) => {
        const match = pages.find((item) => item.id === page.id)
        return match ?? page
      })
      await write({ version: 1, pages: current })
    }

    return out
  }

  export async function get(id: string): Promise<WikiPage | undefined> {
    const idx = await readIndex()
    return idx.pages.find((page) => page.id === id)
  }

  export async function create(opts: WikiCreate): Promise<WikiPage> {
    const file = await note(opts.title)
    await fs.writeFile(file, render(opts))
    await rebuild({ force: true })

    const page = await get(rootId(file))
    if (!page) {
      throw new Error("failed to create wiki note")
    }

    return page
  }

  export async function upsert(opts: WikiCreate & { id?: string }): Promise<WikiPage> {
    const idx = await readIndex()
    const hit = opts.id
      ? idx.pages.find((page) => page.id === opts.id || page.path === opts.id)
      : idx.pages.find((page) => page.title === opts.title)

    if (hit) return await update(hit.id, opts)
    return await create(opts)
  }

  export async function update(id: string, opts: WikiCreate): Promise<WikiPage> {
    const page = await get(id)
    if (!page) {
      throw new Error("wiki page not found")
    }

    const file = full(page)
    await fs.writeFile(file, render(opts))
    await rebuild({ force: true })

    const next = await get(id)
    if (!next) {
      throw new Error("failed to update wiki note")
    }

    return next
  }

  export async function rename(id: string, title: string): Promise<WikiPage> {
    const page = await get(id)
    if (!page) {
      throw new Error("wiki page not found")
    }

    const file = full(page)
    const md = await ConfigMarkdown.parse(file).catch(() => undefined)
    const body = strip(md?.content ?? "")
    const tags = Array.isArray(md?.data?.tags)
      ? md?.data?.tags.filter((tag): tag is string => typeof tag === "string")
      : page.tags

    await fs.writeFile(file, render({ title, body, tags }))
    await rebuild({ force: true })

    const next = await get(id)
    if (!next) {
      throw new Error("failed to rename wiki note")
    }

    return next
  }

  export async function remove(id: string): Promise<void> {
    const page = await get(id)
    if (!page) {
      throw new Error("wiki page not found")
    }

    if (page.kind !== "wiki") {
      throw new Error("can only delete wiki notes")
    }

    const file = full(page)
    await fs.unlink(file).catch(() => {})
    await rebuild({ force: true })
  }
}
