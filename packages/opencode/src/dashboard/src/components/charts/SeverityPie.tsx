import { Component, createMemo, For } from "solid-js"

interface SeverityPieProps {
  data: Record<string, number>
  size?: number
}

const severityColors = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#2563eb",
  info: "#6b7280",
}

export const SeverityPie: Component<SeverityPieProps> = (props) => {
  const size = () => props.size || 200
  const center = () => size() / 2
  const radius = () => size() / 2 - 10

  const segments = createMemo(() => {
    const total = Object.values(props.data).reduce((a, b) => a + b, 0)
    if (total === 0) return []

    const result: Array<{
      severity: string
      value: number
      percentage: number
      startAngle: number
      endAngle: number
      color: string
    }> = []

    let currentAngle = -90 // Start at top

    const order = ["critical", "high", "medium", "low", "info"]
    for (const severity of order) {
      const value = props.data[severity] || 0
      if (value === 0) continue

      const percentage = (value / total) * 100
      const angle = (value / total) * 360

      result.push({
        severity,
        value,
        percentage,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        color: severityColors[severity as keyof typeof severityColors] || "#6b7280",
      })

      currentAngle += angle
    }

    return result
  })

  const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(center(), center(), radius(), endAngle)
    const end = polarToCartesian(center(), center(), radius(), startAngle)
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"

    return [
      "M", center(), center(),
      "L", start.x, start.y,
      "A", radius(), radius(), 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ")
  }

  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = (angle * Math.PI) / 180
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    }
  }

  const total = createMemo(() => Object.values(props.data).reduce((a, b) => a + b, 0))

  return (
    <div class="flex items-center gap-4">
      <svg width={size()} height={size()} class="transform -rotate-0">
        {total() === 0 ? (
          <circle
            cx={center()}
            cy={center()}
            r={radius()}
            fill="none"
            stroke="#374151"
            stroke-width="2"
          />
        ) : (
          <For each={segments()}>
            {(segment) => (
              <path
                d={describeArc(segment.startAngle, segment.endAngle)}
                fill={segment.color}
                stroke="#1f2937"
                stroke-width="1"
              >
                <title>{segment.severity}: {segment.value} ({segment.percentage.toFixed(1)}%)</title>
              </path>
            )}
          </For>
        )}
        {/* Center hole for donut effect */}
        <circle cx={center()} cy={center()} r={radius() * 0.6} fill="#1f2937" />
        {/* Center text */}
        <text
          x={center()}
          y={center() - 8}
          text-anchor="middle"
          class="fill-gray-100 text-2xl font-bold"
        >
          {total()}
        </text>
        <text
          x={center()}
          y={center() + 12}
          text-anchor="middle"
          class="fill-gray-400 text-xs"
        >
          Findings
        </text>
      </svg>

      {/* Legend */}
      <div class="space-y-2">
        <For each={segments()}>
          {(segment) => (
            <div class="flex items-center gap-2 text-sm">
              <div
                class="w-3 h-3 rounded-full"
                style={{ "background-color": segment.color }}
              />
              <span class="text-gray-400 capitalize">{segment.severity}:</span>
              <span class="text-gray-100 font-medium">{segment.value}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
