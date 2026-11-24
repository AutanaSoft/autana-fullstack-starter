import { apiBasePath } from "@autana/contracts/api"
import { user } from "@autana/database/schema/auth"
import { like } from "drizzle-orm"

import app from "@/app"
import { db } from "@/db/client"

// Cada archivo de pruebas usa su propio prefijo de correo para eliminar solo sus usuarios: los archivos se ejecutan en
// paralelo contra la misma base. El prefijo no debe empezar por el de otro archivo (por ejemplo, `vitest-`).
export function deleteTestUsers(emailPrefix: string) {
  return db.delete(user).where(like(user.email, `${emailPrefix}%`))
}

// Registra un usuario con el flujo real de Better Auth y devuelve su cookie de sesión.
export async function signUpTestUser(emailPrefix: string) {
  const email = `${emailPrefix}${crypto.randomUUID()}@mail.com`
  const response = await app.request(`${apiBasePath}/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ name: "Ana Ruiz", email, password: "12345678" }),
  })
  const body = (await response.json()) as { user: { id: string } }
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ")

  return { id: body.user.id, email, cookie }
}

// Envía `Origin` como un navegador: `hono/csrf` rechaza con 403 las mutaciones sin tipo de contenido cuyo origen no
// coincide con `WEB_ORIGIN`, como un DELETE.
export function request(
  path: string,
  options: { method?: string; cookie?: string; body?: unknown; rawBody?: string } = {}
) {
  const { method = "GET", cookie, body, rawBody } = options
  const hasBody = body !== undefined || rawBody !== undefined
  return app.request(`${apiBasePath}${path}`, {
    method,
    headers: {
      Origin: "http://localhost:5173",
      ...(cookie && { Cookie: cookie }),
      ...(hasBody && { "Content-Type": "application/json" }),
    },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  })
}
