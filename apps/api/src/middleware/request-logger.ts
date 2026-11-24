import { createMiddleware } from "hono/factory"

// Registra una línea por petición con el identificador de `requestId()`, para localizarla junto al error de
// `app.onError`. No registra cabeceras ni cuerpos, que pueden contener credenciales.
export const requestLogger = createMiddleware(async (c, next) => {
  const start = performance.now()
  await next()
  const elapsedMs = Math.round(performance.now() - start)
  console.log(`[${c.get("requestId")}] ${c.req.method} ${c.req.path} ${c.res.status} ${elapsedMs}ms`)
})
