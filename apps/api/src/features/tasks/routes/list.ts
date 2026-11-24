import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { errorResponseSchema } from "@autana/contracts/errors"
import { listTasksQuerySchema, listTasksResponseSchema } from "@autana/contracts/tasks"
import { task } from "@autana/database/schema/task"
import { and, count, desc, eq } from "drizzle-orm"

import { db } from "@/db/client"
import type { SessionEnv } from "@/middleware/session"

import { toTask } from "../to-task"

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "Lista las tareas de la cuenta, de la más reciente a la más antigua",
  request: { query: listTasksQuerySchema },
  responses: {
    200: { description: "Página de tareas", content: { "application/json": { schema: listTasksResponseSchema } } },
    400: { description: "Filtros inválidos", content: { "application/json": { schema: errorResponseSchema } } },
    401: { description: "Sin sesión válida", content: { "application/json": { schema: errorResponseSchema } } },
    500: { description: "Error interno", content: { "application/json": { schema: errorResponseSchema } } },
  },
})

export const listRoutes = new OpenAPIHono<SessionEnv>().openapi(listRoute, async (c) => {
  const { status, page, pageSize } = c.req.valid("query")
  const where = and(eq(task.userId, c.var.userId), status ? eq(task.status, status) : undefined)

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(task)
      .where(where)
      // El id desempata las tareas creadas en el mismo instante, para que la paginación sea estable.
      .orderBy(desc(task.createdAt), desc(task.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(task).where(where),
  ])

  return c.json(listTasksResponseSchema.parse({ items: rows.map(toTask), total, page, pageSize }), 200)
})
