/**
 * Findings Store
 *
 * Reactive state management for security findings.
 */

import { createSignal, createEffect, onCleanup } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { findingsApi, type Finding, type FindingFilters } from "../api/client"
import { sseClient } from "../api/sse"

export interface FindingsState {
  findings: Finding[]
  selectedFinding: Finding | null
  loading: boolean
  error: string | null
  filters: FindingFilters
  total: number
}

const [state, setState] = createStore<FindingsState>({
  findings: [],
  selectedFinding: null,
  loading: false,
  error: null,
  filters: {},
  total: 0,
})

export const findingsStore = {
  // State accessors
  get state() {
    return state
  },

  // Actions
  async fetchFindings(filters?: FindingFilters) {
    setState("loading", true)
    setState("error", null)

    if (filters) {
      setState("filters", filters)
    }

    const result = await findingsApi.list(state.filters)

    if (result.error) {
      setState("error", result.error)
      setState("loading", false)
      return
    }

    if (result.data) {
      setState("findings", result.data.findings)
      setState("total", result.data.total)
    }

    setState("loading", false)
  },

  async fetchFinding(id: string) {
    setState("loading", true)
    setState("error", null)

    const result = await findingsApi.get(id)

    if (result.error) {
      setState("error", result.error)
      setState("loading", false)
      return null
    }

    if (result.data) {
      setState("selectedFinding", result.data.finding)
    }

    setState("loading", false)
    return result.data?.finding
  },

  async updateFinding(id: string, updates: Partial<Pick<Finding, "status" | "remediation" | "evidence">>) {
    const result = await findingsApi.update(id, updates)

    if (result.error) {
      setState("error", result.error)
      return null
    }

    if (result.data) {
      // Update in list
      setState(
        "findings",
        produce((findings) => {
          const idx = findings.findIndex((f) => f.id === id)
          if (idx >= 0) {
            findings[idx] = result.data!.finding
          }
        })
      )

      // Update selected if same
      if (state.selectedFinding?.id === id) {
        setState("selectedFinding", result.data.finding)
      }
    }

    return result.data?.finding
  },

  async deleteFinding(id: string) {
    const result = await findingsApi.delete(id)

    if (result.error) {
      setState("error", result.error)
      return false
    }

    // Remove from list
    setState(
      "findings",
      state.findings.filter((f) => f.id !== id)
    )
    setState("total", state.total - 1)

    // Clear selected if same
    if (state.selectedFinding?.id === id) {
      setState("selectedFinding", null)
    }

    return true
  },

  setFilters(filters: FindingFilters) {
    setState("filters", filters)
  },

  clearSelectedFinding() {
    setState("selectedFinding", null)
  },

  // SSE integration
  setupRealtimeUpdates() {
    const unsubCreate = sseClient.on("pentest.finding_created", (event) => {
      const finding = event.properties.finding as Finding
      if (finding) {
        setState(
          "findings",
          produce((findings) => {
            findings.unshift(finding)
          })
        )
        setState("total", state.total + 1)
      }
    })

    const unsubUpdate = sseClient.on("pentest.finding_updated", (event) => {
      const finding = event.properties.finding as Finding
      if (finding) {
        setState(
          "findings",
          produce((findings) => {
            const idx = findings.findIndex((f) => f.id === finding.id)
            if (idx >= 0) {
              findings[idx] = finding
            }
          })
        )

        if (state.selectedFinding?.id === finding.id) {
          setState("selectedFinding", finding)
        }
      }
    })

    return () => {
      unsubCreate()
      unsubUpdate()
    }
  },
}

// Helper hooks
export function useFindingsStore() {
  return findingsStore
}

export function useFindings() {
  const [loading, setLoading] = createSignal(true)

  createEffect(() => {
    findingsStore.fetchFindings().then(() => setLoading(false))
  })

  onCleanup(findingsStore.setupRealtimeUpdates())

  return {
    findings: () => state.findings,
    loading,
    error: () => state.error,
    total: () => state.total,
    refetch: () => findingsStore.fetchFindings(),
  }
}
