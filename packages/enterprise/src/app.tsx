import { Router } from "@solidjs/router"
import { FileRoutes } from "@solidjs/start/router"
import { Font } from "@cyxcode/ui/font"
import { MetaProvider } from "@solidjs/meta"
import { MarkedProvider } from "@cyxcode/ui/context/marked"
import { DialogProvider } from "@cyxcode/ui/context/dialog"
import { Suspense } from "solid-js"
import "./app.css"
import { Favicon } from "@cyxcode/ui/favicon"

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <DialogProvider>
            <MarkedProvider>
              <Favicon />
              <Font />
              <Suspense>{props.children}</Suspense>
            </MarkedProvider>
          </DialogProvider>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
