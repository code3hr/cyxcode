/**
 * @fileoverview Dashboard API Routes
 *
 * Hono routes for the pentest reporting dashboard.
 * Provides endpoints for findings, scans, monitors, statistics, and compliance.
 *
 * @module server/dashboard
 */

import { Hono } from "hono"
import z from "zod"
import { Findings } from "../pentest/findings"
import { PentestTypes } from "../pentest/types"
import { MonitorStorage } from "../pentest/monitoring/storage"
import { Scheduler } from "../pentest/monitoring/scheduler"
import { ComplianceMapper } from "../pentest/compliance/mapper"
import { ComplianceScorer } from "../pentest/compliance/scorer"
import { ComplianceFrameworks } from "../pentest/compliance/frameworks"
import type { ComplianceTypes } from "../pentest/compliance/types"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"

const log = Log.create({ service: "dashboard" })

/**
 * Create the dashboard API router.
 */
export function createDashboardRoutes(): Hono {
  const app = new Hono()

  // ============================================================================
  // FINDINGS ENDPOINTS
  // ============================================================================

  /**
   * GET /pentest/findings - List findings with filters
   */
  app.get("/pentest/findings", async (c) => {
    const query = c.req.query()

    const filters: {
      sessionID?: string
      scanID?: string
      severity?: PentestTypes.Severity
      status?: PentestTypes.FindingStatus
      target?: string
      limit?: number
    } = {}

    if (query.sessionID) filters.sessionID = query.sessionID
    if (query.scanID) filters.scanID = query.scanID
    if (query.severity && PentestTypes.Severity.safeParse(query.severity).success) {
      filters.severity = query.severity as PentestTypes.Severity
    }
    if (query.status && PentestTypes.FindingStatus.safeParse(query.status).success) {
      filters.status = query.status as PentestTypes.FindingStatus
    }
    if (query.target) filters.target = query.target
    if (query.limit) filters.limit = parseInt(query.limit, 10)

    const findings = await Findings.list({}, filters)
    return c.json({ findings, total: findings.length })
  })

  /**
   * GET /pentest/findings/:id - Get single finding
   */
  app.get("/pentest/findings/:id", async (c) => {
    const id = c.req.param("id")
    const finding = await Findings.get(id)

    if (!finding) {
      return c.json({ error: "Finding not found" }, 404)
    }

    return c.json({ finding })
  })

  /**
   * PATCH /pentest/findings/:id - Update finding status/notes
   */
  app.patch("/pentest/findings/:id", async (c) => {
    const id = c.req.param("id")
    const body = await c.req.json()

    const UpdateSchema = z.object({
      status: PentestTypes.FindingStatus.optional(),
      remediation: z.string().optional(),
      evidence: z.string().optional(),
    })

    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: "Invalid update data", details: parsed.error.issues }, 400)
    }

    const updated = await Findings.update(id, parsed.data)
    if (!updated) {
      return c.json({ error: "Finding not found" }, 404)
    }

    return c.json({ finding: updated })
  })

  /**
   * DELETE /pentest/findings/:id - Delete finding
   */
  app.delete("/pentest/findings/:id", async (c) => {
    const id = c.req.param("id")
    const deleted = await Findings.remove(id)

    if (!deleted) {
      return c.json({ error: "Finding not found" }, 404)
    }

    return c.json({ success: true })
  })

  // ============================================================================
  // SCANS ENDPOINTS
  // ============================================================================

  /**
   * GET /pentest/scans - List scans
   */
  app.get("/pentest/scans", async (c) => {
    const query = c.req.query()

    const filters: {
      sessionID?: string
      target?: string
      scanType?: PentestTypes.ScanType
      limit?: number
    } = {}

    if (query.sessionID) filters.sessionID = query.sessionID
    if (query.target) filters.target = query.target
    if (query.scanType && PentestTypes.ScanType.safeParse(query.scanType).success) {
      filters.scanType = query.scanType as PentestTypes.ScanType
    }
    if (query.limit) filters.limit = parseInt(query.limit, 10)

    const scans = await Findings.listScans({}, filters)
    return c.json({ scans, total: scans.length })
  })

  /**
   * GET /pentest/scans/:id - Get scan details
   */
  app.get("/pentest/scans/:id", async (c) => {
    const id = c.req.param("id")
    const scan = await Findings.getScan(id)

    if (!scan) {
      return c.json({ error: "Scan not found" }, 404)
    }

    return c.json({ scan })
  })

  // ============================================================================
  // STATISTICS ENDPOINTS
  // ============================================================================

  /**
   * GET /pentest/stats/overview - Dashboard overview statistics
   */
  app.get("/pentest/stats/overview", async (c) => {
    const findings = await Findings.list({})
    const scans = await Findings.listScans({})
    const monitors = await MonitorStorage.listMonitors()

    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

    // Calculate findings stats
    const bySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    }
    const byStatus: Record<string, number> = {
      open: 0,
      confirmed: 0,
      mitigated: 0,
      false_positive: 0,
    }

    let mitigatedLast7d = 0
    const mitigationTimes: number[] = []

    for (const finding of findings) {
      bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1
      byStatus[finding.status] = (byStatus[finding.status] || 0) + 1

      if (finding.status === "mitigated" && finding.updatedAt && finding.updatedAt >= sevenDaysAgo) {
        mitigatedLast7d++
        mitigationTimes.push(finding.updatedAt - finding.createdAt)
      }
    }

    const openCriticalHigh = (bySeverity.critical || 0) + (bySeverity.high || 0)

    // Calculate scan stats
    const scansLast24h = scans.filter((s) => s.startTime >= oneDayAgo).length
    const activeMonitors = monitors.filter((m) => m.status === "active").length

    // Calculate average mitigation time
    const avgTimeToMitigate =
      mitigationTimes.length > 0 ? Math.round(mitigationTimes.reduce((a, b) => a + b, 0) / mitigationTimes.length) : 0

    return c.json({
      findings: {
        total: findings.length,
        bySeverity,
        byStatus,
        openCriticalHigh,
      },
      scans: {
        total: scans.length,
        last24h: scansLast24h,
        activeMonitors,
      },
      remediation: {
        mitigatedLast7d,
        avgTimeToMitigate,
      },
    })
  })

  /**
   * GET /pentest/stats/severity - Severity distribution
   */
  app.get("/pentest/stats/severity", async (c) => {
    const findings = await Findings.list({})

    const distribution: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    }

    for (const finding of findings) {
      distribution[finding.severity] = (distribution[finding.severity] || 0) + 1
    }

    return c.json({ distribution })
  })

  /**
   * GET /pentest/stats/trends - Finding trends over time
   */
  app.get("/pentest/stats/trends", async (c) => {
    const query = c.req.query()
    const days = parseInt(query.days || "30", 10)

    const findings = await Findings.list({})
    const now = Date.now()
    const startTime = now - days * 24 * 60 * 60 * 1000

    // Group findings by day
    const dailyData: Record<string, { created: number; mitigated: number }> = {}

    for (let i = 0; i < days; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().split("T")[0]
      dailyData[dateKey] = { created: 0, mitigated: 0 }
    }

    for (const finding of findings) {
      if (finding.createdAt >= startTime) {
        const dateKey = new Date(finding.createdAt).toISOString().split("T")[0]
        if (dailyData[dateKey]) {
          dailyData[dateKey].created++
        }
      }

      if (finding.status === "mitigated" && finding.updatedAt && finding.updatedAt >= startTime) {
        const dateKey = new Date(finding.updatedAt).toISOString().split("T")[0]
        if (dailyData[dateKey]) {
          dailyData[dateKey].mitigated++
        }
      }
    }

    // Convert to sorted array
    const trends = Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return c.json({ trends, days })
  })

  // ============================================================================
  // MONITORS ENDPOINTS
  // ============================================================================

  /**
   * GET /pentest/monitors - List monitors
   */
  app.get("/pentest/monitors", async (c) => {
    const query = c.req.query()

    const filters: { sessionID?: string; status?: "active" | "paused" | "disabled" | "error" } = {}
    if (query.sessionID) filters.sessionID = query.sessionID
    if (query.status) filters.status = query.status as any

    const monitors = await MonitorStorage.listMonitors(filters)
    return c.json({ monitors, total: monitors.length })
  })

  /**
   * GET /pentest/monitors/:id - Get monitor details
   */
  app.get("/pentest/monitors/:id", async (c) => {
    const id = c.req.param("id")
    const monitor = await MonitorStorage.getMonitor(id)

    if (!monitor) {
      return c.json({ error: "Monitor not found" }, 404)
    }

    return c.json({ monitor })
  })

  /**
   * POST /pentest/monitors/:id/run - Trigger immediate run
   */
  app.post("/pentest/monitors/:id/run", async (c) => {
    const id = c.req.param("id")
    const monitor = await MonitorStorage.getMonitor(id)

    if (!monitor) {
      return c.json({ error: "Monitor not found" }, 404)
    }

    try {
      const run = await Scheduler.triggerNow(id)
      return c.json({ success: true, runId: run.id })
    } catch (err) {
      log.error("Failed to trigger monitor run", { monitorId: id, error: String(err) })
      return c.json({ error: "Failed to trigger run" }, 500)
    }
  })

  /**
   * GET /pentest/monitors/:id/runs - Run history
   */
  app.get("/pentest/monitors/:id/runs", async (c) => {
    const id = c.req.param("id")
    const query = c.req.query()

    const limit = query.limit ? parseInt(query.limit, 10) : undefined

    const runs = await MonitorStorage.listRuns(id, { limit })
    return c.json({ runs, total: runs.length })
  })

  // ============================================================================
  // REPORTS ENDPOINTS
  // ============================================================================

  /**
   * POST /pentest/reports - Generate report
   */
  app.post("/pentest/reports", async (c) => {
    const body = await c.req.json()

    const ReportRequest = z.object({
      type: z.enum(["executive", "technical", "compliance"]),
      filters: z
        .object({
          sessionID: z.string().optional(),
          severity: z.array(PentestTypes.Severity).optional(),
          status: z.array(PentestTypes.FindingStatus).optional(),
          dateRange: z
            .object({
              start: z.number(),
              end: z.number(),
            })
            .optional(),
        })
        .optional(),
      framework: z.enum(["pci-dss", "hipaa", "soc2"]).optional(),
    })

    const parsed = ReportRequest.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: "Invalid report request", details: parsed.error.issues }, 400)
    }

    const { type, filters, framework } = parsed.data

    // Get findings based on filters
    let findings = await Findings.list({})

    if (filters) {
      if (filters.sessionID) {
        findings = findings.filter((f) => f.sessionID === filters.sessionID)
      }
      if (filters.severity && filters.severity.length > 0) {
        findings = findings.filter((f) => filters.severity!.includes(f.severity))
      }
      if (filters.status && filters.status.length > 0) {
        findings = findings.filter((f) => filters.status!.includes(f.status))
      }
      if (filters.dateRange) {
        findings = findings.filter(
          (f) => f.createdAt >= filters.dateRange!.start && f.createdAt <= filters.dateRange!.end
        )
      }
    }

    const reportId = `report_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

    // Generate report content based on type
    let report: any

    if (type === "executive") {
      report = generateExecutiveReport(findings, reportId)
    } else if (type === "technical") {
      report = generateTechnicalReport(findings, reportId)
    } else if (type === "compliance" && framework) {
      const assessment = await ComplianceScorer.assess(framework, findings)
      report = generateComplianceReport(assessment, findings, reportId)
    } else {
      return c.json({ error: "Invalid report type or missing framework" }, 400)
    }

    // Store report
    await Storage.write(["pentest", "reports", reportId], report)

    return c.json({ report })
  })

  /**
   * GET /pentest/reports/:id - Get report content
   */
  app.get("/pentest/reports/:id", async (c) => {
    const id = c.req.param("id")

    try {
      const report = await Storage.read(["pentest", "reports", id])
      return c.json({ report })
    } catch {
      return c.json({ error: "Report not found" }, 404)
    }
  })

  // ============================================================================
  // COMPLIANCE ENDPOINTS
  // ============================================================================

  /**
   * GET /pentest/compliance/frameworks - List frameworks
   */
  app.get("/pentest/compliance/frameworks", async (c) => {
    const frameworks = ComplianceFrameworks.list()
    return c.json({ frameworks })
  })

  /**
   * GET /pentest/compliance/:framework - Get framework controls
   */
  app.get("/pentest/compliance/:framework", async (c) => {
    const framework = c.req.param("framework") as "pci-dss" | "hipaa" | "soc2"

    try {
      const controls = ComplianceFrameworks.getControls(framework)
      const categories = ComplianceFrameworks.getCategories(framework)

      return c.json({ framework, controls, categories })
    } catch {
      return c.json({ error: "Framework not found" }, 404)
    }
  })

  /**
   * GET /pentest/compliance/:framework/map - Finding-to-control mapping
   */
  app.get("/pentest/compliance/:framework/map", async (c) => {
    const framework = c.req.param("framework") as "pci-dss" | "hipaa" | "soc2"

    try {
      const findings = await Findings.list({})
      const mapping = ComplianceMapper.mapFindings(framework, findings)

      return c.json({ framework, mapping })
    } catch {
      return c.json({ error: "Framework not found" }, 404)
    }
  })

  /**
   * POST /pentest/compliance/:framework/assess - Run assessment
   */
  app.post("/pentest/compliance/:framework/assess", async (c) => {
    const framework = c.req.param("framework") as "pci-dss" | "hipaa" | "soc2"

    try {
      const findings = await Findings.list({})
      const assessment = await ComplianceScorer.assess(framework, findings)

      return c.json({ assessment })
    } catch {
      return c.json({ error: "Framework not found" }, 404)
    }
  })

  return app
}

// ============================================================================
// REPORT GENERATORS
// ============================================================================

function generateExecutiveReport(findings: PentestTypes.Finding[], reportId: string) {
  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  const byStatus: Record<string, number> = { open: 0, confirmed: 0, mitigated: 0, false_positive: 0 }

  for (const f of findings) {
    bySeverity[f.severity]++
    byStatus[f.status]++
  }

  const riskScore = calculateRiskScore(bySeverity)

  return {
    id: reportId,
    type: "executive",
    generatedAt: Date.now(),
    summary: {
      totalFindings: findings.length,
      riskScore,
      riskLevel: riskScore >= 80 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 40 ? "medium" : "low",
      bySeverity,
      byStatus,
      openIssues: byStatus.open + byStatus.confirmed,
      resolvedIssues: byStatus.mitigated + byStatus.false_positive,
    },
    highlights: {
      criticalFindings: findings
        .filter((f) => f.severity === "critical" && f.status !== "mitigated")
        .map((f) => ({ id: f.id, title: f.title, target: f.target })),
      topTargets: getTopTargets(findings),
    },
    recommendations: generateRecommendations(findings),
  }
}

function generateTechnicalReport(findings: PentestTypes.Finding[], reportId: string) {
  const groupedByTarget = new Map<string, PentestTypes.Finding[]>()

  for (const f of findings) {
    const existing = groupedByTarget.get(f.target) || []
    existing.push(f)
    groupedByTarget.set(f.target, existing)
  }

  const targets = Array.from(groupedByTarget.entries()).map(([target, targetFindings]) => ({
    target,
    findings: targetFindings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      status: f.status,
      port: f.port,
      service: f.service,
      description: f.description,
      evidence: f.evidence,
      remediation: f.remediation,
      references: f.references,
      cve: f.cve,
    })),
    summary: {
      total: targetFindings.length,
      critical: targetFindings.filter((f) => f.severity === "critical").length,
      high: targetFindings.filter((f) => f.severity === "high").length,
      medium: targetFindings.filter((f) => f.severity === "medium").length,
      low: targetFindings.filter((f) => f.severity === "low").length,
      info: targetFindings.filter((f) => f.severity === "info").length,
    },
  }))

  return {
    id: reportId,
    type: "technical",
    generatedAt: Date.now(),
    totalFindings: findings.length,
    targets,
    allFindings: findings,
  }
}

function generateComplianceReport(
  assessment: ComplianceTypes.ComplianceAssessment,
  findings: PentestTypes.Finding[],
  reportId: string
) {
  const failedControls = assessment.controls.filter((c) => c.status === "fail" || c.status === "partial")

  return {
    id: reportId,
    type: "compliance",
    framework: assessment.framework,
    generatedAt: Date.now(),
    assessment,
    summary: {
      compliancePercentage: assessment.score.percentage,
      totalControls: assessment.score.total,
      passedControls: assessment.score.passed,
      failedControls: assessment.score.failed,
      notAssessed: assessment.score.total - assessment.score.passed - assessment.score.failed,
    },
    gaps: failedControls.map((c) => ({
      control: c.control,
      status: c.status,
      relatedFindings: c.findings.map((fid) => findings.find((f) => f.id === fid)).filter(Boolean),
    })),
    recommendations: failedControls.map((c) => ({
      controlId: c.control.id,
      controlName: c.control.name,
      priority: c.status === "fail" ? "high" : "medium",
      action: c.control.remediation || `Address findings related to ${c.control.name}`,
    })),
  }
}

function calculateRiskScore(bySeverity: Record<string, number>): number {
  const weights = { critical: 40, high: 25, medium: 10, low: 3, info: 1 }
  let score = 0
  let maxScore = 0

  for (const [severity, count] of Object.entries(bySeverity)) {
    score += count * weights[severity as keyof typeof weights]
    maxScore += count * weights.critical
  }

  if (maxScore === 0) return 0
  return Math.round((score / maxScore) * 100)
}

function getTopTargets(findings: PentestTypes.Finding[]): Array<{ target: string; count: number }> {
  const targetCounts = new Map<string, number>()

  for (const f of findings) {
    targetCounts.set(f.target, (targetCounts.get(f.target) || 0) + 1)
  }

  return Array.from(targetCounts.entries())
    .map(([target, count]) => ({ target, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

function generateRecommendations(findings: PentestTypes.Finding[]): string[] {
  const recommendations: string[] = []
  const hasCritical = findings.some((f) => f.severity === "critical" && f.status !== "mitigated")
  const hasHigh = findings.some((f) => f.severity === "high" && f.status !== "mitigated")
  const hasTelnet = findings.some((f) => f.service === "telnet")
  const hasFtp = findings.some((f) => f.service === "ftp")
  const hasExposedDb = findings.some((f) => ["mysql", "ms-sql-s", "postgresql"].includes(f.service || ""))

  if (hasCritical) {
    recommendations.push("Immediately address all critical severity findings as they pose significant risk.")
  }
  if (hasHigh) {
    recommendations.push("Prioritize remediation of high severity findings within the next 7-14 days.")
  }
  if (hasTelnet) {
    recommendations.push("Replace all Telnet services with SSH for secure remote access.")
  }
  if (hasFtp) {
    recommendations.push("Migrate from FTP to SFTP or FTPS to protect credentials in transit.")
  }
  if (hasExposedDb) {
    recommendations.push("Restrict database access to trusted networks and implement proper authentication.")
  }

  if (recommendations.length === 0) {
    recommendations.push("Continue regular security assessments to maintain security posture.")
  }

  return recommendations
}
