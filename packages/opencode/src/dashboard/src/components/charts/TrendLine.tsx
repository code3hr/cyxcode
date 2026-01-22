import { Component, createMemo, For } from "solid-js"

interface TrendData {
  date: string
  created: number
  mitigated: number
}

interface TrendLineProps {
  data: TrendData[]
  height?: number
}

export const TrendLine: Component<TrendLineProps> = (props) => {
  const height = () => props.height || 200
  const width = 600
  const padding = { top: 20, right: 20, bottom: 30, left: 40 }

  const chartWidth = width - padding.left - padding.right
  const chartHeight = () => height() - padding.top - padding.bottom

  const maxValue = createMemo(() => {
    let max = 0
    for (const d of props.data) {
      max = Math.max(max, d.created, d.mitigated)
    }
    return Math.max(max, 1)
  })

  const scaleX = (index: number) => {
    if (props.data.length <= 1) return padding.left + chartWidth / 2
    return padding.left + (index / (props.data.length - 1)) * chartWidth
  }

  const scaleY = (value: number) => {
    return padding.top + chartHeight() - (value / maxValue()) * chartHeight()
  }

  const createdPath = createMemo(() => {
    if (props.data.length === 0) return ""
    return props.data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(d.created)}`)
      .join(" ")
  })

  const mitigatedPath = createMemo(() => {
    if (props.data.length === 0) return ""
    return props.data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(d.mitigated)}`)
      .join(" ")
  })

  // Y-axis ticks
  const yTicks = createMemo(() => {
    const max = maxValue()
    const step = Math.ceil(max / 4)
    const ticks = []
    for (let i = 0; i <= max; i += step) {
      ticks.push(i)
    }
    return ticks
  })

  return (
    <div class="overflow-x-auto">
      <svg width={width} height={height()} class="text-gray-400">
        {/* Grid lines */}
        <For each={yTicks()}>
          {(tick) => (
            <g>
              <line
                x1={padding.left}
                y1={scaleY(tick)}
                x2={width - padding.right}
                y2={scaleY(tick)}
                stroke="#374151"
                stroke-dasharray="2,2"
              />
              <text
                x={padding.left - 8}
                y={scaleY(tick) + 4}
                text-anchor="end"
                class="text-xs fill-gray-500"
              >
                {tick}
              </text>
            </g>
          )}
        </For>

        {/* X-axis labels (show every 7th for readability) */}
        <For each={props.data.filter((_, i) => i % 7 === 0 || i === props.data.length - 1)}>
          {(d, index) => {
            const actualIndex = props.data.indexOf(d)
            return (
              <text
                x={scaleX(actualIndex)}
                y={height() - 8}
                text-anchor="middle"
                class="text-xs fill-gray-500"
              >
                {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </text>
            )
          }}
        </For>

        {/* Created line */}
        <path
          d={createdPath()}
          fill="none"
          stroke="#ef4444"
          stroke-width="2"
        />

        {/* Mitigated line */}
        <path
          d={mitigatedPath()}
          fill="none"
          stroke="#22c55e"
          stroke-width="2"
        />

        {/* Data points */}
        <For each={props.data}>
          {(d, i) => (
            <g>
              <circle
                cx={scaleX(i())}
                cy={scaleY(d.created)}
                r="3"
                fill="#ef4444"
              >
                <title>{d.date}: {d.created} created</title>
              </circle>
              <circle
                cx={scaleX(i())}
                cy={scaleY(d.mitigated)}
                r="3"
                fill="#22c55e"
              >
                <title>{d.date}: {d.mitigated} mitigated</title>
              </circle>
            </g>
          )}
        </For>

        {/* Legend */}
        <g transform={`translate(${padding.left}, ${padding.top - 5})`}>
          <circle cx="0" cy="0" r="4" fill="#ef4444" />
          <text x="8" y="4" class="text-xs fill-gray-400">Created</text>
          <circle cx="80" cy="0" r="4" fill="#22c55e" />
          <text x="88" y="4" class="text-xs fill-gray-400">Mitigated</text>
        </g>
      </svg>
    </div>
  )
}
