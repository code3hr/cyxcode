import { Component, createMemo, For, Show } from "solid-js"

interface StatusBarProps {
  data: Record<string, number>
  height?: number
}

const statusColors: Record<string, string> = {
  open: "#ef4444",
  confirmed: "#f97316",
  mitigated: "#22c55e",
  false_positive: "#6b7280",
  // Compliance
  pass: "#22c55e",
  fail: "#ef4444",
  partial: "#eab308",
  not_assessed: "#6b7280",
}

const statusLabels: Record<string, string> = {
  open: "Open",
  confirmed: "Confirmed",
  mitigated: "Mitigated",
  false_positive: "False Positive",
  pass: "Pass",
  fail: "Fail",
  partial: "Partial",
  not_assessed: "Not Assessed",
}

export const StatusBar: Component<StatusBarProps> = (props) => {
  const height = () => props.height || 24

  const total = createMemo(() => {
    return Object.values(props.data).reduce((a, b) => a + b, 0)
  })

  const segments = createMemo(() => {
    if (total() === 0) return []

    return Object.entries(props.data)
      .filter(([_, value]) => value > 0)
      .map(([status, value]) => ({
        status,
        value,
        percentage: (value / total()) * 100,
        color: statusColors[status] || "#6b7280",
        label: statusLabels[status] || status,
      }))
  })

  return (
    <div class="space-y-2">
      {/* Bar */}
      <div
        class="w-full rounded-full overflow-hidden flex"
        style={{ height: `${height()}px` }}
      >
        <Show when={total() === 0}>
          <div class="w-full bg-gray-700" />
        </Show>
        <For each={segments()}>
          {(segment) => (
            <div
              class="h-full transition-all duration-300"
              style={{
                width: `${segment.percentage}%`,
                "background-color": segment.color,
              }}
              title={`${segment.label}: ${segment.value} (${segment.percentage.toFixed(1)}%)`}
            />
          )}
        </For>
      </div>

      {/* Legend */}
      <div class="flex flex-wrap gap-4 text-sm">
        <For each={segments()}>
          {(segment) => (
            <div class="flex items-center gap-2">
              <div
                class="w-3 h-3 rounded-full"
                style={{ "background-color": segment.color }}
              />
              <span class="text-gray-400">{segment.label}:</span>
              <span class="text-gray-100 font-medium">{segment.value}</span>
              <span class="text-gray-500">({segment.percentage.toFixed(0)}%)</span>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
