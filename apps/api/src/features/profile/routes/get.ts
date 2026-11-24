import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { errorResponseSchema } from "@autana/contracts/errors"
import { profileSchema } from "@autana/contracts/profile"
import { profile } from "@autana/database/schema/profile"
import { eq } from "drizzle-orm"

import { db } from "@/db/client"
import type { SessionEnv } from "@/middleware/session"

const getProfileRoute = createRoute({
  method: "get",
  path: "/",
  summary: "Obtiene el perfil de la cuenta",
  responses: {
    200: {
      description: "El perfil, con todos los campos a null si aún no se guardó",
      content: { "application/json": { schema: profileSchema } },
    },
    401: { description: "Sin sesión válida", content: { "application/json": { schema: errorResponseSchema } } },
    500: { description: "Error interno", content: { "application/json": { schema: errorResponseSchema } } },
  },
})

export const getRoutes = new OpenAPIHono<SessionEnv>().openapi(getProfileRoute, async (c) => {
  const [found] = await db.select().from(profile).where(eq(profile.userId, c.var.userId)).limit(1)

  // Un perfil sin guardar no es un error: se devuelve vacío, sin crear la fila.
  return c.json(
    profileSchema.parse(
      found ?? {
        phone: null,
        address: null,
        addressReference: null,
        alternateContactName: null,
        alternateContactPhone: null,
      }
    ),
    200
  )
})
