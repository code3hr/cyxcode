import { getRouter } from "./router"
import { CyxPaths } from "./paths"
import { CommunityPatterns } from "./community"
import { LearnedPatterns, LearnedSkill } from "./learned"
import { recoverySkill } from "./skills/recovery"
import { securitySkill } from "./skills/security"
import { devopsSkill } from "./skills/devops"
import { Log } from "../util/log"

/** Initialize the current project's pattern tiers and retain its own readiness promise. */
export function initialize() {
  const router = getRouter()
  if (router.ready) return router
  router.register(recoverySkill)
  router.register(securitySkill)
  router.register(devopsSkill)
  const project = CyxPaths.learnedPath()
  const global = CyxPaths.globalLearnedPath()
  router.ready = (async () => {
    await CommunityPatterns.ensureBuiltinPacks()
    const tiers = await Promise.all([
      CommunityPatterns.loadAll(),
      LearnedPatterns.loadApproved(global),
      LearnedPatterns.loadApproved(project),
    ])
    const names = [
      ["community", "Community-contributed patterns"],
      ["global-learned", "Global learned patterns"],
      ["learned", "Patterns learned from AI-handled errors"],
    ]
    tiers.forEach((patterns, index) => {
      if (!patterns.length) return
      const skill = new LearnedSkill(patterns)
      skill.name = names[index][0]
      skill.description = names[index][1]
      router.register(skill)
    })
  })().catch((err) => {
    Log.create({ service: "cyxcode-patterns" }).warn("Pattern loading failed", { error: err })
    router.ready = undefined
  })
  return router
}
