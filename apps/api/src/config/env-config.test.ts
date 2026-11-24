import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

// `env-config` valida `process.env` al importarse, así que se define un entorno válido antes de la importación
// dinámica. Así la prueba no depende del archivo `.env` de quien la ejecute.
let parseEnv: typeof import("./env-config").parseEnv

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgres://usuario:clave@localhost:5432/autana")
  vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32))
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000")
  ;({ parseEnv } = await import("./env-config"))
})

afterAll(() => vi.unstubAllEnvs())

const validSource = {
  DATABASE_URL: "postgres://usuario:clave@localhost:5432/autana",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
}

describe("parseEnv", () => {
  it("aplica los valores por defecto cuando solo están las variables obligatorias", () => {
    expect(parseEnv(validSource)).toMatchObject({
      WEB_ORIGIN: "http://localhost:5173",
      PORT: 3000,
      TRUST_PROXY: false,
    })
  })

  it("convierte PORT a número y trata una variable vacía como no definida", () => {
    expect(parseEnv({ ...validSource, PORT: "8080" }).PORT).toBe(8080)
    expect(parseEnv({ ...validSource, PORT: "" }).PORT).toBe(3000)
  })

  it.each(["abc", "0", "65536", "80.5"])("rechaza PORT=%s", (port) => {
    expect(() => parseEnv({ ...validSource, PORT: port })).toThrow(/PORT/)
  })

  it("interpreta TRUST_PROXY como booleano", () => {
    expect(parseEnv({ ...validSource, TRUST_PROXY: "true" }).TRUST_PROXY).toBe(true)
    expect(parseEnv({ ...validSource, TRUST_PROXY: "false" }).TRUST_PROXY).toBe(false)
  })

  it("rechaza un BETTER_AUTH_URL con ruta", () => {
    expect(() => parseEnv({ ...validSource, BETTER_AUTH_URL: "http://localhost:3000/api" })).toThrow(
      /No debe incluir una ruta/
    )
  })

  it("rechaza un BETTER_AUTH_SECRET de menos de 32 caracteres", () => {
    expect(() => parseEnv({ ...validSource, BETTER_AUTH_SECRET: "corto" })).toThrow(/BETTER_AUTH_SECRET/)
  })

  it("informa de las variables obligatorias que faltan", () => {
    expect(() => parseEnv({})).toThrow(/Variables de entorno inválidas[\s\S]*DATABASE_URL/)
  })
})
