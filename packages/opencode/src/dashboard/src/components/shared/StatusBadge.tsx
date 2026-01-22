import { Component } from "solid-js"

interface StatusBadgeProps {
  status: "open" | "confirmed" | "mitigated" | "false_positive" | string
  size?: "sm" | "md"
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-red-900", text: "text-red-200", label: "Open" },
  confirmed: { bg: "bg-orange-900", text: "text-orange-200", label: "Confirmed" },
  mitigated: { bg: "bg-green-900", text: "text-green-200", label: "Mitigated" },
  false_positive: { bg: "bg-gray-700", text: "text-gray-300", label: "False Positive" },
  // Monitor statuses
  active: { bg: "bg-green-900", text: "text-green-200", label: "Active" },
  paused: { bg: "bg-yellow-900", text: "text-yellow-200", label: "Paused" },
  disabled: { bg: "bg-gray-700", text: "text-gray-300", label: "Disabled" },
  error: { bg: "bg-red-900", text: "text-red-200", label: "Error" },
  // Run statuses
  running: { bg: "bg-blue-900", text: "text-blue-200", label: "Running" },
  completed: { bg: "bg-green-900", text: "text-green-200", label: "Completed" },
  failed: { bg: "bg-red-900", text: "text-red-200", label: "Failed" },
  cancelled: { bg: "bg-gray-700", text: "text-gray-300", label: "Cancelled" },
  // Compliance statuses
  pass: { bg: "bg-green-900", text: "text-green-200", label: "Pass" },
  fail: { bg: "bg-red-900", text: "text-red-200", label: "Fail" },
  partial: { bg: "bg-yellow-900", text: "text-yellow-200", label: "Partial" },
  not_assessed: { bg: "bg-gray-700", text: "text-gray-300", label: "Not Assessed" },
}

export const StatusBadge: Component<StatusBadgeProps> = (props) => {
  const config = () => statusConfig[props.status] || { bg: "bg-gray-700", text: "text-gray-300", label: props.status }
  const sizeClasses = () => props.size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-xs"

  return (
    <span
      class={`badge ${config().bg} ${config().text} ${sizeClasses()}`}
    >
      {config().label}
    </span>
  )
}
