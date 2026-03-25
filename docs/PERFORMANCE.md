# CyxCode Performance

## Response Times

Measured from user input to fix displayed in the TUI.

| Mode | Pattern Match | No Match | What Happens |
|------|--------------|----------|--------------|
| Shell (`!`) | **~50ms** | ~50ms (raw output) | Command runs directly. No AI. CyxCode checks patterns on output. |
| Normal + match | **~3-5s** | — | AI decides to run command (LLM Call #1). CyxCode matches, skips LLM Call #2. |
| Normal + no match | — | ~5-8s | AI decides to run command (LLM Call #1). AI analyzes error (LLM Call #2). |

## Token Usage

| Mode | Pattern Match | No Match |
|------|--------------|----------|
| Shell (`!`) | **0 tokens** | 0 tokens (no AI) |
| Normal + match | ~600 tokens (Call #1 only) | — |
| Normal + no match | — | ~1,200 tokens (Call #1 + #2) |

## Cost Per Error

Based on Claude Sonnet pricing (~$3/M input, ~$15/M output tokens):

| Mode | Cost per matched error | Cost per unmatched error |
|------|----------------------|------------------------|
| Shell (`!`) | **$0.00** | $0.00 (no AI) |
| Normal + match | ~$0.001 | — |
| Normal + no match | — | ~$0.002-0.003 |

## Session Savings Estimate

A typical development session involves 10-30 command errors. Assuming 60% match rate:

| Errors | Without CyxCode | With CyxCode (Normal) | With CyxCode (Shell) |
|--------|-----------------|----------------------|---------------------|
| 10 | ~12,000 tokens | ~4,800 tokens | **0 tokens** |
| 20 | ~24,000 tokens | ~9,600 tokens | **0 tokens** |
| 30 | ~36,000 tokens | ~14,400 tokens | **0 tokens** |

**Shell mode makes matched errors completely free.** Normal mode saves ~60% on matched errors.

## Pattern Matching Overhead

The CyxCode pattern matching itself adds negligible overhead:

- **136 regex checks**: ~1-2ms total
- **Memory**: ~50KB for all pattern objects
- **Initialization**: ~5ms (once per session, cached via `globalThis`)

Pattern matching is synchronous and runs in the same process — no network calls, no file I/O.

## How to Measure

Enable debug mode to see timing:

```bash
CYXCODE_DEBUG=1 bun run dev
```

The TUI shows cost in the top-right corner (e.g., `$0.00`). Compare this between:
- A matched error in shell mode (should show $0.00)
- The same error without the `!` prefix (should show some cost from LLM Call #1)
