import { Component, JSX } from "solid-js"
import { Header } from "./Header"

interface LayoutProps {
  children: JSX.Element
  connected: boolean
}

export const Layout: Component<LayoutProps> = (props) => {
  return (
    <div class="dashboard-shell flex h-screen min-h-0 flex-col bg-[#0b1220] text-slate-100">
      <Header connected={props.connected} />
      <main class="page-shell min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {props.children}
      </main>
    </div>
  )
}
