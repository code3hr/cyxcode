# Source-Derived Lean Software Guidance

This reference condenses Niklaus Wirth's 1995 article "A Plea for Lean Software" from `LeanSoftware.pdf`.

## Central argument

Software tends to grow because hardware growth makes waste affordable. The result is often slower, larger, less understandable software whose extra functionality does not match essential user value. The corrective is disciplined methodology and a return to essentials.

Use this principle during software engineering work: do not let available compute, modern frameworks, large memories, or package ecosystems justify avoidable complexity.

## Causes of fat software

- Vendors and teams often add features users do not need because quantity is easier to market than quality.
- Incompatibility with the original system concept may be ignored, producing cumbersome behavior.
- Monolithic design forces every possible feature into one system.
- Visual polish, extra commands, gadgets, and convenience features can hide real cost.
- Customer dependence can be more profitable than customer education; avoid building software that requires consulting or tribal knowledge to operate.
- Time pressure encourages quick additions and corrections instead of careful redesign.
- Bigger teams increase communication cost and can worsen design coherence.

## Design principles to apply

### Concentrate on essentials

Identify the essential model and workflow. Remove or defer anything that does not contribute directly to power, flexibility, or clear user convenience.

### Use strong language and type support

Prefer languages, APIs, and designs where invalid states and incompatible operations are caught early. Strong typing, explicit interfaces, and well-defined module boundaries reduce risk during change.

### Decompose into coherent modules

The hardest design work is finding the right decomposition. A good module has a precise interface, clear imports and exports, and responsibility that can be understood in isolation.

### Extend without broadening the core

Extensibility should let new modules and types integrate cleanly without changing the core. Keep the core small and let additional capabilities attach through narrow, safe extension points.

### Prefer primitives over proliferation

Identify primitives that offer broad flexibility. Avoid adding many similar operations, options, modes, and special cases when a smaller primitive set composes well.

### Load or activate only what is needed

Optional capabilities should not impose constant cost. Keep modules dormant until demanded, and avoid architectures where all code and data are permanently loaded.

### Simplify through iteration

Good engineering comes from gradual, stepwise refinement. After implementation, inspect whether the solution can be made smaller, clearer, and more coherent.

## Lessons adapted for modern coding agents

1. Use type systems, static checks, schemas, and tests to expose mistakes before runtime.
2. Spend design effort on module decomposition; avoid duplicated logic and unclear ownership.
3. Build extension mechanisms that preserve compatibility without exposing internals.
4. Choose flexible primitives carefully; do not add many derivatives when one primitive composes.
5. Keep systems understandable by an individual engineer or a small team.
6. Treat communication overhead as a design smell; unclear design often becomes process overhead.
7. Make reduction of complexity and size a goal at every step.
8. Gain experience through real implementation; design quality improves through direct programming work.
9. Polish programs until they are fit for publication: readable by humans, clear in intent, and respectful of future maintainers.

## Practical review prompts

- What is the smallest essential capability being delivered?
- Which code paths exist only because of feature accumulation?
- Which module boundaries would make this easier to reason about?
- Which types, schemas, or tests can replace comments, conventions, or runtime guesswork?
- Can optional behavior move behind a command, adapter, plugin, lazy import, or separate module?
- What would be removed if memory, CPU, dependency count, and team attention were scarce?
- Does the change teach users a clear concept, or make them dependent on hidden behavior?
- What should be simplified before the change is considered done?
