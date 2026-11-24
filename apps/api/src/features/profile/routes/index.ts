import { OpenAPIHono, type Hook } from "@hono/zod-openapi"

import { createErrorResponse } from "@/errors/error-response"
import { noStore } from "@/middleware/no-store"
import { requireSession, type SessionEnv } from "@/middleware/session"

import { getRoutes } from "./get"
import { putRoutes } from "./put"

// Convierte un fallo de validación en el error público de la operación. El mensaje es fijo: el detalle de Zod no sale
// de la API. Los sub-routers lo heredan al montarse.
const defaultHook: Hook<unknown, SessionEnv, string, unknown> = (result, c) => {
  if (result.success) return
  return c.json(createErrorResponse(400, "INVALID_PROFILE", "Invalid profile", c.get("requestId")), 400)
}

export const profileRoutes = new OpenAPIHono<SessionEnv>({ defaultHook })
  // `noStore` va primero para que también alcance al `401` de `requireSession`, que corta la cadena.
  .use(noStore)
  .use(requireSession)
  .route("/", getRoutes)
  .route("/", putRoutes)
