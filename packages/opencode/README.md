# cyxcode

Core CyxCode agent package and CLI entry point.

## Commands

Run these from this directory:

```sh
bun install
bun run dev
bun run build
bun run typecheck
bun run test
```

## Notes

- `src` contains the agent, CLI, and supporting modules.
- `bin/cyxcode` is the published executable entry point.
- `bun run script/build.ts` is the package build pipeline used for releases.
