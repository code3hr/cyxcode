import { Component, Show } from "solid-js"

interface HeaderProps {
  connected: boolean
}

export const Header: Component<HeaderProps> = (props) => {
  return (
    <header class="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
      {/* Left side - Page title could go here */}
      <div class="flex items-center gap-4">
        <h1 class="text-lg font-semibold text-gray-100">Security Dashboard</h1>
      </div>

      {/* Right side */}
      <div class="flex items-center gap-4">
        {/* Connection status */}
        <div class="flex items-center gap-2">
          <div
            class={`w-2 h-2 rounded-full ${props.connected ? "bg-green-500" : "bg-red-500"}`}
            title={props.connected ? "Connected" : "Disconnected"}
          />
          <span class="text-sm text-gray-400">
            {props.connected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Refresh button */}
        <button
          class="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded-lg transition-colors"
          title="Refresh data"
          onClick={() => window.location.reload()}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Time */}
        <div class="text-sm text-gray-400">
          {new Date().toLocaleTimeString()}
        </div>
      </div>
    </header>
  )
}
