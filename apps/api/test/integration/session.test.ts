import { errorResponseSchema } from "@autana/contracts/errors"
import { session } from "@autana/database/schema/auth"
import { eq } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"

import { db } from "@/db/client"

import { deleteTestUsers, request, signUpTestUser } from "../support/test-user"

const emailPrefix = "session-"

afterEach(() => deleteTestUsers(emailPrefix))

describe("inicio de sesión con credenciales incorrectas", () => {
  it("una contraseña incorrecta de un usuario existente responde 401 igual que un usuario inexistente", async () => {
    const { email } = await signUpTestUser(emailPrefix)

    const wrongPassword = await request("/auth/sign-in/email", {
      method: "POST",
      body: { email, password: "contraseña-incorrecta" },
    })
    const unknownUser = await request("/auth/sign-in/email", {
      method: "POST",
      body: { email: `${emailPrefix}nadie@mail.com`, password: "contraseña-incorrecta" },
    })
    const wrongBody = errorResponseSchema.parse(await wrongPassword.json())
    const unknownBody = errorResponseSchema.parse(await unknownUser.json())

    // No se distingue una cuenta existente de una que no existe.
    expect(wrongPassword.status).toBe(401)
    expect(wrongBody).toMatchObject({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" })
    expect([wrongBody.code, wrongBody.message, wrongBody.statusCode]).toEqual([
      unknownBody.code,
      unknownBody.message,
      unknownBody.statusCode,
    ])
    expect(wrongPassword.headers.getSetCookie()).toHaveLength(0)
  })

  it("no crea una sesión nueva", async () => {
    const { id, email } = await signUpTestUser(emailPrefix)

    await request("/auth/sign-in/email", { method: "POST", body: { email, password: "contraseña-incorrecta" } })

    expect(await db.select().from(session).where(eq(session.userId, id))).toHaveLength(1)
  })
})

describe("cierre de sesión", () => {
  it("invalida la cookie: las rutas protegidas dejan de responder y la sesión desaparece", async () => {
    const { id, cookie } = await signUpTestUser(emailPrefix)
    expect((await request("/tasks", { cookie })).status).toBe(200)

    const signOut = await request("/auth/sign-out", { method: "POST", cookie, body: {} })

    expect(signOut.status).toBe(200)
    expect((await request("/tasks", { cookie })).status).toBe(401)
    expect(await (await request("/auth/get-session", { cookie })).json()).toBeNull()
    expect(await db.select().from(session).where(eq(session.userId, id))).toHaveLength(0)
  })

  it("solo cierra la sesión de la cookie, no las demás del mismo usuario", async () => {
    const { email, cookie } = await signUpTestUser(emailPrefix)
    const signIn = await request("/auth/sign-in/email", { method: "POST", body: { email, password: "12345678" } })
    const otherCookie = signIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")

    await request("/auth/sign-out", { method: "POST", cookie, body: {} })

    expect((await request("/tasks", { cookie })).status).toBe(401)
    expect((await request("/tasks", { cookie: otherCookie })).status).toBe(200)
  })
})

describe("expiración de la sesión", () => {
  it("una sesión caducada responde 401 en las rutas protegidas y no se devuelve como sesión", async () => {
    const { id, cookie } = await signUpTestUser(emailPrefix)
    expect((await request("/tasks", { cookie })).status).toBe(200)

    await db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(session.userId, id))
    const protectedRoute = await request("/tasks", { cookie })

    expect(protectedRoute.status).toBe(401)
    expect(errorResponseSchema.parse(await protectedRoute.json()).code).toBe("SESSION_REQUIRED")
    expect(await (await request("/auth/get-session", { cookie })).json()).toBeNull()
  })
})

describe("cuerpos JSON mal formados", () => {
  it.each(["/auth/sign-in/email", "/auth/sign-up/email"])("%s responde 400 con el contrato público", async (path) => {
    const response = await request(path, { method: "POST", rawBody: "{no es json" })
    const body = errorResponseSchema.parse(await response.json())

    expect(response.status).toBe(400)
    expect(body.statusCode).toBe(400)
    expect(response.headers.get("X-Request-Id")).toBe(body.requestId)
  })
})
