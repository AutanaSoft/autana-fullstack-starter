import { createDatabase } from "@autana/database/client"

import envConfig from "../config/env-config"

export const { pool, db } = createDatabase(envConfig.DATABASE_URL)
