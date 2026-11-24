import { getConnInfo } from "@hono/node-server/conninfo"
import type { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { rateLimiter } from "hono-rate-limiter"
import { apiBasePath } from "@autana/contracts/api"

import { createErrorResponse } from "../errors/error-response"

const readMethods = ["GET", "HEAD", "OPTIONS"]

// Los contadores viven en la memoria del proceso: valen para una sola instancia (ver deuda técnica).
function createLimiter(limit: number, trustProxy: boolean) {
  const windowMs = 60_000
  return rateLimiter({
    windowMs,
    limit,
    standardHeaders: "draft-6",
    keyGenerator: (c) => getClientAddress(c, trustProxy),
    handler: (c) => {
      c.header("Retry-After", String(windowMs / 1000))
      return c.json(createErrorResponse(429, "RATE_LIMITED", "Too many requests", c.get("requestId")), 429)
    },
  })
}

// Con un proxy de confianza, la dirección real es la última que este añadió a `X-Forwarded-For`; las anteriores
// las puede falsificar el cliente.
function getClientAddress(c: Context, trustProxy: boolean) {
  if (trustProxy) {
    const forwarded = c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim()
    if (forwarded) return forwarded
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown"
  } catch {
    // Sin socket real, como en `app.request()`.
    return "unknown"
  }
}

// Límite global por IP y otro más estricto para las escrituras. Las rutas de autenticación solo usan el global,
// porque Better Auth aplica su propio límite en producción. Devuelve los dos middlewares, en orden.
export function createRateLimit({ globalLimit = 100, writeLimit = 20, trustProxy = false } = {}) {
  const writes = createLimiter(writeLimit, trustProxy)
  const writesOnly = createMiddleware((c, next) => {
    const isWrite = !readMethods.includes(c.req.method) && !c.req.path.startsWith(`${apiBasePath}/auth/`)
    return isWrite ? writes(c, next) : next()
  })
  return [createLimiter(globalLimit, trustProxy), writesOnly] as const
}
