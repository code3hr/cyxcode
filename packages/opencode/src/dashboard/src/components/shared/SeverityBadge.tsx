import { Component } from "solid-js"

interface SeverityBadgeProps {
  severity: "critical" | "high" | "medium" | "low" | "info"
  size?: "sm" | "md"
}

const severityConfig = {
  critical: { bg: "bg-red-900", text: "text-red-200", label: "Critical" },
  high: { bg: "bg-orange-900", text: "text-orange-200", label: "High" },
  medium: { bg: "bg-yellow-900", text: "text-yellow-200", label: "Medium" },
  low: { bg: "bg-blue-900", text: "text-blue-200", label: "Low" },
  info: { bg: "bg-gray-700", text: "text-gray-300", label: "Info" },
}

export const SeverityBadge: Component<SeverityBadgeProps> = (props) => {
  const config = () => severityConfig[props.severity] || severityConfig.info
  const sizeClasses = () => props.size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-xs"

  return (
    <span
      class={`badge ${config().bg} ${config().text} ${sizeClasses()}`}
    >
      {config().label}
    </span>
  )
}
