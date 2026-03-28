import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { CyxAudit, CyxReport } from "../../cyxcode"

/**
 * CyxCode Audit CLI Commands
 *
 * - cyxcode audit: Show recent audit events
 * - cyxcode report: Generate token savings report
 */

export const AuditCommand = cmd({
  command: "audit",
  describe: "show recent CyxCode audit events",
  builder: (yargs: Argv) => {
    return yargs
      .option("last", {
        describe: "time period (1h, 1d, 7d, 30d)",
        type: "string",
        default: "1d",
      })
      .option("type", {
        describe: "filter by event type",
        type: "string",
      })
      .option("limit", {
        describe: "maximum entries to show",
        type: "number",
        default: 50,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const since = parsePeriod(args.last)
      const entries = await CyxAudit.list({
        since,
        limit: args.limit,
        type: args.type as any,
      })

      if (entries.length === 0) {
        console.log("No audit events found for the specified period.")
        return
      }

      console.log(`\nCyxCode Audit Events (last ${args.last})\n`)
      console.log("─".repeat(70))

      for (const entry of entries) {
        const time = new Date(entry.timestamp).toLocaleTimeString()
        const type = entry.type.replace("cyxcode.", "")
        const data = formatEventData(entry)
        console.log(`[${time}] ${type.padEnd(25)} ${data}`)
      }

      console.log("─".repeat(70))
      console.log(`Total: ${entries.length} events`)
    })
  },
})

export const ReportCommand = cmd({
  command: "report",
  describe: "generate CyxCode token savings report",
  builder: (yargs: Argv) => {
    return yargs
      .option("period", {
        describe: "time period (1h, 1d, 7d, 30d, all)",
        type: "string",
        default: "7d",
      })
      .option("format", {
        describe: "output format (text, json, markdown, box)",
        type: "string",
        default: "box",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const period = args.period as CyxReport.Period
      const report = await CyxReport.generate(period)

      switch (args.format) {
        case "json":
          console.log(CyxReport.formatJSON(report))
          break
        case "markdown":
          console.log(CyxReport.formatMarkdown(report))
          break
        case "text":
          console.log(CyxReport.formatText(report))
          break
        case "box":
        default:
          console.log(CyxReport.formatBox(report))
          break
      }
    })
  },
})

function parsePeriod(period: string): number {
  const now = Date.now()
  switch (period) {
    case "1h":
      return now - 60 * 60 * 1000
    case "1d":
      return now - 24 * 60 * 60 * 1000
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000
    default:
      return now - 24 * 60 * 60 * 1000
  }
}

function formatEventData(entry: { type: string; data: any }): string {
  const d = entry.data
  switch (entry.type) {
    case "cyxcode.pattern.match":
      return `${d.patternId || "unknown"} (${d.tokensSaved || 0} tokens saved)`
    case "cyxcode.pattern.miss":
      return `${d.tokensUsed || 0} tokens used`
    case "cyxcode.pattern.learned":
      return `${d.patternId || "new pattern"}`
    case "cyxcode.correction.added":
      return `"${(d.rule || "").slice(0, 40)}..." (strength=${d.strength || 1})`
    case "cyxcode.correction.reinforced":
      return `"${(d.rule || "").slice(0, 40)}..." (strength=${d.strength || 1})`
    case "cyxcode.correction.promoted":
      return `"${(d.rule || "").slice(0, 40)}..."`
    case "cyxcode.drift.detected":
      return `"${(d.rule || "").slice(0, 40)}..."`
    case "cyxcode.memory.loaded":
      return `${d.tags?.join(", ") || "memory"} (${d.chars || 0} chars)`
    case "cyxcode.commit.created":
      return `${d.commitHash?.slice(0, 8) || "commit"} (${d.trigger || "unknown"})`
    case "cyxcode.session.start":
    case "cyxcode.session.end":
      return ""
    default:
      return JSON.stringify(d).slice(0, 50)
  }
}
