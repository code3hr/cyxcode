/**
 * Scans Store
 *
 * Reactive state management for scan results.
 */

import { createSignal, createEffect, onCleanup } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { scansApi, type ScanResult } from "../api/client"
import { sseClient } from "../api/sse"

export interface ScansState {
  scans: ScanResult[]
  selectedScan: ScanResult | null
  activeScans: string[]
  loading: boolean
  error: string | null
  total: number
}

const [state, setState] = createStore<ScansState>({
  scans: [],
  selectedScan: null,
  activeScans: [],
  loading: false,
  error: null,
  total: 0,
})

export const scansStore = {
  get state() {
    return state
  },

  async fetchScans(filters?: { sessionID?: string; target?: string; scanType?: string; limit?: number }) {
    setState("loading", true)
    setState("error", null)

    const result = await scansApi.list(filters)

    if (result.error) {
      setState("error", result.error)
      setState("loading", false)
      return
    }

    if (result.data) {
      setState("scans", result.data.scans)
      setState("total", result.data.total)
    }

    setState("loading", false)
  },

  async fetchScan(id: string) {
    setState("loading", true)
    setState("error", null)

    const result = await scansApi.get(id)

    if (result.error) {
      setState("error", result.error)
      setState("loading", false)
      return null
    }

    if (result.data) {
      setState("selectedScan", result.data.scan)
    }

    setState("loading", false)
    return result.data?.scan
  },

  clearSelectedScan() {
    setState("selectedScan", null)
  },

  setupRealtimeUpdates() {
    const unsubStarted = sseClient.on("pentest.scan_started", (event) => {
      const scanID = event.properties.scanID as string
      if (scanID) {
        setState(
          "activeScans",
          produce((active) => {
            if (!active.includes(scanID)) {
              active.push(scanID)
            }
          })
        )
      }
    })

    const unsubCompleted = sseClient.on("pentest.scan_completed", (event) => {
      const scan = event.properties.scan as ScanResult
      if (scan) {
        // Remove from active
        setState(
          "activeScans",
          state.activeScans.filter((id) => id !== scan.id)
        )

        // Add to scans list
        setState(
          "scans",
          produce((scans) => {
            const idx = scans.findIndex((s) => s.id === scan.id)
            if (idx >= 0) {
              scans[idx] = scan
            } else {
              scans.unshift(scan)
            }
          })
        )
        setState("total", state.total + 1)

        // Update selected if same
        if (state.selectedScan?.id === scan.id) {
          setState("selectedScan", scan)
        }
      }
    })

    return () => {
      unsubStarted()
      unsubCompleted()
    }
  },
}

export function useScans() {
  const [loading, setLoading] = createSignal(true)

  createEffect(() => {
    scansStore.fetchScans().then(() => setLoading(false))
  })

  onCleanup(scansStore.setupRealtimeUpdates())

  return {
    scans: () => state.scans,
    activeScans: () => state.activeScans,
    loading,
    error: () => state.error,
    total: () => state.total,
    refetch: () => scansStore.fetchScans(),
  }
}
