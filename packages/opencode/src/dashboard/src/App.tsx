import { Component, createSignal, onMount, onCleanup, lazy, Suspense, ParentProps } from "solid-js"
import { Navigate, Router, Route } from "@solidjs/router"
import { Layout } from "./components/layout/Layout"
import { sseClient } from "./api/sse"

// Lazy load pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Findings = lazy(() => import("./pages/Findings"))
const Scans = lazy(() => import("./pages/Scans"))
const Monitors = lazy(() => import("./pages/Monitors"))
const Compliance = lazy(() => import("./pages/Compliance"))
const Reports = lazy(() => import("./pages/Reports"))
const Wiki = lazy(() => import("./pages/Wiki"))
const Graph = lazy(() => import("./pages/Graph"))
const Memory = lazy(() => import("./pages/Memory"))
const Tokens = lazy(() => import("./pages/Tokens"))
const Security = lazy(() => import("./pages/Security"))

const Loading: Component = () => (
  <div class="flex items-center justify-center h-64 text-sm text-gray-400">
    <span class="animate-pulse">Loading dashboard...</span>
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
      <Route path="/graph" component={Graph} />
      <Route path="/codegraph" component={() => <Navigate href="/graph" />} />
      <Route path="/memory" component={Memory} />
      <Route path="/wiki" component={Wiki} />
      <Route path="/tokens" component={Tokens} />
      <Route path="/security" component={Security} />
    </Router>
  )
}
