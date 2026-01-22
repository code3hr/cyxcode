/**
 * Compliance Store
 *
 * Reactive state management for compliance frameworks and assessments.
 */

import { createSignal, createEffect } from "solid-js"
import { createStore } from "solid-js/store"
import {
  complianceApi,
  type ComplianceFramework,
  type ComplianceControl,
  type ComplianceAssessment,
} from "../api/client"

export interface ComplianceState {
  frameworks: ComplianceFramework[]
  selectedFramework: string | null
  controls: ComplianceControl[]
  categories: Array<{ id: string; name: string; description?: string }>
  assessment: ComplianceAssessment | null
  loading: boolean
  assessing: boolean
  error: string | null
}

const [state, setState] = createStore<ComplianceState>({
  frameworks: [],
  selectedFramework: null,
  controls: [],
  categories: [],
  assessment: null,
  loading: false,
  assessing: false,
  error: null,
})

export const complianceStore = {
  get state() {
    return state
  },

  async fetchFrameworks() {
    setState("loading", true)
    setState("error", null)

    const result = await complianceApi.listFrameworks()

    if (result.error) {
      setState("error", result.error)
      setState("loading", false)
      return
    }

    if (result.data) {
      setState("frameworks", result.data.frameworks)
    }

    setState("loading", false)
  },

  async selectFramework(frameworkId: string) {
    setState("loading", true)
    setState("error", null)
    setState("selectedFramework", frameworkId)

    const result = await complianceApi.getFramework(frameworkId)

    if (result.error) {
      setState("error", result.error)
      setState("loading", false)
      return
    }

    if (result.data) {
      setState("controls", result.data.controls)
      setState("categories", result.data.categories)
    }

    setState("loading", false)
  },

  async runAssessment(frameworkId?: string) {
    const framework = frameworkId || state.selectedFramework
    if (!framework) {
      setState("error", "No framework selected")
      return null
    }

    setState("assessing", true)
    setState("error", null)

    const result = await complianceApi.assess(framework)

    if (result.error) {
      setState("error", result.error)
      setState("assessing", false)
      return null
    }

    if (result.data) {
      setState("assessment", result.data.assessment)
    }

    setState("assessing", false)
    return result.data?.assessment
  },

  clearAssessment() {
    setState("assessment", null)
  },

  clearFramework() {
    setState("selectedFramework", null)
    setState("controls", [])
    setState("categories", [])
    setState("assessment", null)
  },

  getControlsByCategory(categoryId: string): ComplianceControl[] {
    return state.controls.filter((c) => c.category === categoryId)
  },

  getAssessmentByCategory(categoryId: string) {
    if (!state.assessment) return null

    const categoryControls = state.assessment.controls.filter((c) => c.control.category === categoryId)

    const passed = categoryControls.filter((c) => c.status === "pass").length
    const failed = categoryControls.filter((c) => c.status === "fail").length
    const partial = categoryControls.filter((c) => c.status === "partial").length
    const total = categoryControls.length

    return {
      controls: categoryControls,
      score: {
        passed,
        failed,
        partial,
        total,
        percentage: total > 0 ? Math.round(((passed + partial * 0.5) / total) * 100) : 100,
      },
    }
  },
}

export function useCompliance() {
  const [loading, setLoading] = createSignal(true)

  createEffect(() => {
    complianceStore.fetchFrameworks().then(() => setLoading(false))
  })

  return {
    frameworks: () => state.frameworks,
    selectedFramework: () => state.selectedFramework,
    controls: () => state.controls,
    categories: () => state.categories,
    assessment: () => state.assessment,
    loading,
    assessing: () => state.assessing,
    error: () => state.error,
    selectFramework: complianceStore.selectFramework,
    runAssessment: complianceStore.runAssessment,
  }
}
