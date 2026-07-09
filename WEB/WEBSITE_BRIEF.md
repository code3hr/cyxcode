# CyxCode Website Brief

Internal planning document for the standalone CyxCode showcase website in `WEB/`.

## Why The Website Exists

CyxCode needs a public-facing site that explains the project faster than the README can. The README is useful for developers who already care enough to read deeply. The website should create that interest first.

The site exists to:

- Explain the core idea in one screen: CyxCode saves tokens by catching known errors before the LLM sees them.
- Make the product feel real with terminal screenshots, command examples, release links, and concrete workflows.
- Give developers a reason to install it today.
- Separate marketing, feature explanation, docs entry points, and sponsor/support calls to action.
- Build trust that CyxCode is an active fork with its own direction, not only a rebrand.

## What The Website Does

The first version should be a focused product showcase, not a large app.

Primary jobs:

- Present CyxCode as a terminal-first AI coding agent for deterministic error recovery, reusable memory, and lower token spend.
- Show the difference between traditional AI handling and CyxCode short-circuiting.
- Demonstrate shell mode, learned patterns, project memory, semantic recall, dream consolidation, and behavior versioning.
- Provide install commands and release links.
- Send deeper users to docs, GitHub, sponsorship, and downloads.

Secondary jobs:

- Explain why CyxCode is a fork of OpenCode.
- Show measurable outcomes such as token savings, zero-token shell mode, and pattern growth.
- Give contributors a clean mental model of the product roadmap.

## Audience

Primary audience:

- Developers who use AI coding agents in the terminal.
- Developers paying for token-heavy workflows and repeated debugging.
- Open source users comparing CyxCode with OpenCode, Claude Code, Aider, and similar tools.

Secondary audience:

- Contributors who want to understand where the fork is going.
- Sponsors who want to see a serious technical project with a clear value proposition.
- Teams evaluating local-first AI workflow tools.

The tone should assume technical readers. Avoid hype-heavy AI copy. Use concrete examples, commands, screenshots, and tradeoffs.

## Core Message

Working headline:

> Stop paying twice for the same error.

Supporting line:

> CyxCode is a terminal AI coding agent that learns repeated failures, short-circuits known errors, and preserves project memory so every solved problem makes the next run cheaper.

Short product definition:

> CyxCode is a fork of OpenCode specialized for deterministic error recovery, reusable project memory, semantic recall, and lower token spend.

Tagline option:

> We automate the AI that automates us.

## Positioning

CyxCode should be positioned as:

- Practical, local-first, and developer-native.
- Cost-aware without feeling like a finance dashboard.
- More deterministic than general AI agents when known errors repeat.
- A fork with technical reasons: pattern routing, bash tool metadata, shell mode, and learned error handling need deeper integration than a plugin can provide.

Do not position CyxCode as:

- A generic AI wrapper.
- A replacement for all IDE assistants.
- A visual no-code automation product.
- A vague "AI productivity platform."

## Visual Direction

The site should feel like a serious developer tool:

- Dense but readable.
- Terminal-native, with real command output as a first-class visual element.
- Clean, sharp, and restrained.
- Uses product screenshots early, not abstract art.
- Dark sections can work well, but avoid making the whole site one flat dark-blue/purple theme.
- Use a small accent palette for matches, misses, savings, and learned states.
- Prefer real UI screenshots, terminal panels, comparison tables, and architecture diagrams.

Logo direction:

- Use the existing CyxCode ASCII-shadow treatment from `packages/app/src/components/cyxcode-logo.tsx` as the primary hero/logo style.
- Use existing SVG logo assets from `packages/web/src/assets/` for small header/footer contexts if the ASCII logo is too wide.
- Keep the logo terminal-native and monospaced so the brand reinforces the CLI product.

Recommended visual ingredients:

- Hero with CyxCode name, one clear value proposition, install command, GitHub button, and a large terminal/product screenshot.
- A "traditional AI vs CyxCode" flow diagram.
- A token savings table or compact calculator.
- Feature bands for shell mode, pattern learning, memory, recall, and behavior versioning.
- Code/terminal cards that use real examples from the README.
- Changelog or release strip near the footer.

Avoid:

- Generic stock photos.
- Abstract gradient-only hero sections.
- Decorative blobs, bokeh, or oversized marketing cards.
- Long paragraphs above the fold.
- Claims that cannot be backed by repo docs, examples, or measurements.

## First Homepage Structure

1. Header
   - Logo/name: CyxCode
   - Links: Features, Install, Docs, GitHub, Sponsor
   - Primary action: Install

2. Hero
   - Headline: Stop paying twice for the same error.
   - Subcopy: CyxCode catches known failures before the LLM sees them, learns misses, and reuses project memory across sessions.
   - CTAs: Install, View GitHub
   - Visual: terminal screenshot or animated terminal comparison.

3. Problem/Solution
   - Traditional AI path: error -> LLM -> tokens burned -> response.
   - CyxCode path: error -> pattern check -> free fix, or AI handles once and CyxCode learns.

4. Core Features
   - Zero-token shell mode.
   - Learned pattern review.
   - Project memory with selective loading.
   - Semantic recall for similar prior errors.
   - Dream consolidation.
   - Behavior versioning.

5. Proof
   - Built-in pattern count.
   - Example token savings table.
   - Screenshots from `packages/web/src/assets/lander/`.
   - Install and release links.

6. Comparison
   - CyxCode vs OpenCode, Claude Code, Aider.
   - Keep the framing factual and respectful.

7. Install
   - Main install command.
   - Version pin example.
   - Upgrade note with `/update`.

8. Footer
   - GitHub
   - Docs
   - Releases
   - Sponsor
   - License

## Page Map

First version:

- `/` - Main product landing page.
- `/docs` - Links into existing docs or a minimal docs index.
- `/install` - Install, upgrade, requirements, releases.
- `/features` - Deep feature explanations with screenshots.
- `/compare` - Positioning and tradeoffs.
- `/sponsor` - Sponsorship pitch and project support.

Later:

- `/patterns` - Built-in pattern categories and community packs.
- `/memory` - Project memory, recall, dream, and behavior versioning.
- `/changelog` - Releases and major project updates.
- `/showcase` - Example workflows and saved-token stories.

## Content Rules

- Lead with what CyxCode changes in the workflow, not with implementation details.
- Use commands and terminal output as proof.
- Keep claims measurable where possible.
- Make every major feature answer: what it is, when it runs, why it saves tokens, and what the user does.
- Explain fork rationale once, clearly.
- Keep docs links visible but do not make the homepage a docs dump.

## Template Inspiration

These are references for structure and interaction patterns, not assets to copy directly.

## Reference Decision

Primary reference:

> OpenCode: https://opencode.ai/

OpenCode is the closest fit because CyxCode is also a terminal-first AI coding agent. Its homepage puts the install command, docs, GitHub, product category, and proof points in the right order for a developer audience.

What to borrow:

- Install-first hero with command options.
- Short product definition above the fold.
- Product video or terminal screenshot immediately after the hero.
- Compact feature grid.
- Trust/proof section.
- Privacy/open-source/FAQ section.

What to avoid:

- Looking like an OpenCode clone. CyxCode is a fork, so the site must make the differentiation obvious: token savings, pattern learning, shell mode, project memory, semantic recall, and behavior versioning.
- Using the same visual rhythm too closely. The layout can be inspired by OpenCode, but the brand should feel more deterministic, cost-aware, and terminal-recovery focused.

Secondary style reference:

> Noctalia: https://noctalia.dev/

Noctalia is useful for mood: calm, minimal, open-source, screenshot-led, and distinct. Borrow its restraint and strong brand feel, but add more terminal/code proof than Noctalia needs.

Rejected as primary:

> Sigma File Manager: https://sigma-file-manager.vercel.app/

Sigma has useful open-source sections like features, FAQ, articles, and roadmap, but it feels more like a general app landing page. It is less suited to explaining a terminal AI agent with install commands, model/provider context, token savings, and technical differentiation.

### Tailwind Plus Salient

Source: https://tailwindcss.com/plus/templates/salient

Useful because it is a SaaS marketing template with a proven landing page sequence: hero, feature sections, testimonials/proof, FAQ, and pricing-style calls to action. Borrow the pacing and section clarity, not the visual style wholesale.

Use for:

- Homepage conversion flow.
- Feature section rhythm.
- Clean CTA placement.

Avoid:

- Overly generic SaaS polish.
- Testimonials unless CyxCode has real quotes.

### Tailwind Plus Syntax

Source: https://tailwindcss.com/plus/templates/syntax

Useful because CyxCode needs both marketing and documentation. Syntax is documentation-focused and uses code-first content patterns that fit CLI products.

Use for:

- Docs pages.
- Code-heavy feature pages.
- Side navigation and reference layout ideas.

Avoid:

- Making the homepage feel like a manual.

### Astroship

Source: https://astro.build/themes/details/astroship/

Useful because it is an Astro + Tailwind starter for startups, marketing pages, landing pages, and blogs. It is closer to a fast standalone website than a heavy application.

Use for:

- Lightweight site structure.
- Fast marketing-page scaffolding.
- Blog/changelog path if needed later.

Avoid:

- Generic startup sections that do not fit a developer CLI.

### Astro Starlight

Source: https://astro.build/themes/details/starlight/

Useful because it is a mature docs theme with search, navigation, SEO, readable typography, code highlighting, and dark/light mode.

Use for:

- Documentation area.
- Feature reference pages.
- Searchable long-form docs.

Avoid:

- Using it as the whole homepage if the goal is product showcase first.

## Recommended Direction

Use a hybrid structure:

- Marketing landing page inspired by Salient/Astroship.
- Documentation/reference section inspired by Syntax/Starlight.
- Product visuals based on CyxCode terminal screenshots and real command flows.

## Template Decision

Use OpenCode as the layout and product-reference model, but do not use a heavy visual template that forces CyxCode into generic SaaS sections.

Recommended template approach:

> Build a custom Astro + Tailwind site in `WEB/`, using Astroship only as scaffolding inspiration.

Why:

- CyxCode needs a developer-tool homepage, not a broad startup template.
- The strongest page sections are simple: header, hero, install command, terminal visual, feature grid, comparison, install block, FAQ, footer.
- A small Astro/Tailwind base keeps the site fast, easy to edit, and easy to replace later.
- OpenCode's homepage gives us the right information architecture, but CyxCode must visually differentiate itself through token savings, pattern learning, and terminal recovery flows.

Use:

- Astro + Tailwind as the implementation stack.
- Custom homepage components.
- Markdown/MDX for future docs or feature pages.
- Existing CyxCode screenshots and real command examples.

Borrow from Astroship:

- Starter project structure.
- Basic responsive marketing layout.
- Blog/changelog capability if needed later.

Do not borrow:

- Generic startup hero copy.
- Generic feature-card language.
- Decorative gradients or stock-looking imagery.

Docs template decision:

> Add Starlight later only if the docs section grows beyond a few static pages.

For the first version, link to docs or create lightweight Markdown pages. Bringing in a full docs framework too early adds structure before the content demands it.

Implementation preference:

- Astro + Tailwind is a good fit for a static product site.
- Keep the standalone `WEB/` folder separate from the main repo packages.
- Start with static Markdown-driven content and plain components before adding complex interactivity.

## Open Questions

- Should the public site live at `cyxcode.ai`, GitHub Pages, Cloudflare Pages, or another host?
- Should the site reuse existing `packages/web` assets or keep a fully separate asset copy inside `WEB/`?
- Should docs be mirrored into the standalone site or linked to the existing docs app?
- Do we want the first build to be a static HTML/CSS prototype, Astro project, or imported template?
- What are the current install targets and latest stable version we want to show on launch?

## Next Step

Pick the implementation direction:

- Fast prototype: single static HTML/CSS page in `WEB/`.
- Proper static site: Astro + Tailwind in `WEB/`.
- Template-first: start from Astroship or a similar Astro/Tailwind starter and customize heavily.

Recommended first build:

> Astro + Tailwind in `WEB/`, with a custom homepage and Markdown content files. This keeps the site fast, portable, and easy to evolve into docs later.
