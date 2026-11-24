import { APIError } from "better-auth/api"
import { describe, expect, it } from "vitest"

import { validateUserFields } from "./user-validation"

describe("validateUserFields", () => {
  it("devuelve el nombre recortado y el correo en minúsculas", () => {
    expect(validateUserFields({ name: "  Ana Ruiz ", email: " ANA@Mail.COM " })).toEqual({
      name: "Ana Ruiz",
      email: "ana@mail.com",
    })
  })

  it("no añade los campos que no llegan y conserva el resto de datos", () => {
    const withName = { name: "Ana", image: "a.png" }

    expect(validateUserFields(withName)).toEqual({ name: "Ana", image: "a.png" })
    expect(validateUserFields({})).toEqual({})
  })

  it("no modifica el objeto recibido", () => {
    const input = { name: "  Ana " }

    validateUserFields(input)

    expect(input.name).toBe("  Ana ")
  })

  it.each([
    ["un nombre inválido", { name: "Ana2" }, "INVALID_NAME", "Invalid name"],
    ["un correo inválido", { email: "no-es-correo" }, "INVALID_EMAIL", "Invalid email"],
  ])("rechaza %s con un mensaje fijo", (_description, data, code, message) => {
    expect.assertions(3)

    try {
      validateUserFields(data)
    } catch (error) {
      expect(error).toBeInstanceOf(APIError)
      expect((error as APIError).status).toBe("BAD_REQUEST")
      expect((error as APIError).body).toMatchObject({ code, message })
    }
  })
})
