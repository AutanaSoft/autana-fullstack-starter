import { cors } from "hono/cors"

// Solo el origen del frontend, con cookies. Con el frontend y la API en el mismo origen el navegador no lo usa.
export function createCors(webOrigin: string) {
  return cors({
    origin: webOrigin,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 600,
  })
}
