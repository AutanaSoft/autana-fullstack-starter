import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { errorResponseSchema } from "@autana/contracts/errors"
import { taskParamsSchema, taskSchema } from "@autana/contracts/tasks"
import { task } from "@autana/database/schema/task"
import { and, eq } from "drizzle-orm"

import { db } from "@/db/client"
import { createErrorResponse } from "@/errors/error-response"
import type { SessionEnv } from "@/middleware/session"

import { toTask } from "../to-task"

const getRoute = createRoute({
  method: "get",
  path: "/{taskId}",
  summary: "Obtiene una tarea de la cuenta",
  request: { params: taskParamsSchema },
  responses: {
    200: { description: "La tarea", content: { "application/json": { schema: taskSchema } } },
    400: { description: "Identificador inválido", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Sin sesión válida", content: { "application/json": { schema: errorResponseSchema } } },
    404: {
      description: "La tarea no existe o es ajena",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    500: { description: "Error interno", content: { "application/json": { schema: errorResponseSchema } } },
  },
})

export const getRoutes = new OpenAPIHono<SessionEnv>().openapi(getRoute, async (c) => {
  const { taskId } = c.req.valid("param")

  const [found] = await db
    .select()
    .from(task)
    .where(and(eq(task.id, taskId), eq(task.userId, c.var.userId)))
    .limit(1)
  // Una tarea ajena responde igual que una inexistente, para no revelar qué identificadores existen.
  if (!found) return c.json(createErrorResponse(404, "TASK_NOT_FOUND", "Task not found", c.get("requestId")), 404)

  return c.json(taskSchema.parse(toTask(found)), 200)
})
