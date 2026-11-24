import { secureHeaders } from "hono/secure-headers"

// La API solo devuelve JSON, por lo que ninguna respuesta necesita cargar recursos ni mostrarse en un marco.
// En desarrollo se omite la CSP porque la documentación (Scalar) carga scripts y estilos propios.
export function createSecureHeaders(isDevelopment: boolean) {
  return secureHeaders(
    isDevelopment ? {} : { contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }
  )
}
