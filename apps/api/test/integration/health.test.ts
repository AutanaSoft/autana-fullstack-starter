import { healthResponseSchema } from "@autana/contracts/health"
import { apiBasePath } from "@autana/contracts/api"
import { describe, expect, it } from "vitest"

import app from "@/app"

describe("GET /health", () => {
  it("responde con el contrato de salud", async () => {
    const response = await app.request(`${apiBasePath}/health`)

    expect(response.status).toBe(200)
    expect(healthResponseSchema.parse(await response.json())).toEqual({ status: "ok" })
  })
})

describe("ciclo de la petición", () => {
  it("genera un X-Request-Id cuando el cliente no envía uno", async () => {
    const response = await app.request(`${apiBasePath}/health`)

    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("reutiliza el X-Request-Id válido del cliente", async () => {
    const response = await app.request(`${apiBasePath}/health`, { headers: { "X-Request-Id": "mi-id_123" } })

    expect(response.headers.get("X-Request-Id")).toBe("mi-id_123")
  })

  it("sustituye un X-Request-Id con caracteres no permitidos", async () => {
    const response = await app.request(`${apiBasePath}/health`, { headers: { "X-Request-Id": "¡malo!" } })

    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/)
  })
})
