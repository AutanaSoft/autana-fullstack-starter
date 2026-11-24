import { apiBasePath } from "@autana/contracts/api"
import { afterEach, describe, expect, it, vi } from "vitest"

import app from "@/app"

const docsPaths = ["/openapi.json", "/docs", "/auth/reference"]

async function requestStatuses(nodeEnv: string | undefined) {
  vi.resetModules()
  if (nodeEnv === undefined) vi.stubEnv("NODE_ENV", undefined as unknown as string)
  else vi.stubEnv("NODE_ENV", nodeEnv)
  const { default: app } = await import("@/app")

  const docs = await Promise.all(docsPaths.map(async (path) => (await app.request(`${apiBasePath}${path}`)).status))
  const health = (await app.request(`${apiBasePath}/health`)).status
  return { docs, health }
}

afterEach(() => vi.unstubAllEnvs())

describe("documentación de la API", () => {
  it("se publica con NODE_ENV=development", async () => {
    expect((await requestStatuses("development")).docs).toEqual([200, 200, 200])
  })

  it.each(["production", "test", undefined])(
    "responde 404 con NODE_ENV=%s y el resto de la API sigue disponible",
    async (nodeEnv) => {
      expect(await requestStatuses(nodeEnv)).toEqual({ docs: [404, 404, 404], health: 200 })
    }
  )

  it("el documento OpenAPI describe las rutas de tareas y perfil", async () => {
    const document = (await (await app.request(`${apiBasePath}/openapi.json`)).json()) as {
      paths: Record<string, Record<string, unknown>>
    }

    expect(Object.keys(document.paths["/v1/tasks"]).toSorted()).toEqual(["get", "post"])
    expect(Object.keys(document.paths["/v1/tasks/{taskId}"]).toSorted()).toEqual(["delete", "get", "patch"])
    expect(Object.keys(document.paths["/v1/profile"]).toSorted()).toEqual(["get", "put"])
  })
})
