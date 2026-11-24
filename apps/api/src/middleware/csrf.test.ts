import { apiBasePath } from "@autana/contracts/api"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { createCsrf } from "./csrf"

describe("protección CSRF", () => {
  const protectedApp = new Hono()
    .use(createCsrf("http://localhost:5173"))
    .post(`${apiBasePath}/things`, (c) => c.text("ok"))
    .post(`${apiBasePath}/auth/sign-in`, (c) => c.text("ok"))
  const formPost = (path: string, origin: string) =>
    protectedApp.request(path, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
      body: "a=1",
    })

  it("rechaza un formulario de otro origen", async () => {
    expect((await formPost(`${apiBasePath}/things`, "https://evil.example")).status).toBe(403)
  })

  it("acepta un formulario del origen del frontend", async () => {
    expect((await formPost(`${apiBasePath}/things`, "http://localhost:5173")).status).toBe(200)
  })

  it("deja las rutas de autenticación a Better Auth", async () => {
    expect((await formPost(`${apiBasePath}/auth/sign-in`, "https://evil.example")).status).toBe(200)
  })
})
