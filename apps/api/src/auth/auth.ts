import { betterAuth } from "better-auth"
import { openAPI } from "better-auth/plugins"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { apiBasePath } from "@autana/contracts/api"
import { passwordLength } from "@autana/contracts/auth"
import * as schema from "@autana/database/schema/auth"

import envConfig from "../config/env-config"
import { db } from "../db/client"
import { validateUserFields } from "./user-validation"

export const auth = betterAuth({
  basePath: `${apiBasePath}/auth`,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: passwordLength.min, maxPasswordLength: passwordLength.max },
  // El nombre y el correo se validan al crear y al modificar un usuario, no solo en el formulario.
  databaseHooks: {
    user: {
      create: { before: async (user) => ({ data: validateUserFields(user) }) },
      update: { before: async (user) => ({ data: validateUserFields(user) }) },
    },
  },
  // Con PostgreSQL, "uuid" deja que la base de datos genere el id de cada tabla.
  advanced: { database: { generateId: "uuid" } },
  trustedOrigins: [envConfig.WEB_ORIGIN],
  // La referencia solo se publica en desarrollo, igual que el resto de la documentación.
  plugins: envConfig.NODE_ENV === "development" ? [openAPI()] : [],
})
