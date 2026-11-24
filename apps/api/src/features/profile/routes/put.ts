import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { errorResponseSchema } from "@autana/contracts/errors"
import { profileSchema, updateProfileSchema } from "@autana/contracts/profile"
import { profile } from "@autana/database/schema/profile"

import { db } from "@/db/client"
import type { SessionEnv } from "@/middleware/session"

const putProfileRoute = createRoute({
  method: "put",
  path: "/",
  summary: "Guarda el perfil de la cuenta, reemplazando el anterior",
  request: { body: { required: true, content: { "application/json": { schema: updateProfileSchema } } } },
  responses: {
    200: { description: "Perfil guardado", content: { "application/json": { schema: profileSchema } } },
    400: { description: "Datos inválidos", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Sin sesión válida", content: { "application/json": { schema: errorResponseSchema } } },
    500: { description: "Error interno", content: { "application/json": { schema: errorResponseSchema } } },
  },
})

export const putRoutes = new OpenAPIHono<SessionEnv>().openapi(putProfileRoute, async (c) => {
  const values = c.req.valid("json")

  // Alta o actualización en una sola sentencia. `$onUpdate` no actúa en `onConflictDoUpdate`, así que `updatedAt`
  // se indica aquí.
  const [saved] = await db
    .insert(profile)
    .values({ ...values, userId: c.var.userId })
    .onConflictDoUpdate({ target: profile.userId, set: { ...values, updatedAt: new Date() } })
    .returning()

  return c.json(profileSchema.parse(saved), 200)
})
