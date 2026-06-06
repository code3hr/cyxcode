import { Hono } from "hono"
import type { WatchDecision, WatchKind } from "../cyxcode/watch"

const decisions: WatchDecision[] = ["allow", "warn", "require-approval", "block"]
const kinds: WatchKind[] = [
  "file.read",
  "file.write",
  "shell.command",
  "network.outbound",
  "network.websocket",
  "prompt.turn",
  "output.secret",
  "memory.read",
  "memory.retrieve",
  "memory.embed",
  "memory.send",
  "memory.redact",
]


export function createWatchRoutes(): Hono {
  const app = new Hono()

  app.get("/cyxwatch/report", async (c) => {
    const query = c.req.query()
    const period = query.period && ["1h", "1d", "7d", "30d", "all"].includes(query.period)
      ? (query.period as "1h" | "1d" | "7d" | "30d" | "all")
      : "7d"
    const { CyxWatch } = await import("../cyxcode/watch")
    const report = await CyxWatch.report(period)
    return c.json({ report })
  })

  app.get("/cyxwatch/recent", async (c) => {
    const query = c.req.query()
    const limit = query.limit ? Math.max(1, Math.min(200, parseInt(query.limit, 10) || 20)) : 20
    const { CyxWatch } = await import("../cyxcode/watch")
    const events = await CyxWatch.recent(limit)
    return c.json({ events, total: events.length })
  })

  app.get("/cyxwatch/alerts", async (c) => {
    const query = c.req.query()
    const limit = query.limit ? Math.max(1, Math.min(200, parseInt(query.limit, 10) || 20)) : 20
    const { CyxWatch } = await import("../cyxcode/watch")
    const alerts = await CyxWatch.alerts(limit)
    return c.json({ alerts, total: alerts.length })
  })

  app.get("/cyxwatch/query", async (c) => {
    const query = c.req.query()
    const limit = query.limit ? Math.max(1, Math.min(500, parseInt(query.limit, 10) || 50)) : 50
    const decision = query.decision && decisions.includes(query.decision as WatchDecision)
      ? query.decision as WatchDecision
      : undefined
    const kind = query.kind && kinds.includes(query.kind as WatchKind)
      ? query.kind as WatchKind
      : undefined
    const { CyxWatch } = await import("../cyxcode/watch")
    const events = await CyxWatch.query({
      limit,
      sessionID: query.session || query.sessionID,
      path: query.path,
      host: query.host,
      flag: query.flag,
      decision,
      kind,
    })
    return c.json({ events, total: events.length })
  })

  app.get("/cyxwatch/context", async (c) => {
    const query = c.req.query()
    const limit = query.limit ? Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20)) : 20
    const source = query.source ?? (query.provider ? `provider:${query.provider}${query.model ? `:${query.model}` : ""}` : undefined)
    const { CyxWatch } = await import("../cyxcode/watch")
    const events = await CyxWatch.context({
      limit,
      sessionID: query.session || query.sessionID,
      source,
    })
    return c.json({ events, total: events.length })
  })

  app.get("/cyxwatch/policy", async (c) => {
    const { CyxWatch } = await import("../cyxcode/watch")
    return c.json({ policy: CyxWatch.policy() })
  })

  app.get("/cyxwatch/policy/effective", async (c) => {
    const { CyxWatch } = await import("../cyxcode/watch")
    return c.json({ policy: CyxWatch.effectivePolicy() })
  })

  app.put("/cyxwatch/policy", async (c) => {
    const { WatchPolicy } = await import("../cyxcode/watch/policy")
    const parsed = WatchPolicy.check(await c.req.json())
    if (!parsed.ok) return c.json({ error: parsed.error }, 400)
    const { CyxWatch } = await import("../cyxcode/watch")
    const policy = await CyxWatch.savePolicy(parsed.policy)
    return c.json({ policy })
  })

  return app
}
