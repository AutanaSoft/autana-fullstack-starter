import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { errorResponseSchema } from "@autana/contracts/errors"
import { taskParamsSchema, taskSchema, updateTaskSchema } from "@autana/contracts/tasks"
import { task } from "@autana/database/schema/task"
import { and, eq } from "drizzle-orm"

import { db } from "@/db/client"
import { createErrorResponse } from "@/errors/error-response"
import type { SessionEnv } from "@/middleware/session"

import { toTask } from "../to-task"

const updateTaskRoute = createRoute({
  method: "patch",
  path: "/{taskId}",
  summary: "Modifica el título o el estado de una tarea",
  request: {
    params: taskParamsSchema,
    body: { required: true, content: { "application/json": { schema: updateTaskSchema } } },
  },
  responses: {
    200: { description: "Tarea modificada", content: { "application/json": { schema: taskSchema } } },
    400: { description: "Datos inválidos", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Sin sesión válida", content: { "application/json": { schema: errorResponseSchema } } },
    404: {
      description: "La tarea no existe o es ajena",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    500: { description: "Error interno", content: { "application/json": { schema: errorResponseSchema } } },
  },
})

export const updateRoutes = new OpenAPIHono<SessionEnv>().openapi(updateTaskRoute, async (c) => {
  const { taskId } = c.req.valid("param")
  const values = c.req.valid("json")

  // Una sola sentencia con el propietario en el WHERE: no hay estado previo que comprobar, así que no hay 409.
  const [updated] = await db
    .update(task)
    .set(values)
    .where(and(eq(task.id, taskId), eq(task.userId, c.var.userId)))
    .returning()
  if (!updated) return c.json(createErrorResponse(404, "TASK_NOT_FOUND", "Task not found", c.get("requestId")), 404)

  return c.json(taskSchema.parse(toTask(updated)), 200)
})
