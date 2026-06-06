import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { CyxWatch, type WatchAlert, type WatchEntry } from "../../cyxcode"
import type { WatchPolicy } from "../../cyxcode/watch/policy"

function event(row: WatchEntry) {
  const info = [
    row.decision ? `decision=${row.decision}` : undefined,
    row.risk > 0 ? `risk=${row.risk}` : undefined,
    row.host ? `host=${row.host}` : undefined,
    row.method ? `method=${row.method}` : undefined,
    row.bytes !== undefined ? `bytes=${row.bytes}` : undefined,
    row.flags.length > 0 ? `flags=${row.flags.join(",")}` : undefined,
  ].filter((item): item is string => !!item)
  const text = row.path ?? row.cmd ?? ""
  const meta = info.length > 0 ? `  ${info.join(" ")}` : ""
  return `${new Date(row.ts).toLocaleTimeString()}  ${row.kind}${meta}  ${text}`
}

function alert(row: WatchAlert) {
  const info = [
    `decision=${row.decision}`,
    row.risk > 0 ? `risk=${row.risk}` : undefined,
    row.host ? `host=${row.host}` : undefined,
    row.flags.length > 0 ? `flags=${row.flags.join(",")}` : undefined,
  ].filter((item): item is string => !!item)
  return `${new Date(row.ts).toLocaleTimeString()}  ${row.kind}  ${row.title}  ${info.join(" ")}  ${row.path ?? row.cmd ?? row.host ?? ""}`
}

function rule(row: WatchPolicy.Rule, index: number) {
  const match = [
    row.permission?.length ? `permission=${row.permission.join(",")}` : undefined,
    row.path?.length ? `path=${row.path.join(",")}` : undefined,
    row.host?.length ? `host=${row.host.join(",")}` : undefined,
    row.cmd?.length ? `cmd=${row.cmd.join(",")}` : undefined,
    row.pattern?.length ? `pattern=${row.pattern.join(",")}` : undefined,
    row.method?.length ? `method=${row.method.join(",")}` : undefined,
    row.bytes_gt === undefined ? undefined : `bytes>${row.bytes_gt}`,
    row.bytes_gte === undefined ? undefined : `bytes>=${row.bytes_gte}`,
    row.bytes_lt === undefined ? undefined : `bytes<${row.bytes_lt}`,
    row.bytes_lte === undefined ? undefined : `bytes<=${row.bytes_lte}`,
  ].filter((item): item is string => !!item)
  const flags = row.flags?.length ? ` flags=${row.flags.join(",")}` : ""
  const risk = row.risk === undefined ? "" : ` risk=${row.risk}`
  const enabled = row.enabled === false ? " disabled" : ""
  const suffix = match.length ? ` ${match.join(" ")}` : ""
  return `${index + 1}. ${row.id ?? "rule"} decision=${row.decision}${enabled}${risk}${flags}${suffix}`
}

const ReportCommand = cmd({
  command: "report",
  describe: "generate a CyxWatch report",
  builder: (yargs: Argv) =>
    yargs
      .option("period", {
        describe: "time period (1h, 1d, 7d, 30d, all)",
        type: "string",
        default: "7d",
      })
      .option("json", {
        describe: "print JSON output",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const report = await CyxWatch.report(args.period as "1h" | "1d" | "7d" | "30d" | "all")
      if (args.json) {
        console.log(JSON.stringify(report, null, 2))
        return
      }
      console.log(CyxWatch.formatText(report))
    })
  },
})

const RecentCommand = cmd({
  command: "recent",
  describe: "show recent CyxWatch events",
  builder: (yargs: Argv) =>
    yargs
      .option("limit", {
        describe: "maximum entries to show",
        type: "number",
        default: 20,
      })
      .option("json", {
        describe: "print JSON output",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const rows = await CyxWatch.recent(args.limit as number)
      if (args.json) {
        console.log(JSON.stringify(rows, null, 2))
        return
      }
      for (const row of rows) {
        console.log(event(row))
      }
    })
  },
})

const AlertCommand = cmd({
  command: "alerts",
  describe: "show recent CyxWatch alerts",
  builder: (yargs: Argv) =>
    yargs
      .option("limit", {
        describe: "maximum entries to show",
        type: "number",
        default: 20,
      })
      .option("json", {
        describe: "print JSON output",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const rows = await CyxWatch.alerts(args.limit as number)
      if (args.json) {
        console.log(JSON.stringify(rows, null, 2))
        return
      }
      for (const row of rows) {
        console.log(alert(row))
      }
    })
  },
})

const PolicyCommand = cmd({
  command: "policy",
  describe: "show CyxWatch policy rules",
  builder: (yargs: Argv) =>
    yargs
      .option("effective", {
        describe: "include default rules applied at runtime",
        type: "boolean",
        default: false,
      })
      .option("json", {
        describe: "print JSON output",
        type: "boolean",
        default: false,
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const policy = args.effective ? CyxWatch.effectivePolicy() : CyxWatch.policy()
      if (args.json) {
        console.log(JSON.stringify(policy, null, 2))
        return
      }
      console.log(args.effective ? "CyxWatch Effective Policy" : "CyxWatch User Policy")
      if (policy.rules.length === 0) {
        console.log("  No rules configured.")
        return
      }
      console.log(policy.rules.map(rule).join("\n"))
    })
  },
})

export const WatchCommand = cmd({
  command: "watch",
  describe: "inspect CyxWatch runtime telemetry",
  builder: (yargs: Argv) => yargs.command(ReportCommand).command(RecentCommand).command(AlertCommand).command(PolicyCommand).demandCommand(),
  handler: () => {},
})
