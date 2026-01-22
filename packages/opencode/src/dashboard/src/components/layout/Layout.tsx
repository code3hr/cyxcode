import { Component, JSX } from "solid-js"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"

interface LayoutProps {
  children: JSX.Element
  connected: boolean
}

export const Layout: Component<LayoutProps> = (props) => {
  return (
    <div class="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header connected={props.connected} />

        {/* Page content */}
        <main class="flex-1 overflow-y-auto p-6">
          {props.children}
        </main>
      </div>
    </div>
  )
}
