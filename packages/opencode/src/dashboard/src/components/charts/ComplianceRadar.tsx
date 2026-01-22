import { Component, createMemo, For } from "solid-js"

interface CategoryScore {
  category: string
  name: string
  percentage: number
}

interface ComplianceRadarProps {
  data: CategoryScore[]
  size?: number
}

export const ComplianceRadar: Component<ComplianceRadarProps> = (props) => {
  const size = () => props.size || 300
  const center = () => size() / 2
  const maxRadius = () => (size() / 2) - 40

  const points = createMemo(() => {
    const count = props.data.length
    if (count === 0) return []

    const angleStep = (2 * Math.PI) / count

    return props.data.map((d, i) => {
      const angle = angleStep * i - Math.PI / 2 // Start at top
      const radius = (d.percentage / 100) * maxRadius()
      return {
        ...d,
        x: center() + radius * Math.cos(angle),
        y: center() + radius * Math.sin(angle),
        labelX: center() + (maxRadius() + 20) * Math.cos(angle),
        labelY: center() + (maxRadius() + 20) * Math.sin(angle),
        angle,
      }
    })
  })

  const polygonPath = createMemo(() => {
    if (points().length === 0) return ""
    return points()
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ") + " Z"
  })

  // Generate concentric circles for grid
  const gridCircles = [20, 40, 60, 80, 100]

  // Generate axis lines
  const axisLines = createMemo(() => {
    const count = props.data.length
    if (count === 0) return []

    const angleStep = (2 * Math.PI) / count

    return props.data.map((_, i) => {
      const angle = angleStep * i - Math.PI / 2
      return {
        x: center() + maxRadius() * Math.cos(angle),
        y: center() + maxRadius() * Math.sin(angle),
      }
    })
  })

  return (
    <div class="flex flex-col items-center">
      <svg width={size()} height={size()}>
        {/* Grid circles */}
        <For each={gridCircles}>
          {(pct) => (
            <circle
              cx={center()}
              cy={center()}
              r={(pct / 100) * maxRadius()}
              fill="none"
              stroke="#374151"
              stroke-width="1"
            />
          )}
        </For>

        {/* Axis lines */}
        <For each={axisLines()}>
          {(line) => (
            <line
              x1={center()}
              y1={center()}
              x2={line.x}
              y2={line.y}
              stroke="#374151"
              stroke-width="1"
            />
          )}
        </For>

        {/* Data polygon */}
        <path
          d={polygonPath()}
          fill="rgba(59, 130, 246, 0.3)"
          stroke="#3b82f6"
          stroke-width="2"
        />

        {/* Data points */}
        <For each={points()}>
          {(point) => (
            <g>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#3b82f6"
              >
                <title>{point.name}: {point.percentage}%</title>
              </circle>
            </g>
          )}
        </For>

        {/* Labels */}
        <For each={points()}>
          {(point) => (
            <text
              x={point.labelX}
              y={point.labelY}
              text-anchor={
                Math.abs(point.angle + Math.PI / 2) < 0.1 ? "middle" :
                Math.cos(point.angle) > 0 ? "start" : "end"
              }
              dominant-baseline="middle"
              class="text-xs fill-gray-400"
            >
              {point.category}
            </text>
          )}
        </For>

        {/* Center percentage labels */}
        <For each={gridCircles}>
          {(pct) => (
            <text
              x={center() + 5}
              y={center() - (pct / 100) * maxRadius()}
              class="text-xs fill-gray-500"
            >
              {pct}%
            </text>
          )}
        </For>
      </svg>

      {/* Legend */}
      <div class="mt-4 grid grid-cols-2 gap-2 text-sm">
        <For each={props.data}>
          {(item) => (
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-blue-500" />
              <span class="text-gray-400">{item.name}:</span>
              <span class={`font-medium ${
                item.percentage >= 80 ? "text-green-400" :
                item.percentage >= 50 ? "text-yellow-400" :
                "text-red-400"
              }`}>
                {item.percentage}%
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
