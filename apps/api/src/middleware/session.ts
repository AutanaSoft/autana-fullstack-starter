import { createMiddleware } from "hono/factory"

import { auth } from "@/auth/auth"
import { createErrorResponse } from "@/errors/error-response"

// Variables que `requireSession` deja en el contexto. Los routers que lo usan se crean con este tipo para que
// `c.var.userId` no sea opcional.
export type SessionEnv = { Variables: { userId: string } }

// Exige una sesión válida y publica el identificador del usuario. Sin sesión responde `401` con un mensaje fijo, que
// no distingue entre una cookie ausente, caducada o manipulada.
export const requireSession = createMiddleware<SessionEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json(createErrorResponse(401, "SESSION_REQUIRED", "Session required", c.get("requestId")), 401)
  }

  c.set("userId", session.user.id)
  await next()
})
