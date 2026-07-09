# WEB

Static Astro/Tailwind site scaffold for the CyxCode standalone website.

## Quick start

1. `cd WEB`
2. `bun install`
3. `bun run dev` (serves on `http://localhost:4321`)

Open the local URL from Astro output.

## Build

From `WEB/`: `bun run build`

## Structure

- `src/pages/index.astro` — landing page
- `src/components/cyxcode-logo.astro` — logo block
- `src/styles/globals.css` — shared visual system
- `tailwind.config.mjs` + `astro.config.mjs` + `tsconfig.json`
