import { Component, createSignal, createEffect, Show, For } from "solid-js"
import { useParams } from "@solidjs/router"
import {
  complianceApi,
  type ComplianceFramework,
  type ComplianceControl,
  type ComplianceAssessment,
} from "../api/client"
import { StatusBadge } from "../components/shared/StatusBadge"
import { ComplianceRadar } from "../components/charts/ComplianceRadar"
import { StatusBar } from "../components/charts/StatusBar"

const Compliance: Component = () => {
  const params = useParams()

  const [frameworks, setFrameworks] = createSignal<ComplianceFramework[]>([])
  const [selectedFramework, setSelectedFramework] = createSignal<ComplianceFramework | null>(null)
  const [controls, setControls] = createSignal<ComplianceControl[]>([])
  const [categories, setCategories] = createSignal<Array<{ id: string; name: string; description?: string }>>([])
  const [assessment, setAssessment] = createSignal<ComplianceAssessment | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [assessing, setAssessing] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null)

  const fetchFrameworks = async () => {
    setLoading(true)
    const result = await complianceApi.listFrameworks()

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setFrameworks(result.data.frameworks)
    }

    setLoading(false)
  }

  const selectFramework = async (frameworkId: string) => {
    setLoading(true)
    setAssessment(null)
    setSelectedCategory(null)

    const framework = frameworks().find((f) => f.id === frameworkId)
    setSelectedFramework(framework || null)

    const result = await complianceApi.getFramework(frameworkId)

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setControls(result.data.controls)
      setCategories(result.data.categories)
    }

    setLoading(false)
  }

  const runAssessment = async () => {
    if (!selectedFramework()) return

    setAssessing(true)
    setError(null)

    const result = await complianceApi.assess(selectedFramework()!.id)

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setAssessment(result.data.assessment)
    }

    setAssessing(false)
  }

  createEffect(() => {
    fetchFrameworks()
  })

  createEffect(() => {
    if (params.framework) {
      selectFramework(params.framework)
    }
  })

  const getControlsByCategory = (categoryId: string) => {
    return controls().filter((c) => c.category === categoryId)
  }

  const getAssessmentForControl = (controlId: string) => {
    if (!assessment()) return null
    return assessment()!.controls.find((c) => c.control.id === controlId)
  }

  const getCategoryScore = (categoryId: string) => {
    if (!assessment()) return null

    const categoryControls = assessment()!.controls.filter((c) => c.control.category === categoryId)
    const passed = categoryControls.filter((c) => c.status === "pass").length
    const failed = categoryControls.filter((c) => c.status === "fail").length
    const partial = categoryControls.filter((c) => c.status === "partial").length
    const total = categoryControls.length

    if (total === 0) return null

    return {
      passed,
      failed,
      partial,
      total,
      percentage: Math.round(((passed + partial * 0.5) / total) * 100),
    }
  }

  const getRadarData = () => {
    if (!assessment()) return []

    return categories().map((cat) => {
      const score = getCategoryScore(cat.id)
      return {
        category: cat.id,
        name: cat.name,
        percentage: score?.percentage || 0,
      }
    })
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Compliance</h1>
          <p class="text-gray-400 mt-1">Map findings to compliance frameworks</p>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error()}
        </div>
      </Show>

      {/* Framework selection */}
      <div class="card">
        <div class="card-header">Select Framework</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <For each={frameworks()}>
            {(framework) => (
              <button
                onClick={() => selectFramework(framework.id)}
                class={`p-4 rounded-lg border text-left transition-all ${
                  selectedFramework()?.id === framework.id
                    ? "border-blue-500 bg-blue-900/20"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <div class="font-medium text-gray-100">{framework.name}</div>
                <div class="text-sm text-gray-400 mt-1">v{framework.version}</div>
                <div class="text-xs text-gray-500 mt-2">
                  {framework.controlCount} controls
                </div>
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={selectedFramework()}>
        {/* Assessment panel */}
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-100">
                {selectedFramework()!.name} Assessment
              </h3>
              <p class="text-sm text-gray-400 mt-1">{selectedFramework()!.description}</p>
            </div>
            <button
              onClick={runAssessment}
              disabled={assessing()}
              class="btn btn-primary disabled:opacity-50"
            >
              {assessing() ? (
                <span class="flex items-center gap-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Assessing...
                </span>
              ) : assessment() ? (
                "Re-run Assessment"
              ) : (
                "Run Assessment"
              )}
            </button>
          </div>

          <Show when={assessment()}>
            {/* Score overview */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Overall score */}
              <div class="bg-gray-900 rounded-lg p-6">
                <div class="text-center mb-4">
                  <div
                    class={`text-5xl font-bold ${
                      assessment()!.score.percentage >= 80
                        ? "text-green-400"
                        : assessment()!.score.percentage >= 50
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {assessment()!.score.percentage}%
                  </div>
                  <div class="text-gray-400 mt-2">Overall Compliance Score</div>
                </div>
                <StatusBar
                  data={{
                    pass: assessment()!.score.passed,
                    partial: assessment()!.score.partial,
                    fail: assessment()!.score.failed,
                    not_assessed: assessment()!.score.notAssessed,
                  }}
                  height={24}
                />
              </div>

              {/* Radar chart */}
              <div class="bg-gray-900 rounded-lg p-4">
                <ComplianceRadar data={getRadarData()} size={280} />
              </div>
            </div>

            {/* Category scores */}
            <div class="space-y-2">
              <div class="text-sm text-gray-400 mb-2">Categories</div>
              <For each={categories()}>
                {(category) => {
                  const score = getCategoryScore(category.id)
                  return (
                    <button
                      onClick={() =>
                        setSelectedCategory(selectedCategory() === category.id ? null : category.id)
                      }
                      class={`w-full p-3 rounded-lg border text-left transition-all ${
                        selectedCategory() === category.id
                          ? "border-blue-500 bg-blue-900/20"
                          : "border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      <div class="flex items-center justify-between">
                        <div>
                          <div class="font-medium text-gray-100">
                            {category.id}. {category.name}
                          </div>
                          <Show when={category.description}>
                            <div class="text-xs text-gray-500 mt-1">{category.description}</div>
                          </Show>
                        </div>
                        <Show when={score}>
                          <div class="flex items-center gap-4">
                            <div class="text-sm text-gray-400">
                              {score!.passed}/{score!.total} passed
                            </div>
                            <div
                              class={`text-lg font-bold ${
                                score!.percentage >= 80
                                  ? "text-green-400"
                                  : score!.percentage >= 50
                                  ? "text-yellow-400"
                                  : "text-red-400"
                              }`}
                            >
                              {score!.percentage}%
                            </div>
                          </div>
                        </Show>
                      </div>

                      {/* Expanded controls */}
                      <Show when={selectedCategory() === category.id}>
                        <div class="mt-4 space-y-2 border-t border-gray-700 pt-4">
                          <For each={getControlsByCategory(category.id)}>
                            {(control) => {
                              const controlAssessment = getAssessmentForControl(control.id)
                              return (
                                <div class="bg-gray-800 p-3 rounded">
                                  <div class="flex items-center justify-between">
                                    <div class="flex-1">
                                      <div class="text-sm font-medium text-gray-200">
                                        {control.id} - {control.name}
                                      </div>
                                      <div class="text-xs text-gray-500 mt-1">
                                        {control.description}
                                      </div>
                                    </div>
                                    <Show when={controlAssessment}>
                                      <div class="ml-4 flex items-center gap-2">
                                        <StatusBadge status={controlAssessment!.status} />
                                        <Show when={controlAssessment!.findings.length > 0}>
                                          <span class="text-xs text-gray-400">
                                            ({controlAssessment!.findings.length} findings)
                                          </span>
                                        </Show>
                                      </div>
                                    </Show>
                                  </div>
                                  <Show when={controlAssessment?.notes}>
                                    <div class="mt-2 text-xs text-gray-400 bg-gray-900 p-2 rounded">
                                      {controlAssessment!.notes}
                                    </div>
                                  </Show>
                                </div>
                              )
                            }}
                          </For>
                        </div>
                      </Show>
                    </button>
                  )
                }}
              </For>
            </div>

            {/* Assessment timestamp */}
            <div class="text-xs text-gray-500 mt-4 text-right">
              Assessment run: {new Date(assessment()!.timestamp).toLocaleString()}
            </div>
          </Show>

          <Show when={!assessment() && !assessing()}>
            <div class="text-center py-12 text-gray-400">
              <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p>Run an assessment to see how your findings map to {selectedFramework()!.name} controls.</p>
              <p class="text-sm text-gray-500 mt-2">
                The assessment will automatically map your security findings to compliance controls.
              </p>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={!selectedFramework() && !loading()}>
        <div class="text-center py-12 text-gray-400">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p>Select a compliance framework to begin.</p>
        </div>
      </Show>
    </div>
  )
}

export default Compliance
