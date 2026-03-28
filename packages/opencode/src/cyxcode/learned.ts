/**
 * CyxCode Pattern Learning System
 *
 * "We automate the AI that automates us."
 *
 * Captures unmatched errors + AI fixes, generates patterns,
 * so the same error never costs tokens again.
 */

import fs from "fs/promises"
import path from "path"
import { Instance } from "@/project/instance"
import { BaseSkill } from "./base-skill"
import type { Pattern, Fix } from "./types"
import { Log } from "@/util/log"
import { CyxPaths } from "./paths"

const log = Log.create({ service: "cyxcode-learned" })

const MAX_PENDING = 100
const MAX_APPROVED = 500
const MAX_CAPTURE_BUFFER = 50
const MIN_PATTERN_LENGTH = 15

// --- In-memory capture buffer ---

type CaptureEntry = {
  errorOutput: string
  failedCommand: string
  exitCode: number
}

// Use globalThis to share buffer across module instances (Bun --conditions=browser)
const g = globalThis as any
if (!g.__cyxcode_capture_buffer) g.__cyxcode_capture_buffer = new Map<string, CaptureEntry[]>()
if (!g.__cyxcode_capture_order) g.__cyxcode_capture_order = [] as string[]

const buffer: Map<string, CaptureEntry[]> = g.__cyxcode_capture_buffer
const bufferOrder: string[] = g.__cyxcode_capture_order

export namespace PendingCapture {
  export function record(messageID: string, errorOutput: string, failedCommand: string, exitCode: number) {
    if (!buffer.has(messageID)) {
      bufferOrder.push(messageID)
      // FIFO eviction
      while (bufferOrder.length > MAX_CAPTURE_BUFFER) {
        const oldest = bufferOrder.shift()!
        buffer.delete(oldest)
      }
    }
    const entries = buffer.get(messageID) || []
    entries.push({ errorOutput: errorOutput.slice(0, 2000), failedCommand, exitCode })
    buffer.set(messageID, entries)
  }

  export function drain(messageID: string): CaptureEntry[] {
    const entries = buffer.get(messageID) || []
    buffer.delete(messageID)
    const idx = bufferOrder.indexOf(messageID)
    if (idx >= 0) bufferOrder.splice(idx, 1)
    return entries
  }

  export function drainAll(): CaptureEntry[] {
    const all: CaptureEntry[] = []
    for (const entries of buffer.values()) {
      all.push(...entries)
    }
    buffer.clear()
    bufferOrder.length = 0
    return all
  }
}

// --- JSON file schema ---

type SerializedPattern = {
  id: string
  regex: string
  category: "learned"
  description: string
  fixes: Fix[]
}

type PendingEntry = {
  id: string
  errorOutput: string
  aiFixText: string
  failedCommand: string
  exitCode: number
  timestamp: string
  generatedPattern: SerializedPattern
}

type LearnedFile = {
  version: 1
  pending: PendingEntry[]
  approved: SerializedPattern[]
}

// --- File-based storage ---

let writeLock: Promise<void> = Promise.resolve()

export namespace LearnedPatterns {
  export function filePath(): string {
    return CyxPaths.learnedPath()
  }

  export async function read(): Promise<LearnedFile> {
    try {
      const fp = filePath()
      const content = await fs.readFile(fp, "utf-8")
      return JSON.parse(content) as LearnedFile
    } catch {
      return { version: 1, pending: [], approved: [] }
    }
  }

  export async function write(data: LearnedFile): Promise<void> {
    // Chain writes to prevent concurrent file corruption
    writeLock = writeLock.then(async () => {
      const dir = path.dirname(filePath())
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(filePath(), JSON.stringify(data, null, 2))
    }).catch(e => log.warn("Failed to write learned patterns", { error: e }))
    await writeLock
  }

  export async function addPending(entry: {
    errorOutput: string
    aiFixText: string
    failedCommand: string
    exitCode: number
  }): Promise<void> {
    const pattern = generatePattern(entry.errorOutput, entry.aiFixText, entry.failedCommand)
    if (!pattern) return

    const data = await read()

    // Deduplicate: skip if identical regex exists
    const regexStr = pattern.regex
    if (data.pending.some(p => p.generatedPattern.regex === regexStr)) return
    if (data.approved.some(p => ((p as any).generatedPattern || p).regex === regexStr)) return

    const pending: PendingEntry = {
      id: pattern.id,
      errorOutput: entry.errorOutput.slice(0, 2000),
      aiFixText: entry.aiFixText.slice(0, 2000),
      failedCommand: entry.failedCommand,
      exitCode: entry.exitCode,
      timestamp: new Date().toISOString(),
      generatedPattern: pattern,
    }

    data.pending.push(pending)

    // FIFO cap
    while (data.pending.length > MAX_PENDING) data.pending.shift()

    await write(data)
    log.info("Saved pending learned pattern", { id: pattern.id, regex: regexStr })
  }

  /** Load approved patterns. Optionally pass a custom file path (for global tier). */
  export async function loadApproved(customPath?: string): Promise<Pattern[]> {
    let data: LearnedFile
    if (customPath) {
      try {
        const content = await fs.readFile(customPath, "utf-8")
        data = JSON.parse(content) as LearnedFile
      } catch {
        return []
      }
    } else {
      data = await read()
    }
    const patterns: Pattern[] = []

    for (const entry of data.approved) {
      try {
        // Handle both formats: direct SerializedPattern or full PendingEntry with nested generatedPattern
        const sp = (entry as any).generatedPattern || entry
        if (!sp.regex || !sp.fixes) continue
        patterns.push({
          id: sp.id,
          regex: new RegExp(sp.regex, "i"),
          category: sp.category || "learned",
          description: sp.description || "",
          fixes: sp.fixes,
        })
      } catch (e) {
        log.warn("Invalid learned pattern, skipping", { id: (entry as any).id })
      }
    }

    return patterns
  }

  export async function approve(id: string): Promise<boolean> {
    const data = await read()
    const idx = data.pending.findIndex(p => p.id === id)
    if (idx < 0) return false

    const entry = data.pending.splice(idx, 1)[0]
    data.approved.push(entry.generatedPattern)

    while (data.approved.length > MAX_APPROVED) data.approved.shift()

    await write(data)
    log.info("Approved learned pattern", { id })
    return true
  }

  export async function reject(id: string): Promise<boolean> {
    const data = await read()
    const idx = data.pending.findIndex(p => p.id === id)
    if (idx < 0) return false

    data.pending.splice(idx, 1)
    await write(data)
    log.info("Rejected learned pattern", { id })
    return true
  }

  export async function listPending(): Promise<PendingEntry[]> {
    const data = await read()
    return data.pending
  }
}

// --- Pattern generation ---

const ERROR_SIGNALS = /error|err!|failed|not found|denied|cannot|unable|fatal|exception|traceback/i

function findKeyLine(output: string): string | null {
  const lines = output.split("\n").filter(l => l.trim().length > 0)
  for (const line of lines) {
    if (ERROR_SIGNALS.test(line)) return line.trim()
  }
  // Fallback: last non-empty line
  return lines.length > 0 ? lines[lines.length - 1].trim() : null
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function generalize(escaped: string): string {
  let result = escaped

  // URLs with paths -> keep domain, capture last path segment
  result = result.replace(/(https?:\\\/\\\/[\w.-]+(?:\\\/[\w.-]+)*)\\\/([\w@.-]+)/g, "$1\\/(\\S+)")

  // Absolute paths -> capture group
  result = result.replace(/(?<!https?:)\\\/\S+/g, "(\\S+)")

  // Version strings -> flexible
  result = result.replace(/\d+\\\.\d+(\\\.\d+)*/g, "[\\d.]+")

  // Quoted content -> capture groups
  result = result.replace(/'[^']*'/g, "'([^']+)'")
  result = result.replace(/"[^"]*"/g, '"([^"]+)"')

  // Hex hashes (7+ chars) -> flexible
  result = result.replace(/[0-9a-f]{7,}/gi, "[0-9a-f]+")

  return result
}

function extractFix(aiText: string): { command?: string; description: string } {
  // Try fenced code blocks first — most likely to contain actual commands
  const fenced = aiText.match(/```(?:\w+)?\n?([\s\S]*?)```/)
  if (fenced) {
    const cmd = fenced[1].trim().split("\n")[0].trim()
    if (cmd.length > 3 && cmd.length < 200 && cmd.includes(" ")) {
      return { command: cmd, description: cmd }
    }
  }

  // Try inline backtick commands — must look like a command (contains space = has args)
  const inlineAll = [...aiText.matchAll(/`([^`]{3,100})`/g)]
  for (const m of inlineAll) {
    const cmd = m[1].trim()
    if (cmd.includes(" ") && cmd.split(" ").length <= 8 && /^[a-z]/.test(cmd)) {
      return { command: cmd, description: cmd }
    }
  }

  // Fallback: use first meaningful line as description (no command)
  const lines = aiText.split("\n").filter(l => l.trim().length > 10)
  const desc = lines.length > 0 ? lines[0].trim().slice(0, 100) : "Fix suggested by AI"
  return { description: desc }
}

export function generatePattern(
  errorOutput: string,
  aiFixText: string,
  failedCommand: string,
): SerializedPattern | null {
  const keyLine = findKeyLine(errorOutput)
  if (!keyLine) return null

  const escaped = escapeRegex(keyLine)
  const regex = generalize(escaped)

  // Safety: reject overly broad patterns
  if (regex.length < MIN_PATTERN_LENGTH) return null

  const fix = extractFix(aiFixText)
  const id = "learned-" + Date.now()

  return {
    id,
    regex,
    category: "learned",
    description: keyLine.slice(0, 100),
    fixes: [
      {
        id: id + "-fix",
        description: fix.description,
        command: fix.command,
        priority: 1,
      },
    ],
  }
}

// --- LearnedSkill ---

export class LearnedSkill extends BaseSkill {
  name = "learned"
  description = "Patterns learned from AI-handled errors"
  version = "1.0.0"
  triggers = ["error", "failed"]
  patterns: Pattern[]

  constructor(patterns: Pattern[]) {
    super()
    this.patterns = patterns
  }
}
