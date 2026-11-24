import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as auth from "./schema/auth"
import * as profile from "./schema/profile"
import * as task from "./schema/task"

const schema = { ...auth, ...profile, ...task }

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString })
  return { pool, db: drizzle(pool, { schema }) }
}
