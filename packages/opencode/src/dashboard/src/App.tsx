import { Component, createSignal, onMount, onCleanup, lazy, Suspense, ParentProps } from "solid-js"
import { Router, Route } from "@solidjs/router"
import { Layout } from "./components/layout/Layout"
import { sseClient } from "./api/sse"

// Lazy load pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Findings = lazy(() => import("./pages/Findings"))
const Scans = lazy(() => import("./pages/Scans"))
const Monitors = lazy(() => import("./pages/Monitors"))
const Compliance = lazy(() => import("./pages/Compliance"))
const Reports = lazy(() => import("./pages/Reports"))

const Loading: Component = () => (
  <div class="flex items-center justify-center h-64">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
)

export const App: Component = () => {
  const [connected, setConnected] = createSignal(false)

  onMount(() => {
    // Connect to SSE for real-time updates
    sseClient.connect()
    sseClient.onConnect(() => setConnected(true))
    sseClient.onDisconnect(() => setConnected(false))
  })

  onCleanup(() => {
    sseClient.disconnect()
  })

  const RootLayout = (props: ParentProps) => (
    <Layout connected={connected()}>
      <Suspense fallback={<Loading />}>
        {props.children}
      </Suspense>
    </Layout>
  )

  return (
    <Router base="/dashboard" root={RootLayout}>
      <Route path="/" component={Dashboard} />
      <Route path="/findings" component={Findings} />
      <Route path="/findings/:id" component={Findings} />
      <Route path="/scans" component={Scans} />
      <Route path="/scans/:id" component={Scans} />
      <Route path="/monitors" component={Monitors} />
      <Route path="/monitors/:id" component={Monitors} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/compliance/:framework" component={Compliance} />
      <Route path="/reports" component={Reports} />
    </Router>
  )
}
