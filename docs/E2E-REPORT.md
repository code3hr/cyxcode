# CyxCode E2E Report

This document records the deterministic prompt e2e coverage added for CyxCode.

## Process

The e2e pass was built as a narrow smoke, not a broad UI suite. The path we verified was:

1. Start from the app package, not the repo root.
2. Use the local e2e harness so the app launches in a controlled way.
3. Send a prompt through the SDK path, not keyboard simulation.
4. Wait for the assistant reply to contain a known token.
5. Record the Playwright report output so the run is inspectable later.

## Scope

The goal is a stable signal that the prompt path still works end to end:

- backend prompt submission succeeds
- the local browser smoke can send a prompt
- the assistant reply is returned to the session

## Current Smoke

The primary smoke is:

```bash
cd packages/app
bun run test:e2e:local -- --grep "can send a prompt and receive a reply"
```

That local harness wires the app server and Playwright together, then runs the focused prompt spec in Chromium.

The prompt spec itself lives at:

- [packages/app/e2e/prompt/prompt.spec.ts](../packages/app/e2e/prompt/prompt.spec.ts)

## Validation

The e2e work was validated with these commands:

```bash
cd packages/opencode && bun typecheck
cd packages/app && bun typecheck
cd packages/opencode && bun test --preload ./test/preload.ts ./test/session/prompt.test.ts
cd packages/app && bun run test:e2e:local -- --grep "can send a prompt and receive a reply"
```

## Verification Path

The coverage we validated includes:

- `packages/opencode/test/session/prompt.test.ts`
- `packages/app/e2e/prompt/prompt.spec.ts`
- `bun typecheck` in `packages/opencode`
- `bun typecheck` in `packages/app`

## What The Smoke Checks

The test sends a prompt through `sdk.session.promptAsync`, then waits for a reply token in the assistant messages.

Pass criteria:

- a session is created
- a prompt is submitted
- the assistant reply contains the expected token

## Outputs

Playwright writes its HTML report and test artifacts under `packages/app/e2e/`:

- `packages/app/e2e/playwright-report`
- `packages/app/e2e/test-results`

If the run fails, those artifacts are the first place to inspect.

## Current Status

This smoke passed when it was added and tagged in the current `dev` history.

## Limitations

- This is a deterministic smoke, not full product coverage.
- It does not prove every provider, shell mode path, or release artifact is healthy.
- It is intended as a practical “moment of truth” check for the prompt path.

## Notes

- The backend smoke uses `sdk.session.promptAsync(...)` instead of typing into the TUI.
- The reply check looks for an exact token so the assertion is deterministic.
- The coverage is meant to catch prompt-path regressions without making the suite fragile.
