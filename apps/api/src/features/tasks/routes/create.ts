import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { errorResponseSchema } from "@autana/contracts/errors"
import { createTaskSchema, taskSchema } from "@autana/contracts/tasks"
import { task } from "@autana/database/schema/task"

import { db } from "@/db/client"
import type { SessionEnv } from "@/middleware/session"

import { toTask } from "../to-task"

const createTaskRoute = createRoute({
  method: "post",
  path: "/",
  summary: "Crea una tarea",
  request: { body: { required: true, content: { "application/json": { schema: createTaskSchema } } } },
  responses: {
    201: { description: "Tarea creada", content: { "application/json": { schema: taskSchema } } },
    400: { description: "Datos inválidos", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Sin sesión válida", content: { "application/json": { schema: errorResponseSchema } } },
    500: { description: "Error interno", content: { "application/json": { schema: errorResponseSchema } } },
  },
})

export const createRoutes = new OpenAPIHono<SessionEnv>().openapi(createTaskRoute, async (c) => {
  const values = c.req.valid("json")

  const [created] = await db
    .insert(task)
    .values({ ...values, userId: c.var.userId })
    .returning()

  return c.json(taskSchema.parse(toTask(created)), 201)
})
