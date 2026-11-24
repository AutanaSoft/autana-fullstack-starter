import { errorResponseSchema } from "@autana/contracts/errors"
import { Hono } from "hono"
import { requestId } from "hono/request-id"
import { describe, expect, it } from "vitest"

import { createRateLimit } from "./rate-limit"

describe("límite de peticiones", () => {
  const limitedApp = new Hono()
    .use(requestId())
    .use(...createRateLimit({ globalLimit: 3, writeLimit: 1 }))
    .get("/read", (c) => c.text("ok"))
    .post("/write", (c) => c.text("ok"))

  it("responde 429 con el contrato de error y Retry-After al superar el límite global", async () => {
    for (let i = 0; i < 3; i++) expect((await limitedApp.request("/read")).status).toBe(200)
    const response = await limitedApp.request("/read")

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("60")
    expect(errorResponseSchema.parse(await response.json())).toMatchObject({ code: "RATE_LIMITED", statusCode: 429 })
  })

  it("aplica un límite más estricto a las escrituras", async () => {
    const writeApp = new Hono()
      .use(requestId())
      .use(...createRateLimit({ globalLimit: 10, writeLimit: 1 }))
      .post("/write", (c) => c.text("ok"))

    expect((await writeApp.request("/write", { method: "POST" })).status).toBe(200)
    expect((await writeApp.request("/write", { method: "POST" })).status).toBe(429)
  })
})

// La dirección del cliente no se exporta: se comprueba a través de quién comparte contador.
describe("dirección del cliente", () => {
  const createApp = (trustProxy: boolean) =>
    new Hono()
      .use(requestId())
      .use(...createRateLimit({ globalLimit: 1, trustProxy }))
      .get("/read", (c) => c.text("ok"))
  const get = (app: ReturnType<typeof createApp>, forwardedFor: string) =>
    app.request("/read", { headers: { "X-Forwarded-For": forwardedFor } })

  it("con un proxy de confianza usa la última dirección de X-Forwarded-For", async () => {
    const proxied = createApp(true)

    expect((await get(proxied, "1.1.1.1, 9.9.9.9")).status).toBe(200)
    // Otra dirección falsificada al inicio, pero la misma que añadió el proxy: comparte contador.
    expect((await get(proxied, "2.2.2.2, 9.9.9.9")).status).toBe(429)
    expect((await get(proxied, "1.1.1.1, 8.8.8.8")).status).toBe(200)
  })

  it("sin proxy de confianza ignora X-Forwarded-For", async () => {
    const direct = createApp(false)

    expect((await get(direct, "1.1.1.1")).status).toBe(200)
    expect((await get(direct, "2.2.2.2")).status).toBe(429)
  })
})
