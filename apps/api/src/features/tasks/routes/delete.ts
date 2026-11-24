import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { errorResponseSchema } from "@autana/contracts/errors"
import { taskParamsSchema } from "@autana/contracts/tasks"
import { task } from "@autana/database/schema/task"
import { and, eq } from "drizzle-orm"

import { db } from "@/db/client"
import { createErrorResponse } from "@/errors/error-response"
import type { SessionEnv } from "@/middleware/session"

const deleteRoute = createRoute({
  method: "delete",
  path: "/{taskId}",
  summary: "Elimina una tarea",
  request: { params: taskParamsSchema },
  responses: {
    204: { description: "Tarea eliminada" },
    400: { description: "Identificador inválido", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Sin sesión válida", content: { "application/json": { schema: errorResponseSchema } } },
    404: {
      description: "La tarea no existe o es ajena",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    500: { description: "Error interno", content: { "application/json": { schema: errorResponseSchema } } },
  },
})

export const deleteRoutes = new OpenAPIHono<SessionEnv>().openapi(deleteRoute, async (c) => {
  const { taskId } = c.req.valid("param")

  const [deleted] = await db
    .delete(task)
    .where(and(eq(task.id, taskId), eq(task.userId, c.var.userId)))
    .returning({ id: task.id })
  if (!deleted) return c.json(createErrorResponse(404, "TASK_NOT_FOUND", "Task not found", c.get("requestId")), 404)

  return c.body(null, 204)
})
