import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { CyxWatch } from "../../cyxcode"

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
    yargs.option("limit", {
      describe: "maximum entries to show",
      type: "number",
      default: 20,
    }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const rows = await CyxWatch.recent(args.limit as number)
      for (const row of rows) {
        console.log(`${new Date(row.ts).toLocaleTimeString()}  ${row.kind}  ${row.path ?? row.cmd ?? ""}`)
      }
    })
  },
})

const AlertCommand = cmd({
  command: "alerts",
  describe: "show recent CyxWatch alerts",
  builder: (yargs: Argv) =>
    yargs.option("limit", {
      describe: "maximum entries to show",
      type: "number",
      default: 20,
    }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const rows = await CyxWatch.alerts(args.limit as number)
      for (const row of rows) {
        console.log(`${new Date(row.ts).toLocaleTimeString()}  ${row.kind}  ${row.title}  ${row.path ?? row.cmd ?? row.host ?? ""}`)
      }
    })
  },
})

export const WatchCommand = cmd({
  command: "watch",
  describe: "inspect CyxWatch runtime telemetry",
  builder: (yargs: Argv) => yargs.command(ReportCommand).command(RecentCommand).command(AlertCommand).demandCommand(),
  handler: () => {},
})
