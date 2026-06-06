import fs from "fs"
import fsp from "fs/promises"
import path from "path"
import z from "zod"
import { CyxPaths } from "../paths"
import { Wildcard } from "../../util/wildcard"

const Decision = z.enum(["allow", "warn", "require-approval", "block"])

const Rule = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  permission: z.array(z.string()).optional(),
  pattern: z.array(z.string()).optional(),
  path: z.array(z.string()).optional(),
  host: z.array(z.string()).optional(),
  cmd: z.array(z.string()).optional(),
  method: z.array(z.string()).optional(),
  bytes_gt: z.number().int().min(0).optional(),
  bytes_gte: z.number().int().min(0).optional(),
  bytes_lt: z.number().int().min(0).optional(),
  bytes_lte: z.number().int().min(0).optional(),
  decision: Decision,
  risk: z.number().int().min(0).max(100).optional(),
  flags: z.array(z.string()).optional(),
})

const Config = z.object({
  version: z.literal(2).default(2),
  rules: z.array(Rule).default([]),
})

type Input = {
  permission: string
  patterns: string[]
  metadata?: Record<string, unknown>
}

export namespace WatchPolicy {
  export type Decision = z.infer<typeof Decision>
  export type Rule = z.infer<typeof Rule>
  export type Config = z.infer<typeof Config>

  export function file() {
    return path.join(CyxPaths.projectDir(), "cyxwatch", "policy.json")
  }

  export function blank(): Config {
    return {
      version: 2,
      rules: [],
    }
  }

  export function load(): Config {
    if (!fs.existsSync(file())) return blank()
    return Config.parse(JSON.parse(fs.readFileSync(file(), "utf-8")))
  }

  export async function save(cfg: Config) {
    const out = Config.parse(cfg)
    await fsp.mkdir(path.dirname(file()), { recursive: true })
    await fsp.writeFile(file(), `${JSON.stringify(out, null, 2)}\n`)
    return out
  }

  export function match(input: Input) {
    const meta = input.metadata ?? {}
    const str = (key: string) => {
      const value = meta[key]
      return typeof value === "string" ? value : undefined
    }
    const num = (key: string) => {
      const value = meta[key]
      return typeof value === "number" && Number.isFinite(value) ? value : undefined
    }
    const url = str("url") ?? input.patterns[0]
    const method = str("method")
    const bytes = num("bytes")
    const host = (() => {
      if (!url) return undefined
      try {
        return new URL(url).host
      } catch {
        return undefined
      }
    })()
    const target = [
      ...input.patterns,
      str("filepath"),
      str("command"),
      url,
      host,
      method,
    ].filter((item): item is string => !!item)

    const cfg = (() => {
      try {
        return load()
      } catch {
        return blank()
      }
    })()

    return cfg.rules.find((rule) => {
      if (rule.enabled === false) return false
      if (rule.permission?.length && !rule.permission.some((item) => Wildcard.match(input.permission, item))) return false
      if (rule.pattern?.length && !target.some((item) => rule.pattern!.some((pat) => Wildcard.match(item, pat)))) return false
      if (rule.path?.length && !target.some((item) => rule.path!.some((pat) => Wildcard.match(item, pat)))) return false
      if (rule.cmd?.length && !str("command")) return false
      if (rule.cmd?.length && !rule.cmd.some((pat) => Wildcard.match(str("command") ?? "", pat))) return false
      if (rule.host?.length && !host) return false
      if (rule.host?.length && !rule.host.some((pat) => Wildcard.match(host ?? "", pat))) return false
      if (rule.method?.length && !method) return false
      if (rule.method?.length && !rule.method.some((pat) => Wildcard.match(method ?? "", pat))) return false
      if (rule.bytes_gt !== undefined && (bytes === undefined || bytes <= rule.bytes_gt)) return false
      if (rule.bytes_gte !== undefined && (bytes === undefined || bytes < rule.bytes_gte)) return false
      if (rule.bytes_lt !== undefined && (bytes === undefined || bytes >= rule.bytes_lt)) return false
      if (rule.bytes_lte !== undefined && (bytes === undefined || bytes > rule.bytes_lte)) return false
      return true
    })
  }
}
