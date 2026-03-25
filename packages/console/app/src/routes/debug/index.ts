import type { APIEvent } from "@solidjs/start/server"
import { json } from "@solidjs/router"
import { Database } from "@cyxcode/console-core/drizzle/index.js"
import { UserTable } from "@cyxcode/console-core/schema/user.sql.js"

export async function GET(evt: APIEvent) {
  return json({
    data: await Database.use(async (tx) => {
      const result = await tx.$count(UserTable)
      return result
    }),
  })
}
