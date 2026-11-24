import { OpenAPIHono, type Hook } from "@hono/zod-openapi"

import { createErrorResponse } from "@/errors/error-response"
import { noStore } from "@/middleware/no-store"
import { requireSession, type SessionEnv } from "@/middleware/session"

import { createRoutes } from "./create"
import { deleteRoutes } from "./delete"
import { getRoutes } from "./get"
import { listRoutes } from "./list"
import { updateRoutes } from "./update"

// Convierte un fallo de validación en el error público de la operación, según el destino que falló. El mensaje es fijo:
// el detalle de Zod no sale de la API. Los sub-routers lo heredan al montarse.
const invalidInput = {
  param: { code: "INVALID_TASK_ID", message: "Invalid task id" },
  query: { code: "INVALID_TASK_QUERY", message: "Invalid query" },
  json: { code: "INVALID_TASK", message: "Invalid task" },
} as const

const defaultHook: Hook<unknown, SessionEnv, string, unknown> = (result, c) => {
  if (result.success) return
  const { code, message } = invalidInput[result.target as keyof typeof invalidInput] ?? invalidInput.json
  return c.json(createErrorResponse(400, code, message, c.get("requestId")), 400)
}

export const tasksRoutes = new OpenAPIHono<SessionEnv>({ defaultHook })
  // `noStore` va primero para que también alcance al `401` de `requireSession`, que corta la cadena.
  .use(noStore)
  .use(requireSession)
  .route("/", listRoutes)
  .route("/", createRoutes)
  .route("/", getRoutes)
  .route("/", updateRoutes)
  .route("/", deleteRoutes)
