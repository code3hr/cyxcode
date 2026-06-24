import aiDeps from "./commands/ai-deps.md" with { type: "text" }
import changelog from "./commands/changelog.md" with { type: "text" }
import commit from "./commands/commit.md" with { type: "text" }
import correct from "./commands/correct.md" with { type: "text" }
import diagnose from "./commands/diagnose.md" with { type: "text" }
import dream from "./commands/dream.md" with { type: "text" }
import issues from "./commands/issues.md" with { type: "text" }
import patterns from "./commands/learn-patterns.md" with { type: "text" }
import learn from "./commands/learn.md" with { type: "text" }
import remember from "./commands/remember.md" with { type: "text" }
import rmslop from "./commands/rmslop.md" with { type: "text" }
import spellcheck from "./commands/spellcheck.md" with { type: "text" }

export const CyxCommands = [
  { name: "ai-deps", template: aiDeps },
  { name: "changelog", template: changelog },
  { name: "commit", template: commit },
  { name: "correct", template: correct },
  { name: "diagnose", template: diagnose },
  { name: "dream", template: dream },
  { name: "issues", template: issues },
  { name: "learn-patterns", template: patterns },
  { name: "learn", template: learn },
  { name: "remember", template: remember },
  { name: "memory", template: remember },
  { name: "knowledge", template: remember },
  { name: "rmslop", template: rmslop },
  { name: "spellcheck", template: spellcheck },
] as const
