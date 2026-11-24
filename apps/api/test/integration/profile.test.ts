import { errorResponseSchema } from "@autana/contracts/errors"
import { profileSchema } from "@autana/contracts/profile"
import { afterEach, describe, expect, it, vi } from "vitest"

import { deleteTestUsers, request, signUpTestUser } from "../support/test-user"

const emailPrefix = "profile-"

afterEach(async () => {
  vi.restoreAllMocks()
  await deleteTestUsers(emailPrefix)
})

const fullProfile = {
  phone: "+593 99 123 4567",
  address: "Av. Principal 123, Quito",
  addressReference: "Frente al parque",
  alternateContactName: "Luisa Gómez",
  alternateContactPhone: "0991234567",
}
const emptyProfile = {
  phone: null,
  address: null,
  addressReference: null,
  alternateContactName: null,
  alternateContactPhone: null,
}

describe("sin sesión", () => {
  it.each(["GET", "PUT"])("%s /profile responde 401 con no-store", async (method) => {
    const response = await request("/profile", { method, body: method === "PUT" ? fullProfile : undefined })

    expect(response.status).toBe(401)
    expect(errorResponseSchema.parse(await response.json()).code).toBe("SESSION_REQUIRED")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})

describe("perfil", () => {
  it("devuelve el perfil vacío mientras no se guarda", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const response = await request("/profile", { cookie })

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(profileSchema.parse(await response.json())).toEqual(emptyProfile)
  })

  it("guarda el perfil y lo devuelve en la siguiente lectura", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const saved = await request("/profile", { method: "PUT", cookie, body: fullProfile })
    const read = await request("/profile", { cookie })

    expect(saved.status).toBe(200)
    expect(profileSchema.parse(await saved.json())).toEqual(fullProfile)
    expect(profileSchema.parse(await read.json())).toEqual(fullProfile)
  })

  it("guardar de nuevo reemplaza el perfil entero", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    await request("/profile", { method: "PUT", cookie, body: fullProfile })

    const response = await request("/profile", {
      method: "PUT",
      cookie,
      body: { ...emptyProfile, address: "  Otra dirección  " },
    })

    expect(profileSchema.parse(await response.json())).toEqual({ ...emptyProfile, address: "Otra dirección" })
  })

  it("normaliza los textos vacíos a null", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const response = await request("/profile", {
      method: "PUT",
      cookie,
      body: { ...fullProfile, phone: "", addressReference: "   " },
    })

    expect(profileSchema.parse(await response.json())).toMatchObject({ phone: null, addressReference: null })
  })

  it.each([
    { ...emptyProfile, phone: "123" },
    { ...emptyProfile, alternateContactPhone: "abc" },
    { ...emptyProfile, address: "a".repeat(201) },
    { phone: null },
    {},
  ])("rechaza %j con INVALID_PROFILE", async (body) => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const response = await request("/profile", { method: "PUT", cookie, body })
    const error = errorResponseSchema.parse(await response.json())

    expect(response.status).toBe(400)
    expect(error).toMatchObject({ code: "INVALID_PROFILE", message: "Invalid profile" })
  })

  it("cada usuario ve solo su perfil", async () => {
    const owner = await signUpTestUser(emailPrefix)
    const other = await signUpTestUser(emailPrefix)
    await request("/profile", { method: "PUT", cookie: owner.cookie, body: fullProfile })

    const read = await request("/profile", { cookie: other.cookie })

    expect(profileSchema.parse(await read.json())).toEqual(emptyProfile)
  })

  it("no registra los datos personales en el log", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    const log = vi.spyOn(console, "log").mockImplementation(() => {})

    await request("/profile", { method: "PUT", cookie, body: fullProfile })

    const logged = log.mock.calls.flat().join("\n")
    expect(logged).toContain("PUT /v1/profile 200")
    for (const value of Object.values(fullProfile)) expect(logged).not.toContain(value)
  })
})
