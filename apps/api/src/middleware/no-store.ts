import { createMiddleware } from "hono/factory"

// Impide que el navegador o un proxy guarden respuestas con datos del usuario. Se añade después de `next()` para que
// también alcance a las respuestas de error.
export const noStore = createMiddleware(async (c, next) => {
  await next()
  c.header("Cache-Control", "no-store")
})
