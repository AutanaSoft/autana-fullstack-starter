import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { healthResponseSchema } from "@autana/contracts/health"

const checkRoute = createRoute({
  method: "get",
  path: "/",
  summary: "Comprueba que la API está disponible",
  responses: {
    200: {
      description: "La API responde",
      content: { "application/json": { schema: healthResponseSchema } },
    },
  },
})

export const checkRoutes = new OpenAPIHono().openapi(checkRoute, (c) =>
  c.json(healthResponseSchema.parse({ status: "ok" }), 200)
)
