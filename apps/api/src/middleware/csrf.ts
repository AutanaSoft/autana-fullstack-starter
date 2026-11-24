import { csrf } from "hono/csrf"
import { createMiddleware } from "hono/factory"
import { apiBasePath } from "@autana/contracts/api"

// `hono/csrf` solo inspecciona peticiones con un tipo de contenido de formulario. La API exige JSON, por lo que la
// protección principal es CORS más las cookies `SameSite=Lax`; este middleware es una defensa adicional.
// Las rutas de autenticación quedan fuera porque Better Auth ya valida el origen (`trustedOrigins`).
export function createCsrf(webOrigin: string) {
  const protection = csrf({ origin: webOrigin })
  return createMiddleware((c, next) => (c.req.path.startsWith(`${apiBasePath}/auth/`) ? next() : protection(c, next)))
}
