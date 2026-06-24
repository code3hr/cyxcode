# CyxCode Web Entrypoint

`cyxcode web` starts one local CyxCode server and serves both browser UIs from
the same port.

Canonical local URLs:

```text
http://127.0.0.1:4096/app/
http://127.0.0.1:4096/dashboard/
```

The release package includes:

- `bin/app` for the main web/TUI app at `/app/`
- `bin/dashboard` for CyxWatch, reports, and graph views at `/dashboard/`

The root URL redirects to `/app/`.

Development overrides remain available:

```text
CYXCODE_APP_URL=http://127.0.0.1:3000
CYXCODE_DASHBOARD_URL=http://127.0.0.1:3002
```

Normal installed builds should not need either override.
