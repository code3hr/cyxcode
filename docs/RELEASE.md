# CyxCode Release Checks

This page records the local release smoke path used during cleanup and release verification.

## Release Smoke Harness

Run the smoke harness from `packages/opencode`.

```bash
cd packages/opencode
bun run script/smoke-release.ts --version <version>
```

Use `--exe` when testing a manually downloaded or locally built binary.

```bash
cd packages/opencode
bun run script/smoke-release.ts --exe ../../.release-smoke/<version>/bin/cyxcode.exe
```

Useful options:

- `--port <number>` defaults to `4211`.
- `--startup-ms <number>` defaults to `60000`.
- `--request-ms <number>` defaults to `10000`.
- `--root <path>` defaults to `.release-smoke/<version>/smoke-run`.

The harness starts `cyxcode serve`, waits for readiness, then probes:

- `/path`
- `/experimental/codegraph/graph`

It writes server logs under `.release-smoke/.../logs/`. `.release-smoke/` is local generated state and should stay ignored.

## Cleanup Rule

After release smoke work, the normal repository state should not include generated smoke output, downloaded binaries, runtime databases, or logs.
