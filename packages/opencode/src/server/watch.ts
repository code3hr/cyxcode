import { Hono } from "hono"

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

  return app
}
