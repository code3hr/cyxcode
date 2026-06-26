---
name: lean-software-guardrails
description: Apply lean software engineering guardrails based on Niklaus Wirth's "A Plea for Lean Software." Use when planning, implementing, reviewing, refactoring, or debugging coding and software engineering projects where complexity, feature creep, bloated dependencies, weak decomposition, extensibility, performance, maintainability, or engineering discipline matter.
---

# Lean Software Guardrails

## Core stance

Use this skill to keep software small, understandable, and extensible. Treat every feature, dependency, abstraction, layer, background service, generated artifact, and configuration knob as a cost until it proves essential.

The source article argues that software growth often tracks available hardware rather than user value. Counter that tendency by returning to essentials: disciplined design, simple primitives, coherent modules, strong interfaces, and iterative refinement.

For fuller source-derived guidance, read `references/wirth-lean-software.md` when the task involves architecture, code review, major refactoring, framework choice, or adding functionality.

## Operating workflow

1. Identify the essential user or system capability.
2. Separate essentials from conveniences, compatibility burdens, visual/UI embellishments, and "nice to have" features.
3. Prefer the smallest design that solves the essential capability clearly.
4. Keep extension points narrow and typed. Add extensibility by composing modules, not by making the core broad.
5. Check whether a feature can live outside the core and be loaded, configured, or composed only when needed.
6. Challenge abstractions that cannot be explained through concrete data, operations, and module boundaries.
7. Review for avoidable complexity before optimizing for speed, novelty, or completeness.
8. Validate by tests, examples, and readable code paths that show the simpler design is sufficient.

## Guardrail checklist

Before making or approving a change, ask:

- Does this add functionality users need now, or merely satisfy a possible future scenario?
- Does this make the common path simpler or harder to understand?
- Can this behavior be a module, adapter, command, plugin, or optional integration instead of core logic?
- Are interfaces precise enough that the compiler, type checker, or tests can catch integration mistakes?
- Does a new abstraction reduce real duplication, or only rename complexity?
- Is the implementation smaller because it is better designed, or larger because it is compensating for unclear design?
- Can a capable engineer understand the whole changed area without relying on tribal knowledge?
- Did time pressure lead to a quick addition that should instead be a small redesign?

## Coding guidance

Prefer:

- Small modules with explicit imports, exports, and ownership.
- Strong typing or clear runtime validation at module boundaries.
- Straightforward data structures and operations before framework-heavy machinery.
- Iterative refinement: design, implement, inspect, simplify, then polish.
- Written specifications and tests that prove intended behavior without overconstraining the implementation.
- Publication-quality code: readable names, clean examples, and polished error paths.

Avoid:

- Monolithic designs where every feature is permanently loaded or always present.
- Feature accumulation as a proxy for product quality.
- Compatibility layers that preserve old concepts while adding new names for the same ideas.
- Broad plugin hooks that expose internals or make invariants unenforceable.
- Dependency growth that saves a few lines while importing a large conceptual surface.
- Premature generality, hidden global state, and "just in case" configuration.

## Review output

When reviewing a design or code change with this skill, lead with concrete risks:

- `Complexity`: unnecessary features, abstractions, dependencies, states, or code paths.
- `Core bloat`: logic that should be optional, modular, or loaded only when needed.
- `Weak boundary`: unclear module contract, loose typing, or insufficient validation.
- `Missed simplification`: a smaller design that preserves the essential behavior.
- `Validation gap`: tests or examples missing for the simpler intended behavior.

Then propose the smallest practical correction that preserves the user-visible goal.
