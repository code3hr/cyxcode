/**
 * Monitors Store
 *
 * Reactive state management for security monitors.
 */

import { createSignal, createEffect, onCleanup } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { monitorsApi, type Monitor, type MonitorRun } from "../api/client"
import { sseClient } from "../api/sse"

export interface MonitorsState {
  monitors: Monitor[]
  selectedMonitor: Monitor | null
  runs: MonitorRun[]
  runningMonitors: string[]
  loading: boolean
  error: string | null
  total: number
}

const [state, setState] = createStore<MonitorsState>({
  monitors: [],
  selectedMonitor: null,
  runs: [],
  runningMonitors: [],
  loading: false,
  error: null,
  total: 0,
})

export const monitorsStore = {
  get state() {
    return state
  },

  async fetchMonitors(filters?: { sessionID?: string; status?: string }) {
    setState("loading", true)
    setState("error", null)

    const result = await monitorsApi.list(filters)

    if (result.error) {
      setState("error", result.error)
      setState("loading", false)
      return
    }

    if (result.data) {
      setState("monitors", result.data.monitors)
      setState("total", result.data.total)
    }

    setState("loading", false)
  },

  async fetchMonitor(id: string) {
    setState("loading", true)
    setState("error", null)

    const result = await monitorsApi.get(id)

    if (result.error) {
      setState("error", result.error)
      setState("loading", false)
      return null
    }

    if (result.data) {
      setState("selectedMonitor", result.data.monitor)
    }

    setState("loading", false)
    return result.data?.monitor
  },

  async fetchRuns(monitorId: string, limit?: number) {
    const result = await monitorsApi.listRuns(monitorId, limit)

    if (result.error) {
      setState("error", result.error)
      return
    }

    if (result.data) {
      setState("runs", result.data.runs)
    }
  },

  async triggerRun(monitorId: string) {
    const result = await monitorsApi.triggerRun(monitorId)

    if (result.error) {
      setState("error", result.error)
      return null
    }

    // Add to running monitors
    setState(
      "runningMonitors",
      produce((running) => {
        if (!running.includes(monitorId)) {
          running.push(monitorId)
        }
      })
    )

    return result.data?.runId
  },

  clearSelectedMonitor() {
    setState("selectedMonitor", null)
    setState("runs", [])
  },

  setupRealtimeUpdates() {
    const unsubStarted = sseClient.on("pentest.monitor.run_started", (event) => {
      const monitorID = event.properties.monitorID as string
      if (monitorID) {
        setState(
          "runningMonitors",
          produce((running) => {
            if (!running.includes(monitorID)) {
              running.push(monitorID)
            }
          })
        )
      }
    })

    const unsubCompleted = sseClient.on("pentest.monitor.run_completed", (event) => {
      const monitorID = event.properties.monitorID as string
      if (monitorID) {
        // Remove from running
        setState(
          "runningMonitors",
          state.runningMonitors.filter((id) => id !== monitorID)
        )

        // Refresh monitors to get updated lastRunAt, runCount
        monitorsStore.fetchMonitors()

        // Refresh runs if we're viewing this monitor
        if (state.selectedMonitor?.id === monitorID) {
          monitorsStore.fetchRuns(monitorID, 10)
        }
      }
    })

    const unsubFailed = sseClient.on("pentest.monitor.run_failed", (event) => {
      const monitorID = event.properties.monitorID as string
      if (monitorID) {
        setState(
          "runningMonitors",
          state.runningMonitors.filter((id) => id !== monitorID)
        )

        // Refresh monitors
        monitorsStore.fetchMonitors()
      }
    })

    return () => {
      unsubStarted()
      unsubCompleted()
      unsubFailed()
    }
  },
}

export function useMonitors() {
  const [loading, setLoading] = createSignal(true)

  createEffect(() => {
    monitorsStore.fetchMonitors().then(() => setLoading(false))
  })

  onCleanup(monitorsStore.setupRealtimeUpdates())

  return {
    monitors: () => state.monitors,
    runningMonitors: () => state.runningMonitors,
    loading,
    error: () => state.error,
    total: () => state.total,
    refetch: () => monitorsStore.fetchMonitors(),
  }
}
