# CyxCode website

The public CyxCode website in Astro and Tailwind. This is separate from the runtime web app in `packages/app`.

## Develop and preview

From `WEB/`:

```sh
bun install --frozen-lockfile
bun run dev
```

The development server uses http://localhost:4321. To review the production output, stop the development server, run `bun run build`, then `bun run preview`.

The Astro root uses the real filesystem path so differing Windows path casing does not separate page IDs from their styles. Caches remain inside this directory. The build also checks that every generated page includes styles and that linked stylesheet files exist.

## GitHub Pages

The existing `pages-web.yml` workflow publishes `WEB/dist` from `dev`. In GitHub Actions, the site uses the `/cyxcode` base path. All internal links and public assets must use `route()` from `src/data/site.ts`.

To verify that deployment layout locally in PowerShell:

```powershell
$env:GITHUB_ACTIONS = "true"
bun run build
bun run preview --port 4323
# Open http://localhost:4323/cyxcode/
```

Remove the environment override before resuming root-path development.

## Design and content

- Shared colors, typography, focus states, and responsive layout: `src/styles/globals.css`.
- Header, footer, metadata, and clipboard controls: `src/components/`.
- Homepage terminal: a labeled, interactive illustration with no fabricated live usage counters.
- The existing CyxCode recording loads on demand; `public/gallery/demo-poster.jpg` is a still from that recording.
- Installation and provider access: `src/pages/install.astro`. Keep this aligned with the repository README. CyxCode does not promise access to OpenCode Zen's anonymous free tier.
- CyxCode's ASCII logo, feature names, and OpenCode attribution are retained.

## Review before publishing

Build successfully, then check all eight pages at desktop and mobile sizes. Verify the menu, keyboard focus, terminal scene buttons, install copying (including denied clipboard access), FAQ disclosures, links, video playback, and the `/cyxcode` deployment prefix. Page content and navigation remain available without JavaScript; interactive terminal scene switching and copying require it.
