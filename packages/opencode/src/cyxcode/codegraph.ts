import fs from "fs/promises"
import type { Stats } from "fs"
import path from "path"
import { Hash } from "@/util/hash"
import { CyxPaths } from "./paths"

const ext = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"])
const dir = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", "target", "vendor"])
const alias = "@/"

export type CodeKind = "file" | "symbol"

export type CodeFile = {
  id: string
  path: string
  kind: "file"
  title: string
  hash: string
  imports: string[]
  uses: string[]
  exports: string[]
  symbols: string[]
  modified: number
}

export type CodeSymbol = {
  id: string
  fileId: string
  name: string
  kind: string
  exported: boolean
}

export type CodeNode = {
  id: string
  path: string
  kind: CodeKind
  title: string
}

export type CodeEdge = {
  from: string
  to: string
  type: "import" | "declares" | "uses"
}

export type CodeGraph = {
  nodes: CodeNode[]
  edges: CodeEdge[]
}

export type CodeIndex = {
  version: 1
  files: CodeFile[]
  symbols: CodeSymbol[]
}

type Item = {
  file: string
  id: string
  text: string
  stat: Stats
  imports: Array<{ source: string; names: string[]; def: boolean }>
  locals: Array<{ name: string; kind: string }>
  exports: Set<string>
  default: boolean
}

const g = globalThis as { __cyxcode_codegraph_write?: Promise<void> }
if (!g.__cyxcode_codegraph_write) g.__cyxcode_codegraph_write = Promise.resolve()
let lock = g.__cyxcode_codegraph_write

function sync(next: Promise<void>): Promise<void> {
  g.__cyxcode_codegraph_write = next
  lock = next
  return next
}

function root(): string {
  return CyxPaths.projectRoot()
}

function base(): string {
  return CyxPaths.codegraphDir()
}

function file(): string {
  return path.join(base(), "index.json")
}

function id(file: string): string {
  return path.relative(root(), file).replaceAll("\\", "/").replace(/\.[^.]+$/i, "")
}

function name(file: string): string {
  const stem = path.basename(file, path.extname(file))
  return stem.replace(/[-_]+/g, " ").trim() || stem
}

function clean(text: string): string {
  return text
    .replace(/(?:api[_-]?key|token|secret|password)\s*[=:]\s*["']?([^\s"']+)/gi, "$1=[REDACTED]")
    .replace(/sk-[a-zA-Z0-9]{32,}/g, "[REDACTED]")
    .slice(0, 5000)
}

function code(file: string): boolean {
  return ext.has(path.extname(file).toLowerCase())
}

function skip(file: string): boolean {
  const rel = path.relative(root(), file).replaceAll("\\", "/")
  const parts = rel.split("/")
  return parts.some((part) => dir.has(part) || (part.startsWith(".") && part.length > 1))
}

function top(text: string): Array<{ name: string; kind: string }> {
  const out: Array<{ name: string; kind: string }> = []
  const seen = new Set<string>()
  const add = (name: string, kind: string) => {
    const key = `${kind}:${name}`
    if (!name || seen.has(key)) return
    seen.add(key)
    out.push({ name, kind })
  }

  const re = [
    [/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/gm, "function"],
    [/^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/gm, "class"],
    [/^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\b/gm, "interface"],
    [/^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\b/gm, "type"],
    [/^\s*(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)\b/gm, "enum"],
    [/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/gm, "const"],
  ] as const

  for (const [rx, kind] of re) {
    for (const m of text.matchAll(rx)) {
      add(m[1] ?? "", kind)
    }
  }

  return out
}

function parts(text: string): Array<{ source: string; names: string[]; def: boolean }> {
  const out: Array<{ source: string; names: string[]; def: boolean }> = []
  const re = /^\s*(import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm

  for (const m of text.matchAll(re)) {
    const raw = (m[2] ?? "").trim()
    const head = raw.startsWith("type ") ? raw.slice(5).trim() : raw
    const source = m[3] ?? ""
    const names: string[] = []
    let def = false

    if (head.startsWith("*")) {
      out.push({ source, names, def })
      continue
    }

    const body = head.startsWith("{") ? head.slice(1, head.lastIndexOf("}")) : head
    const bits = body.split(",").map((item) => item.trim()).filter(Boolean)
    for (const bit of bits) {
      const [left, right] = bit.split(/\s+as\s+/i).map((item) => item.trim())
      if (left) names.push(left)
      if (!head.startsWith("{") && left && !right) def = true
    }

    if (!head.startsWith("{")) {
      def = !head.includes("{")
      if (head.includes("{")) def = true
    }

    out.push({ source, names, def })
  }

  return out
}

function exported(text: string, local: Array<{ name: string; kind: string }>): Set<string> {
  const out = new Set<string>()
  const add = (name: string) => {
    if (name) out.add(name)
  }

  if (/^\s*export\s+default\b/m.test(text)) add("default")

  for (const m of text.matchAll(/^\s*export\s*\{([\s\S]*?)\}/gm)) {
    const body = m[1] ?? ""
    for (const bit of body.split(",").map((item) => item.trim()).filter(Boolean)) {
      const [left] = bit.split(/\s+as\s+/i).map((item) => item.trim())
      add(left ?? "")
    }
  }

  for (const item of local) {
    if (new RegExp(`^\\s*export\\s+.*\\b${item.name}\\b`, "m").test(text)) {
      add(item.name)
      continue
    }
    if (new RegExp(`^\\s*export\\s*\\{[\\s\\S]*\\b${item.name}\\b`, "m").test(text)) add(item.name)
  }

  return out
}

function title(file: string): string {
  return name(file)
}

async function rootFile(spec: string, file: string): Promise<string | null> {
  if (spec.startsWith(alias)) {
    return await probe(path.join(root(), "src", spec.slice(alias.length)))
  }
  if (spec.startsWith("/")) {
    return await probe(path.join(root(), spec.slice(1)))
  }
  if (!spec.startsWith(".")) return null
  return await probe(path.resolve(path.dirname(file), spec))
}

async function probe(base: string): Promise<string | null> {
  const list = new Set<string>([base])
  if (!path.extname(base)) {
    for (const item of ext) {
      list.add(base + item)
      list.add(path.join(base, "index" + item))
    }
  }

  for (const item of list) {
    const stat = await fs.stat(item).catch(() => null)
    if (!stat || !stat.isFile()) continue
    if (skip(item) || !code(item)) continue
    return path.relative(root(), item).replaceAll("\\", "/")
  }

  return null
}

async function walk(dir: string, out: string[]): Promise<void> {
  const items = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const item of items) {
    const full = path.join(dir, item.name)
    if (item.isDirectory()) {
      if (skip(full)) continue
      await walk(full, out)
      continue
    }
    if (item.isFile() && code(full) && !skip(full)) out.push(full)
  }
}

async function scan(): Promise<string[]> {
  const out: string[] = []
  await walk(root(), out)
  return out
}

async function read(file: string): Promise<Item | null> {
  const stat = await fs.stat(file).catch(() => null)
  if (!stat || !stat.isFile()) return null

  const text = await fs.readFile(file, "utf-8").catch(() => "")
  if (!text) return null

  const local = top(text)
  return {
    file,
    id: id(file),
    text: clean(text),
    stat,
    imports: parts(text),
    locals: local,
    exports: exported(text, local),
    default: /^\s*export\s+default\b/m.test(text),
  }
}

async function write(data: CodeIndex): Promise<void> {
  await sync(
    lock.then(async () => {
      await fs.mkdir(base(), { recursive: true })
      await fs.writeFile(file(), JSON.stringify(data, null, 2))
    }).catch((err) => console.warn("Failed to write codegraph index", err)),
  )
}

function score(file: CodeFile, key: string): number {
  const low = key.toLowerCase()
  let out = 0
  const hit = (text: string) => text.toLowerCase().includes(low)
  if (hit(file.id)) out += 5
  if (hit(file.path)) out += 5
  if (hit(file.title)) out += 3
  for (const item of file.symbols) if (item.toLowerCase().includes(low)) out += 6
  for (const item of file.imports) if (item.toLowerCase().includes(low)) out += 1
  for (const item of file.uses) if (item.toLowerCase().includes(low)) out += 1
  return out
}

function density(file: CodeFile): number {
  return file.imports.length * 3 + file.uses.length * 2 + file.symbols.length
}

export namespace Codegraph {
  export async function readIndex(): Promise<CodeIndex> {
    const text = await fs.readFile(file(), "utf-8").catch(() => "")
    if (!text) return { version: 1, files: [], symbols: [] }
    try {
      return JSON.parse(text) as CodeIndex
    } catch {
      return { version: 1, files: [], symbols: [] }
    }
  }

  export function basePath(): string {
    return base()
  }

  export function graph(idx: CodeIndex): CodeGraph {
    const nodes: CodeNode[] = []
    const edges: CodeEdge[] = []

    for (const file of idx.files) {
      nodes.push({ id: file.id, path: file.path, kind: "file", title: file.title })
      for (const to of file.imports) edges.push({ from: file.id, to, type: "import" })
      for (const to of file.uses) edges.push({ from: file.id, to, type: "uses" })
    }

    for (const sym of idx.symbols) {
      const file = idx.files.find((item) => item.id === sym.fileId)
      nodes.push({ id: sym.id, path: file?.path ?? sym.fileId, kind: "symbol", title: sym.name })
      edges.push({ from: sym.fileId, to: sym.id, type: "declares" })
    }

    return { nodes, edges }
  }

  export function query(keys: string[], files: CodeFile[]): CodeFile[] {
    if (keys.length === 0) return []
    return files
      .map((item) => ({ item, score: keys.reduce((n, key) => n + score(item, key), 0) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.item.modified - a.item.modified)
      .map((item) => item.item)
  }

  export function hotspots(files: CodeFile[], limit = 5): CodeFile[] {
    return [...files]
      .sort((a, b) => density(b) - density(a) || b.modified - a.modified)
      .slice(0, limit)
  }

  export async function rebuild(): Promise<{ files: number; symbols: number; imports: number; edges: number; errors: number }> {
    const files = await scan()
    const list: CodeFile[] = []
    const sym = new Map<string, CodeSymbol>()
    const seen = new Set<string>()
    let errors = 0
    let imports = 0
    let edges = 0

    const items = new Map<string, Item>()
    for (const item of await Promise.all(files.map((file) => read(file)))) {
      if (!item) {
        errors++
        continue
      }
      items.set(item.id, item)
      list.push({
        id: item.id,
        path: path.relative(root(), item.file).replaceAll("\\", "/"),
        kind: "file",
        title: title(item.file),
        hash: Hash.fast(item.text),
        imports: [],
        uses: [],
        exports: [...item.exports],
        symbols: item.locals.map((local) => local.name),
        modified: item.stat.mtimeMs,
      })
    }

    const ref = new Map<string, string>()
    for (const item of list) {
      ref.set(item.id, item.id)
      ref.set(item.path, item.id)
      ref.set(path.basename(item.path, path.extname(item.path)).toLowerCase(), item.id)
    }

    const exp = new Map<string, Set<string>>()
    for (const item of items.values()) exp.set(item.id, item.exports)

    for (const item of items.values()) {
      const file = list.find((entry) => entry.id === item.id)
      if (!file) continue
      if (item.default && !file.exports.includes("default")) file.exports.push("default")
      if (item.default) {
        const id = `${item.id}#default`
        if (!sym.has(id)) {
          sym.set(id, {
            id,
            fileId: item.id,
            name: "default",
            kind: "symbol",
            exported: true,
          })
        }
      }

      for (const local of item.locals) {
        const symbol = {
          id: `${item.id}#${local.name}`,
          fileId: item.id,
          name: local.name,
          kind: local.kind,
          exported: item.exports.has(local.name) || item.default && local.name === "default",
        }
        sym.set(symbol.id, symbol)
      }

      for (const part of item.imports) {
        const to = await rootFile(part.source, item.file)
        if (!to) continue
        const target = ref.get(to)
        if (!target) continue
        if (!file.imports.includes(target) && target !== file.id) file.imports.push(target)
        imports++
        edges++

        for (const name of part.names) {
          if (!exp.get(target)?.has(name)) continue
          const id = `${target}#${name}`
          if (!seen.has(id)) {
            seen.add(id)
            if (!sym.has(id)) {
              sym.set(id, {
                id,
                fileId: target,
                name,
                kind: "symbol",
                exported: true,
              })
            }
          }
          if (!file.uses.includes(id)) file.uses.push(id)
          edges++
        }

        if (part.def) {
          const id = `${target}#default`
          if (!seen.has(id)) {
            seen.add(id)
            if (!sym.has(id)) {
              sym.set(id, {
                id,
                fileId: target,
                name: "default",
                kind: "symbol",
                exported: true,
              })
            }
          }
          if (!file.uses.includes(id)) file.uses.push(id)
          edges++
        }
      }
    }

    await write({
      version: 1,
      files: list.sort((a, b) => a.title.localeCompare(b.title) || a.path.localeCompare(b.path)),
      symbols: [...sym.values()].sort((a, b) => a.fileId.localeCompare(b.fileId) || a.name.localeCompare(b.name)),
    })

    return {
      files: list.length,
      symbols: sym.size,
      imports,
      edges,
      errors,
    }
  }

  export async function get(id: string): Promise<CodeFile | undefined> {
    const idx = await readIndex()
    return idx.files.find((item) => item.id === id || item.path === id || path.basename(item.path, path.extname(item.path)) === id)
  }

  export async function page(id: string): Promise<{ file: CodeFile; content: string } | undefined> {
    const file = await get(id)
    if (!file) return undefined
    const content = await fs.readFile(path.join(root(), file.path), "utf-8").catch(() => "")
    return { file, content }
  }
}
