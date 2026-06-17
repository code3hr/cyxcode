# @cyxcode/console-app

CyxCode console web app built with SolidStart.

## Commands

Run these from this directory:

```sh
bun install
bun run dev
bun run build
bun run typecheck
```

`dev` starts the local console UI. `build` produces the production bundle and generates the sitemap used by the app.

## Notes

- `src` contains the app code and routes.
- `script` contains build helpers.
- `bun sst shell --stage=dev bun dev` runs the app against the remote dev services when needed.
