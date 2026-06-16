/// <reference types="@solidjs/start/env" />

import "@solidjs/start/server"
import type { Actor } from "@cyxcode/console-core/actor.js"

declare global {
  namespace App {
    interface RequestEventLocals {
      actor?: Promise<Actor.Info>
    }
  }
}
