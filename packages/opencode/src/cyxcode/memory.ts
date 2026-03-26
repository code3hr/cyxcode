/**
 * CyxCode Indexed Project Memory
 *
 * Small indexed memory files that load selectively based on relevance.
 * Auto-captured from sessions, auto-pruned when stale.
 *
 * "I can remember what I ate on Sunday but AI can't."
 */

import fs from "fs/promises"
import path from "path"
import { Log } from "@/util/log"
import { Bus } from "@/bus"
import { SessionCompaction } from "@/session/compaction"
import { MessageV2 } from "@/session/message-v2"
import { Session } from "@/session"

const log = Log.create({ service: "cyxcode-memory" })

const MAX_ENTRIES = 200
const MAX_LOAD_CHARS = 2000
const PRUNE_DAYS = 30
const PRUNE_MIN_ACCESS = 3

// --- Types ---

export type MemoryEntry = {
  id: string
  file: string
  tags: string[]
  summary: string
  created: string
  accessed: string
  accessCount: number
}

export type MemoryIndex = {
  version: 1
  entries: MemoryEntry[]
}

// --- File path resolution (same pattern as learned.ts) ---

let _basePath: string | undefined

function basePath(): string {
  if (_basePath) return _basePath
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, ".opencode")
    try {
      require("fs").accessSync(candidate)
      _basePath = path.join(dir, ".opencode", "memory")
      return _basePath
    } catch {}
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  _basePath = path.join(process.cwd(), ".opencode", "memory")
  return _basePath
}

function indexPath(): string {
  return path.join(basePath(), "index.json")
}

// --- File I/O with write lock ---

let writeLock: Promise<void> = Promise.resolve()

export namespace Memory {
  export async function readIndex(): Promise<MemoryIndex> {
    try {
      const content = await fs.readFile(indexPath(), "utf-8")
      return JSON.parse(content) as MemoryIndex
    } catch {
      return { version: 1, entries: [] }
    }
  }

  export function getBasePath(): string {
    return basePath()
  }

  export async function writeIndex(data: MemoryIndex): Promise<void> {
    writeLock = writeLock.then(async () => {
      await fs.mkdir(basePath(), { recursive: true })
      await fs.writeFile(indexPath(), JSON.stringify(data, null, 2))
    }).catch(e => log.warn("Failed to write memory index", { error: e }))
    await writeLock
  }

  export async function save(id: string, tags: string[], summary: string, content: string): Promise<void> {
    const data = await readIndex()

    // Dedup by id
    if (data.entries.some(e => e.id === id)) return

    // Dedup by similar content (check summary overlap)
    const existing = data.entries.find(e => e.summary === summary)
    if (existing) return

    const file = id + ".md"
    const entry: MemoryEntry = {
      id,
      file,
      tags,
      summary,
      created: new Date().toISOString().slice(0, 10),
      accessed: new Date().toISOString().slice(0, 10),
      accessCount: 0,
    }

    // Write memory file
    await fs.mkdir(basePath(), { recursive: true })
    await fs.writeFile(path.join(basePath(), file), content)

    data.entries.push(entry)

    // Cap entries
    while (data.entries.length > MAX_ENTRIES) {
      const oldest = data.entries.shift()!
      try { await fs.unlink(path.join(basePath(), oldest.file)) } catch {}
    }

    await writeIndex(data)
    log.debug("Saved memory", { id, tags })
  }

  export function query(keywords: string[], entries: MemoryEntry[]): MemoryEntry[] {
    if (keywords.length === 0) return []

    const lower = keywords.map(k => k.toLowerCase())

    const scored = entries.map(entry => {
      let score = 0
      for (const tag of entry.tags) {
        const t = tag.toLowerCase()
        for (const kw of lower) {
          if (t === kw) score += 3
          else if (t.includes(kw) || kw.includes(t)) score += 1
        }
      }
      return { entry, score }
    })

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.accessCount - a.entry.accessCount)
      .map(s => s.entry)
  }

  export async function load(entries: MemoryEntry[]): Promise<string> {
    let total = 0
    const parts: string[] = []

    for (const entry of entries) {
      if (total >= MAX_LOAD_CHARS) break
      try {
        const content = await fs.readFile(path.join(basePath(), entry.file), "utf-8")
        const trimmed = content.trim()
        if (total + trimmed.length > MAX_LOAD_CHARS) {
          parts.push(trimmed.slice(0, MAX_LOAD_CHARS - total))
          total = MAX_LOAD_CHARS
        } else {
          parts.push(trimmed)
          total += trimmed.length
        }
      } catch {}
    }

    return parts.join("\n\n")
  }

  export async function relevant(msgs: MessageV2.WithParts[]): Promise<string[]> {
    try {
      const data = await readIndex()
      if (data.entries.length === 0) return []

      // Extract keywords from messages
      const keywords = extractKeywords(msgs)
      if (keywords.length === 0) return []

      // Query matching entries
      const matches = query(keywords, data.entries)
      if (matches.length === 0) return []

      // Load content
      const content = await load(matches)
      if (!content.trim()) return []

      // Update accessed timestamps
      const now = new Date().toISOString().slice(0, 10)
      for (const match of matches) {
        const entry = data.entries.find(e => e.id === match.id)
        if (entry) {
          entry.accessed = now
          entry.accessCount++
        }
      }
      await writeIndex(data)

      log.debug("Loaded memories", { count: matches.length, keywords: keywords.slice(0, 5) })

      return [`<project-memory>\n${content}\n</project-memory>`]
    } catch {
      return []
    }
  }

  export async function prune(): Promise<void> {
    try {
      const data = await readIndex()
      const now = Date.now()
      const cutoff = PRUNE_DAYS * 24 * 60 * 60 * 1000
      const before = data.entries.length

      data.entries = data.entries.filter(entry => {
        const age = now - new Date(entry.accessed).getTime()
        if (age > cutoff && entry.accessCount < PRUNE_MIN_ACCESS) {
          try { require("fs").unlinkSync(path.join(basePath(), entry.file)) } catch {}
          return false
        }
        return true
      })

      if (data.entries.length < before) {
        await writeIndex(data)
        log.debug("Pruned memories", { removed: before - data.entries.length })
      }
    } catch {}
  }
}

// --- Keyword extraction ---

function extractKeywords(msgs: MessageV2.WithParts[]): string[] {
  const keywords = new Set<string>()

  // Extract from recent messages (last 5)
  const recent = msgs.slice(-5)
  for (const msg of recent) {
    for (const part of msg.parts) {
      // Text parts — extract words
      if (part.type === "text" && !part.synthetic) {
        const words = part.text
          .split(/[\s,;:(){}[\]'"]+/)
          .filter(w => w.length > 2 && w.length < 50)
          .filter(w => /^[a-zA-Z]/.test(w))
        for (const w of words) keywords.add(w.toLowerCase())
      }

      // Tool parts — extract file paths
      if (part.type === "tool" && part.state.status === "completed") {
        const input = part.state.input
        if (input?.file_path) {
          const fp = String(input.file_path)
          keywords.add(path.basename(fp).toLowerCase())
          keywords.add(path.basename(fp, path.extname(fp)).toLowerCase())
        }
        if (input?.pattern) {
          keywords.add(String(input.pattern).toLowerCase())
        }
        if (input?.command) {
          const cmd = String(input.command)
          const parts = cmd.split(/\s+/).slice(0, 3)
          for (const p of parts) {
            if (p.length > 2) keywords.add(p.toLowerCase())
          }
        }
      }
    }
  }

  // Remove common stop words
  const stop = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "has", "her",
    "was", "one", "our", "out", "this", "that", "with", "have", "from", "they", "been",
    "said", "each", "which", "their", "will", "other", "about", "many", "then", "them",
    "let", "run", "use", "try", "also", "just", "how", "its", "may", "new", "now", "old",
    "see", "way", "who", "did", "get", "got", "had", "him", "his", "she", "too", "any"])

  return [...keywords].filter(k => !stop.has(k))
}

// --- Auto-capture from compaction ---

async function captureFromCompaction(sessionID: string) {
  try {
    const msgs: MessageV2.WithParts[] = []
    for await (const msg of MessageV2.stream(sessionID as any)) {
      msgs.push(msg)
    }

    // Find compaction summary message
    const summary = msgs.find(m => m.info.role === "assistant" && (m.info as any).summary === true)
    if (!summary) return

    const text = summary.parts
      .filter((p): p is MessageV2.TextPart => p.type === "text")
      .map(p => p.text)
      .join("\n")

    if (!text.trim()) return

    // Parse sections
    const discoveries = extractSection(text, "Discoveries")
    const files = extractSection(text, "Relevant files")

    // Save discoveries as memories
    if (discoveries) {
      const lines = discoveries.split("\n").filter(l => l.trim().length > 10)
      for (const line of lines.slice(0, 5)) {
        const clean = line.replace(/^[-*]\s*/, "").trim()
        if (clean.length < 10) continue
        const tags = extractTagsFromText(clean)
        const id = "discovery-" + hash(clean)
        await Memory.save(id, tags, clean.slice(0, 80), clean)
      }
    }

    // Save file knowledge as memories
    if (files) {
      const lines = files.split("\n").filter(l => l.trim().length > 5)
      for (const line of lines.slice(0, 10)) {
        const clean = line.replace(/^[-*]\s*/, "").trim()
        if (clean.length < 5) continue
        const tags = extractTagsFromText(clean)
        const id = "file-" + hash(clean)
        await Memory.save(id, tags, clean.slice(0, 80), clean)
      }
    }

    log.debug("Captured memories from compaction", { sessionID })
  } catch (e) {
    log.warn("Failed to capture memories from compaction", { error: e })
  }
}

function extractSection(text: string, heading: string): string | null {
  const regex = new RegExp(`^##\\s*${heading}[\\s\\S]*?(?=^##|$)`, "mi")
  const match = text.match(regex)
  if (!match) return null
  // Remove the heading line itself
  return match[0].replace(/^##.*\n/, "").trim()
}

function extractTagsFromText(text: string): string[] {
  const tags = new Set<string>()

  // File paths
  const paths = text.match(/[\w./]+\.[a-z]{1,4}/gi) || []
  for (const p of paths) {
    tags.add(path.basename(p).toLowerCase())
    tags.add(path.basename(p, path.extname(p)).toLowerCase())
  }

  // Technology keywords
  const techWords = text.match(/\b(react|vue|angular|express|fastify|drizzle|prisma|sqlite|postgres|redis|docker|kubernetes|terraform|ansible|nginx|jwt|oauth|bcrypt|webpack|vite|bun|npm|yarn|pnpm|git|python|flask|django|rust|cargo|go|java|gradle|maven)\b/gi) || []
  for (const t of techWords) tags.add(t.toLowerCase())

  // Significant words (4+ chars, not common)
  const words = text.split(/[\s,;:(){}[\]'"]+/).filter(w => w.length >= 4 && /^[a-zA-Z]/.test(w))
  for (const w of words.slice(0, 5)) tags.add(w.toLowerCase())

  return [...tags]
}

function hash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

// --- Init ---

export function initMemoryCapture() {
  Bus.subscribe(SessionCompaction.Event.Compacted, async (payload) => {
    await captureFromCompaction(payload.sessionID)
  })

  // Prune on startup
  Memory.prune()
}
