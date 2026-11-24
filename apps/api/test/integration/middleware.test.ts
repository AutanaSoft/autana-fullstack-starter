import { apiBasePath } from "@autana/contracts/api"
import { afterEach, describe, expect, it, vi } from "vitest"

import app from "@/app"
import envConfig from "@/config/env-config"

const healthUrl = `${apiBasePath}/health`

// Ruta de prueba registrada antes de la primera petición, porque el router se construye al usarse.
app.get("/test/large", (c) => c.text("a".repeat(2000)))

describe("compresión", () => {
  it("comprime las respuestas grandes con gzip", async () => {
    const response = await app.request("/test/large", { headers: { "Accept-Encoding": "gzip" } })

    expect(response.headers.get("Content-Encoding")).toBe("gzip")
  })
})

describe("cabeceras de seguridad", () => {
  it("las añade a las respuestas de la API", async () => {
    const response = await app.request(healthUrl)

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(response.headers.get("X-Frame-Options")).toBeTruthy()
  })
})

describe("CORS", () => {
  it("responde al preflight del origen del frontend con cookies", async () => {
    const response = await app.request(healthUrl, {
      method: "OPTIONS",
      headers: { Origin: envConfig.WEB_ORIGIN, "Access-Control-Request-Method": "POST" },
    })

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(envConfig.WEB_ORIGIN)
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true")
  })

  it("no autoriza un origen ajeno", async () => {
    const response = await app.request(healthUrl, { headers: { Origin: "https://evil.example" } })

    expect(response.headers.get("Access-Control-Allow-Origin")).not.toBe("https://evil.example")
  })

  it("expone X-Request-Id al navegador", async () => {
    const response = await app.request(healthUrl, { headers: { Origin: envConfig.WEB_ORIGIN } })

    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("X-Request-Id")
  })
})

describe("registro de peticiones", () => {
  afterEach(() => vi.restoreAllMocks())

  it("registra método, ruta, estado y el identificador de la petición", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})

    const response = await app.request(healthUrl, { headers: { "X-Request-Id": "log-test-1" } })

    expect(response.status).toBe(200)
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[log-test-1\] GET \/v1\/health 200 \d+ms$/))
  })
})
