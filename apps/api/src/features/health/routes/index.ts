import { OpenAPIHono } from "@hono/zod-openapi"

import { checkRoutes } from "./check"

export const healthRoutes = new OpenAPIHono().route("/", checkRoutes)
