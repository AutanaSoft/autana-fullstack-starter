# Escribir una prueba en el backend

Ejemplos genéricos con `<name>` y `<resource>`, que ilustran los niveles descritos en
[Pruebas](../../arquitectura/08-conceptos-transversales.md#pruebas). Antes de escribir una prueba, decide su nivel:

- Si no necesita la aplicación completa ni una base de datos, es **unitaria** y va junto al archivo que prueba.
- Si usa `app` o PostgreSQL, es de **integración** y va en `apps/api/test/integration/`.

## Prueba unitaria

Va junto al archivo que prueba, con el mismo nombre y la extensión `.test.ts`. No necesita PostgreSQL ni variables de
entorno.

```ts
// src/errors/error-response.test.ts
import { describe, expect, it } from "vitest"

import { describeHttpError } from "./error-response"

describe("describeHttpError", () => {
  it("el estado 404 tiene un código y un mensaje propios", () => {
    expect(describeHttpError(404)).toEqual({ code: "NOT_FOUND", message: "Resource not found" })
  })

  it("el resto de estados usan HTTP_ERROR con el texto estándar del estado", () => {
    expect(describeHttpError(503)).toEqual({ code: "HTTP_ERROR", message: "Service Unavailable" })
  })
})
```

Un middleware se prueba aislado, montado en un `Hono` mínimo, sin la aplicación completa:

```ts
// src/middleware/<name>.test.ts
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { create<Name> } from "./<name>"

describe("<name>", () => {
  const testApp = new Hono().use(create<Name>()).get("/", (c) => c.text("ok"))

  it("responde con la cabecera esperada", async () => {
    const response = await testApp.request("/")

    expect(response.headers.get("<Cabecera>")).toBe("<valor>")
  })
})
```

Cuando el módulo valida variables de entorno al importarse, como `config/env-config.ts`, define las variables con
`vi.stubEnv()` y importa el módulo de forma dinámica:

```ts
// src/config/env-config.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

let parseEnv: typeof import("./env-config").parseEnv

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgres://usuario:clave@localhost:5432/autana")
  vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32))
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000")
  ;({ parseEnv } = await import("./env-config"))
})

afterAll(() => vi.unstubAllEnvs())
```

## Prueba de integración

Va en `test/integration/` y llama a `app.request()` sin abrir un puerto. Construye las URL con `apiBasePath`. Si crea
datos, los elimina al terminar:

```ts
// test/integration/<name>.test.ts
import { apiBasePath } from "@autana/contracts/api"
import { errorResponseSchema } from "@autana/contracts/errors"
import { describe, expect, it } from "vitest"

import app from "@/app"

describe("GET /<resource>", () => {
  it("responde con el contrato público", async () => {
    const response = await app.request(`${apiBasePath}/<resource>`)

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Request-Id")).toBeTruthy()
  })

  it("un recurso inexistente responde 404 con el contrato de error", async () => {
    const response = await app.request(`${apiBasePath}/<resource>/no-existe`)
    const body = errorResponseSchema.parse(await response.json())

    expect(response.status).toBe(404)
    expect(body.requestId).toBe(response.headers.get("X-Request-Id"))
  })
})
```

Para comprobar el comportamiento que cambia con `NODE_ENV`, vuelve a importar `app` con otro valor:

```ts
// test/integration/production.test.ts
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.unstubAllEnvs())

describe("la aplicación con NODE_ENV=production", () => {
  it("añade una CSP que no permite cargar nada", async () => {
    vi.resetModules()
    vi.stubEnv("NODE_ENV", "production")
    const { default: app } = await import("@/app")

    const response = await app.request("/v1/health")

    expect(response.headers.get("Content-Security-Policy")).toBe("default-src 'none'; frame-ancestors 'none'")
  })
})
```

## Ejecutarlas

- `npm run test:unit -w api` ejecuta solo las unitarias y no necesita PostgreSQL.
- `npm run test:integration -w api` ejecuta solo las de integración y prepara la base `<base>_test`.
- `npm test` ejecuta todas las pruebas del monorepo.
