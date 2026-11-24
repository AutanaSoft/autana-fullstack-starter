import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { createSecureHeaders } from "./secure-headers"

describe("cabeceras de seguridad", () => {
  it("fuera de desarrollo añade una CSP que no permite cargar nada", async () => {
    const production = new Hono().use(createSecureHeaders(false)).get("/", (c) => c.text("ok"))
    const response = await production.request("/")

    expect(response.headers.get("Content-Security-Policy")).toBe("default-src 'none'; frame-ancestors 'none'")
  })
})
