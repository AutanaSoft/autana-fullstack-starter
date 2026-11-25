import { OpenAPIHono } from "@hono/zod-openapi"
import { Scalar } from "@scalar/hono-api-reference"
import { compress } from "hono/compress"
import { HTTPException } from "hono/http-exception"
import { requestId } from "hono/request-id"
import { apiBasePath } from "@autana/contracts/api"

import { handleAuthRequest } from "./auth/auth-handler"
import envConfig from "./config/env-config"
import { createErrorResponse, describeHttpError } from "./errors/error-response"
import { healthRoutes } from "./features/health/routes"
import { profileRoutes } from "./features/profile/routes"
import { tasksRoutes } from "./features/tasks/routes"
import { createCors } from "./middleware/cors"
import { createCsrf } from "./middleware/csrf"
import { createRateLimit } from "./middleware/rate-limit"
import { requestLogger } from "./middleware/request-logger"
import { createSecureHeaders } from "./middleware/secure-headers"

const app = new OpenAPIHono()

// El orden importa: el identificador de la petición debe existir antes que cualquier otro middleware.
app.use(requestId())
app.use(requestLogger)
app.use(createSecureHeaders(envConfig.NODE_ENV === "development"))
app.use(`${apiBasePath}/*`, createCors(envConfig.WEB_ORIGIN))
// Fuera de producción no se limita, para que las pruebas y el desarrollo no choquen con el límite.
if (envConfig.NODE_ENV === "production") {
  app.use(`${apiBasePath}/*`, ...createRateLimit({ trustProxy: envConfig.TRUST_PROXY }))
}
app.use(compress())
app.use(`${apiBasePath}/*`, createCsrf(envConfig.WEB_ORIGIN))

app.onError((error, c) => {
  const id = c.get("requestId")
  if (error instanceof HTTPException) {
    const { code, message } = describeHttpError(error.status)
    return c.json(createErrorResponse(error.status, code, message, id), error.status)
  }
  // El detalle va solo al log, junto con el identificador para localizarlo.
  console.error(`[${id}]`, error)
  return c.json(createErrorResponse(500, "INTERNAL_ERROR", "Internal server error", id), 500)
})

app.notFound((c) => {
  if (!c.req.path.startsWith(`${apiBasePath}/`)) return c.text("404 Not Found", 404)
  const { code, message } = describeHttpError(404)
  return c.json(createErrorResponse(404, code, message, c.get("requestId")), 404)
})

const api = app.basePath(apiBasePath)

// La documentación solo se publica en desarrollo; en cualquier otro caso responde 404.
if (process.env.NODE_ENV === "development") {
  api.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Autana Hono Full Stack Starter API", version: "0.0.1" },
  })
  api.get("/docs", Scalar({ url: `${apiBasePath}/openapi.json` }))
}

// Rutas de la API: añade aquí cada módulo nuevo. La configuración general de la aplicación queda arriba.
api.on(["GET", "POST"], "/auth/*", (c) => handleAuthRequest(c.req.raw, c.get("requestId")))
api.route("/health", healthRoutes)
api.route("/profile", profileRoutes)
api.route("/tasks", tasksRoutes)

export default app
