import { apiBasePath } from "@autana/contracts/api"
import { errorResponseSchema } from "@autana/contracts/errors"
import { user } from "@autana/database/schema/auth"
import { eq, like } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"

import app from "@/app"
import { db } from "@/db/client"

const origin = "http://localhost:5173"
const emailPrefix = "vitest-"

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(`${apiBasePath}/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...headers },
    body: JSON.stringify(body),
  })
}

function newUser() {
  return { name: "Ana Ruiz", email: `${emailPrefix}${crypto.randomUUID()}@mail.com`, password: "12345678" }
}

// Cada prueba crea sus propios usuarios y los elimina al terminar, con sus sesiones y cuentas por cascada.
afterEach(() => db.delete(user).where(like(user.email, `${emailPrefix}%`)))

describe("errores de Better Auth con el contrato público", () => {
  it("credenciales incorrectas responden 401 con el code original", async () => {
    const response = await post("/sign-in/email", { email: `${emailPrefix}nadie@mail.com`, password: "12345678" })
    const body = errorResponseSchema.parse(await response.json())

    expect(response.status).toBe(401)
    expect(body).toMatchObject({
      message: "Invalid email or password",
      error: "Unauthorized",
      statusCode: 401,
      code: "INVALID_EMAIL_OR_PASSWORD",
    })
    expect(body.requestId).toBe(response.headers.get("X-Request-Id"))
  })

  it("una ruta inexistente de la librería responde 404 con el contrato", async () => {
    const response = await app.request(`${apiBasePath}/auth/no-existe`)

    expect(response.status).toBe(404)
    expect(errorResponseSchema.parse(await response.json()).code).toBe("NOT_FOUND")
  })

  it("un cuerpo que no cumple el esquema responde 400 con un mensaje fijo", async () => {
    const response = await post("/sign-up/email", { name: 1 })
    const body = errorResponseSchema.parse(await response.json())

    expect(response.status).toBe(400)
    expect(body).toMatchObject({ code: "VALIDATION_ERROR", message: "Validation error" })
  })

  it("una contraseña corta responde 400", async () => {
    const response = await post("/sign-up/email", { ...newUser(), password: "123" })

    expect(response.status).toBe(400)
    expect(errorResponseSchema.parse(await response.json()).code).toBe("PASSWORD_TOO_SHORT")
  })

  it("una contraseña demasiado larga responde 400", async () => {
    const response = await post("/sign-up/email", { ...newUser(), password: "x".repeat(65) })

    expect(response.status).toBe(400)
    expect(errorResponseSchema.parse(await response.json()).code).toBe("PASSWORD_TOO_LONG")
  })
})

describe("validación de la cuenta en el servidor", () => {
  it.each([
    ["un nombre con números o HTML", { name: "Ana2 <b>x</b>" }, "INVALID_NAME"],
    ["un nombre de más de 50 caracteres", { name: "a".repeat(51) }, "INVALID_NAME"],
    ["un nombre vacío", { name: "   " }, "INVALID_NAME"],
    ["un correo de más de 100 caracteres", { email: `${emailPrefix}${"a".repeat(95)}@mail.com` }, "INVALID_EMAIL"],
  ])("rechaza el registro con %s", async (_description, overrides, code) => {
    const credentials = { ...newUser(), ...overrides }

    const response = await post("/sign-up/email", credentials)
    const body = errorResponseSchema.parse(await response.json())

    expect(response.status).toBe(400)
    expect(body).toMatchObject({ statusCode: 400, code })
    expect(body.message).toMatch(/^Invalid (name|email)$/)
    expect(await db.select().from(user).where(eq(user.email, credentials.email.toLowerCase()))).toHaveLength(0)
  })

  it("guarda el nombre recortado", async () => {
    const credentials = newUser()

    const response = await post("/sign-up/email", { ...credentials, name: "  Ana Ruiz  " })
    const body = (await response.json()) as { user: { name: string } }

    expect(response.status).toBe(200)
    expect(body.user.name).toBe("Ana Ruiz")
  })

  it("rechaza cambiar el nombre a un valor inválido y conserva el anterior", async () => {
    const credentials = newUser()
    const signUp = await post("/sign-up/email", credentials)
    const cookie = signUp.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")

    const update = await post("/update-user", { name: "Hacker <script>" }, { Cookie: cookie })
    const session = await app.request(`${apiBasePath}/auth/get-session`, { headers: { Cookie: cookie } })

    expect(update.status).toBe(400)
    expect(errorResponseSchema.parse(await update.json()).code).toBe("INVALID_NAME")
    expect(((await session.json()) as { user: { name: string } }).user.name).toBe("Ana Ruiz")
  })

  it("permite cambiar el nombre a un valor válido", async () => {
    const credentials = newUser()
    const signUp = await post("/sign-up/email", credentials)
    const cookie = signUp.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")

    const update = await post("/update-user", { name: "  Luisa Gómez " }, { Cookie: cookie })
    const session = await app.request(`${apiBasePath}/auth/get-session`, { headers: { Cookie: cookie } })

    expect(update.status).toBe(200)
    expect(((await session.json()) as { user: { name: string } }).user.name).toBe("Luisa Gómez")
  })
})

describe("respuestas correctas de Better Auth", () => {
  it("get-session sin cookie devuelve null, X-Request-Id y no-store", async () => {
    const response = await app.request(`${apiBasePath}/auth/get-session`)

    expect(response.status).toBe(200)
    expect(await response.json()).toBeNull()
    expect(response.headers.get("X-Request-Id")).toBeTruthy()
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  it("registra, rechaza el correo duplicado, inicia sesión y lee la sesión", async () => {
    const credentials = newUser()

    const signUp = await post("/sign-up/email", credentials)
    expect(signUp.status).toBe(200)
    expect(signUp.headers.get("X-Request-Id")).toBeTruthy()
    const created = (await signUp.json()) as { user: { id: string; email: string; createdAt: string } }
    expect(created.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(created.user.email).toBe(credentials.email)

    const duplicate = await post("/sign-up/email", credentials)
    expect(duplicate.status).toBe(422)
    expect(errorResponseSchema.parse(await duplicate.json()).code).toBe("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")

    const signIn = await post("/sign-in/email", { email: credentials.email, password: credentials.password })
    expect(signIn.status).toBe(200)
    const cookie = signIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
    expect(cookie).toContain("better-auth.session_token=")

    const session = await app.request(`${apiBasePath}/auth/get-session`, { headers: { Cookie: cookie } })
    const body = (await session.json()) as { user: { email: string } }
    expect(body.user.email).toBe(credentials.email)
  })

  it("normaliza el correo a minúsculas", async () => {
    const credentials = newUser()

    const response = await post("/sign-up/email", { ...credentials, email: credentials.email.toUpperCase() })
    const body = (await response.json()) as { user: { email: string } }

    expect(body.user.email).toBe(credentials.email)
  })
})
