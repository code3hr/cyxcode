# CyxCode Website Implementation Plan

Track progress for the standalone CyxCode website in `WEB/`.

## Direction

- Reference site: https://opencode.ai/
- Stack: Astro + Tailwind
- Style: terminal-native, product-first, distinct from OpenCode
- Logo: existing CyxCode ASCII-shadow treatment from `packages/app/src/components/cyxcode-logo.tsx`
- First deliverable: polished homepage

## Progress

| Phase | Status | Output |
| --- | --- | --- |
| 0. Planning | Done | `WEBSITE_BRIEF.md`, reference choice, template decision |
| 1. Scaffold | Done | Astro + Tailwind project scaffold in WEB with base config and scripts. |
| 2. Content Model | Done | Homepage copy and sections are in place in `src/pages/index.astro`; wording is stabilized for launch review. |
| 3. Visual System | Done | Core styling and section-level components are in place, matching a terminal-native language. |
| 4. Homepage | Done | Core landing sections are assembled with proof, comparison, and FAQ content. |
| 5. Assets | Done | Existing screenshots copied into `public/gallery` and referenced from `#showcase`. |
| 6. Responsive Pass | Done | Header/nav behavior, command line overflow, and section spacing were adjusted for mobile/tablet. |
| 7. Build Check | Blocked | `bun run build` is currently blocked in this workspace by a local `spawn EPERM` issue from Vite (`optimizeSafeRealPathSync`); rerun in a normal Windows dev shell to verify full build. |
| 8. Polish | Done | Metadata, accessibility, and launch polish completed. |
| 9. Design Upgrade | Done | Navigation, command UX, section hierarchy, and hero composition upgraded with stronger visual system and project-aligned branding. |

Status values: `Pending`, `In Progress`, `Done`, `Blocked`.

## Phase 1: Scaffold

Goal:

- Create a standalone Astro + Tailwind project inside `WEB/`.
- Keep it independent from the main CyxCode monorepo.

Tasks:

- Add Astro project files.
- Add Tailwind setup.
- Add basic scripts for dev/build.
- Keep dependency footprint small.

Acceptance:

- `bun install` works from `WEB/`.
- Dev server starts from `WEB/`.
- Production build succeeds.

## Phase 2: Content Model

Goal:

- Turn the website brief into concrete homepage copy.

Sections:

- Header
- Hero
- Install command
- Product visual
- Problem/solution flow
- Core features
- Proof/token savings
- Comparison
- FAQ
- Footer

Acceptance:

- Every section has final-ish text.
- Every claim maps back to README/docs or repo features.
- Homepage does not read like generic AI marketing.

## Phase 3: Visual System

Goal:

- Build the reusable visual language before composing the full page.

Components:

- Header/nav
- Button/link styles
- Install command block
- Terminal panel
- Feature row/card
- Stats/proof strip
- FAQ item
- Footer

Acceptance:

- Visuals feel related to OpenCode structure but distinct for CyxCode.
- ASCII logo works in the hero.
- Layout avoids generic SaaS cards where terminal/code proof is better.

## Phase 4: Homepage

Goal:

- Compose the first complete landing page.

Order:

1. Header
2. Hero with ASCII logo and install command
3. Product screenshot or terminal panel
4. Traditional AI vs CyxCode flow
5. Feature sections
6. Proof/token savings
7. Comparison
8. FAQ
9. Footer

Acceptance:

- A developer can understand CyxCode in the first viewport.
- The install action is visible without scrolling.
- Token savings and learned patterns are obvious differentiators.

## Phase 5: Assets

Goal:

- Use existing project visuals where possible.

Sources:

- `packages/app/src/components/cyxcode-logo.tsx`
- `packages/web/src/assets/logo-dark.svg`
- `packages/web/src/assets/logo-light.svg`
- `packages/web/src/assets/lander/screenshot-cyxcode.png`
- `packages/web/src/assets/lander/screenshot-cyxcode-shell.png`
- `packages/web/src/assets/lander/screenshot-cyxcode-learn-review.png`
- `packages/web/src/assets/lander/screenshot-cyxcode-memory.png`
- `packages/web/src/assets/lander/screenshot-cyxcode-dream.png`

Acceptance:

- Assets render locally.
- No broken image paths.
- Images support the product story instead of decorating the page.

## Phase 6: Responsive Pass

Goal:

- Make the site feel intentional on phone, tablet, and desktop.

Checks:

- Header remains usable on mobile.
- ASCII logo does not overflow.
- Install command wraps or scrolls cleanly.
- Screenshots scale without hiding important content.
- No text overlap.

Acceptance:

- Desktop and mobile screenshots are visually coherent.
- Core CTA remains easy to find.

## Phase 7: Build Check

Goal:

- Verify the site can ship.

Checks:

- `bun run build` from `WEB/`.
- No TypeScript or Astro build errors.
- No obvious console errors in dev.

Acceptance:

- Build succeeds.
- Local dev URL is provided.

## Phase 8: Polish

Goal:

- Make the first version feel credible.

Tasks:

- Add metadata.
- Add favicon/logo.
- Tighten copy.
- Check contrast and keyboard focus.
- Review links.

Acceptance:

- Homepage is ready for user review.
- Remaining work is tracked as follow-up, not hidden.

## Current Decisions

- We are not cloning OpenCode visually one-to-one.
- We are not starting with Starlight unless docs expand.
- We are not using a generic SaaS template as the main design.
- We are prioritizing one strong homepage before adding more pages.

