import { errorResponseSchema } from "@autana/contracts/errors"
import { apiBasePath } from "@autana/contracts/api"
import { HTTPException } from "hono/http-exception"
import { afterEach, describe, expect, it, vi } from "vitest"

import app from "@/app"

// Rutas de prueba registradas antes de la primera petición, porque el router se construye al usarse.
app.get("/test/boom", () => {
  throw new Error("secret internal detail")
})
app.get("/test/unsupported", () => {
  throw new HTTPException(415)
})
app.get("/test/teapot", () => {
  throw new HTTPException(418)
})

afterEach(() => vi.restoreAllMocks())

describe("errores públicos", () => {
  it("una ruta inexistente bajo /v1 responde 404 con el contrato", async () => {
    const response = await app.request(`${apiBasePath}/no-existe`)
    const body = errorResponseSchema.parse(await response.json())

    expect(response.status).toBe(404)
    expect(body).toMatchObject({ error: "Not Found", statusCode: 404, code: "NOT_FOUND" })
    expect(body.requestId).toBe(response.headers.get("X-Request-Id"))
  })

  it("una ruta inexistente fuera de /v1 responde texto", async () => {
    const response = await app.request("/no-existe")

    expect(response.status).toBe(404)
    expect(response.headers.get("Content-Type")).toContain("text/plain")
  })

  it("un error inesperado responde 500 sin exponer el detalle y lo registra con el requestId", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await app.request("/test/boom", { headers: { "X-Request-Id": "req-500" } })
    const text = await response.text()
    const body = errorResponseSchema.parse(JSON.parse(text))

    expect(response.status).toBe(500)
    expect(body).toEqual({
      message: "Internal server error",
      error: "Internal Server Error",
      statusCode: 500,
      code: "INTERNAL_ERROR",
      requestId: "req-500",
    })
    expect(text).not.toContain("secret internal detail")
    expect(log).toHaveBeenCalledWith("[req-500]", expect.objectContaining({ message: "secret internal detail" }))
  })

  it("una HTTPException conserva su estado con el código público que le corresponde", async () => {
    const unsupported = await app.request("/test/unsupported")
    const teapot = await app.request("/test/teapot")

    expect(unsupported.status).toBe(415)
    expect(errorResponseSchema.parse(await unsupported.json()).code).toBe("UNSUPPORTED_MEDIA_TYPE")
    expect(teapot.status).toBe(418)
    expect(errorResponseSchema.parse(await teapot.json())).toMatchObject({ code: "HTTP_ERROR", statusCode: 418 })
  })
})
