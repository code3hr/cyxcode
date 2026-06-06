# To Fix: CyxCode Web Entrypoint

## Problem

`cyxcode web` and the local dashboard dev app currently behave like separate web entrypoints.

- `cyxcode web` starts the backend server and proxies unknown UI paths.
- The dashboard graph/wiki UI runs from the Vite dashboard app at `/dashboard/`.
- Local testing currently needs `CYXCODE_DASHBOARD_URL=http://127.0.0.1:3002` so `cyxcode web` serves the dashboard consistently.

This creates confusion about which URL is the real web app:

- `http://127.0.0.1:4096/`
- `http://127.0.0.1:4096/dashboard/`
- `http://127.0.0.1:3002/dashboard/`

## Fix Needed

Make `cyxcode web` serve the dashboard route consistently without requiring a manual `CYXCODE_DASHBOARD_URL` during local development.

## Acceptance

- `cyxcode web --hostname 127.0.0.1 --port 4096` opens one working web UI.
- `/dashboard/` and `/dashboard/graph` resolve through the CLI web server.
- The graph/wiki dashboard can call backend APIs without needing a separate manual proxy setup.
- Documentation names the canonical local web URL.
