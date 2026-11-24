import { apiBasePath } from "@autana/contracts/api"
import { errorResponseSchema } from "@autana/contracts/errors"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Comprueba que `app.ts` conecta, con NODE_ENV=production, los middleware que en desarrollo no se activan o cambian.
// Cada middleware ya se prueba por separado en `src/middleware`; aquí se verifica que estén registrados.
const healthUrl = `${apiBasePath}/health`
const origin = "http://localhost:5173"

async function importProductionApp() {
  vi.resetModules()
  vi.stubEnv("NODE_ENV", "production")
  return (await import("@/app")).default
}

let app: Awaited<ReturnType<typeof importProductionApp>>

beforeEach(async () => {
  // El registro de peticiones escribiría una línea por cada petición de las pruebas de límite.
  vi.spyOn(console, "log").mockImplementation(() => {})
  app = await importProductionApp()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("la aplicación con NODE_ENV=production", () => {
  it("añade una CSP que no permite cargar nada", async () => {
    const response = await app.request(healthUrl)

    expect(response.headers.get("Content-Security-Policy")).toBe("default-src 'none'; frame-ancestors 'none'")
  })

  it("rechaza un formulario de otro origen con 403", async () => {
    const response = await app.request(`${apiBasePath}/things`, {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/x-www-form-urlencoded" },
      body: "a=1",
    })

    expect(response.status).toBe(403)
  })

  it("no aplica la protección CSRF a las rutas de autenticación", async () => {
    const response = await app.request(`${apiBasePath}/auth/sign-in/email`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nadie@mail.com", password: "12345678" }),
    })

    expect(response.status).not.toBe(403)
  })

  it("limita las peticiones y responde 429 con el contrato de error", async () => {
    for (let i = 0; i < 100; i++) expect((await app.request(healthUrl)).status).toBe(200)
    const response = await app.request(healthUrl)

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("60")
    expect(errorResponseSchema.parse(await response.json())).toMatchObject({ code: "RATE_LIMITED", statusCode: 429 })
  })

  it("aplica un límite más estricto a las escrituras", async () => {
    const write = () => app.request(`${apiBasePath}/things`, { method: "POST", headers: { Origin: origin } })

    for (let i = 0; i < 20; i++) expect((await write()).status).not.toBe(429)

    expect((await write()).status).toBe(429)
    expect((await app.request(healthUrl)).status).toBe(200)
  })
})
