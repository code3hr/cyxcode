# @cyxcode/web

Public CyxCode website and documentation app built with Astro and Starlight.

## Layout

- `src/content/docs` contains documentation pages.
- `src/content/i18n` contains localized UI strings.
- `src/components` contains shared Astro and Solid components.
- `src/pages` contains website routes outside the docs collection.
- `public` contains static assets served as-is.

## Commands

Install dependencies from the repository root when needed:

```sh
bun install
```

Run package commands from this directory:

```sh
cd packages/web
bun run dev
bun run dev:remote
bun run build
bun astro check
```

`dev` uses the local API URL configured by the app. `dev:remote` points the app at `https://api.cyxcode.ai`.

Run validation from this package directory, not from the repository root.
