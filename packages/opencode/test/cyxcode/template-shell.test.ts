import { expect, test } from "bun:test"
import path from "node:path"
import { BaseSkill } from "../../src/cyxcode/base-skill"
import { initCyxCode } from "../../src/cyxcode"
import type { Pattern } from "../../src/cyxcode/types"
import { Instance } from "../../src/project/instance"
import { MessageID, SessionID } from "../../src/session/schema"
import { BashTool } from "../../src/tool/bash"
import { tmpdir } from "../fixture/fixture"

class Skill extends BaseSkill {
  name = "template-shell-test"
  description = "Shell capture regression fixture"
  version = "1"
  triggers = ["CYXCODE_CAPTURE_FIXTURE"]
  patterns: Pattern[] = [
    {
      id: "template-shell-test",
      regex: /CYXCODE_CAPTURE_FIXTURE: (.+)\|(two)\|(3)\|(4)\|(5)\|(6)\|(7)\|(8)\|(9)\|(ten)/,
      category: "test",
      description: "Capture fixture failed",
      fixes: [{ id: "fix", description: "Display captures", command: "echo $10 $1 $2", priority: 1 }],
    },
  ]
}

test("failed shell commands suggest fixes with exact captures and literal dollar signs", async () => {
  await using tmp = await tmpdir({
    init: (dir) =>
      Bun.write(
        path.join(dir, "failure.ts"),
        'console.error("CYXCODE_CAPTURE_FIXTURE: $2 $&|two|3|4|5|6|7|8|9|ten"); process.exit(1)',
      ),
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const skill = new Skill()
      initCyxCode().register(skill)
      try {
        const bash = await BashTool.init()
        const result = await bash.execute(
          { command: "bun run failure.ts", description: "Print a controlled failure" },
          {
            sessionID: SessionID.make("ses_capture"),
            messageID: MessageID.make("msg_capture"),
            callID: "capture",
            agent: "build",
            abort: new AbortController().signal,
            messages: [],
            metadata: () => {},
            ask: async () => {},
          },
        )
        expect(result.metadata.exit).toBe(1)
        expect(result.output).toContain("[CyxCode] Pattern matched: template-shell-test")
        expect(result.output).toContain("echo ten $2 $& two")
      } finally {
        skill.patterns = []
      }
    },
  })
})
