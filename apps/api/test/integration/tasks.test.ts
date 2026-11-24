import { errorResponseSchema } from "@autana/contracts/errors"
import { listTasksResponseSchema, taskSchema } from "@autana/contracts/tasks"
import { afterEach, describe, expect, it } from "vitest"

import { deleteTestUsers, request, signUpTestUser } from "../support/test-user"

const emailPrefix = "tasks-"

afterEach(() => deleteTestUsers(emailPrefix))

// Una tarea siempre nace en `todo`; `status` la pasa después a otro estado con una modificación.
async function createTask(cookie: string, body: unknown = { title: "Pagar la factura" }, status?: string) {
  const response = await request("/tasks", { method: "POST", cookie, body })
  const created = taskSchema.parse(await response.json())
  if (!status) return created

  const updated = await request(`/tasks/${created.id}`, { method: "PATCH", cookie, body: { status } })
  return taskSchema.parse(await updated.json())
}

describe("sin sesión", () => {
  it.each([
    ["GET", "/tasks"],
    ["POST", "/tasks"],
    ["GET", "/tasks/3f2b8c1e-7a4d-4e9b-a6c5-1d2e8f90b7a3"],
    ["PATCH", "/tasks/3f2b8c1e-7a4d-4e9b-a6c5-1d2e8f90b7a3"],
    ["DELETE", "/tasks/3f2b8c1e-7a4d-4e9b-a6c5-1d2e8f90b7a3"],
  ])("%s %s responde 401 con no-store", async (method, path) => {
    const response = await request(path, { method, body: method === "GET" ? undefined : {} })
    const body = errorResponseSchema.parse(await response.json())

    expect(response.status).toBe(401)
    expect(body).toMatchObject({ code: "SESSION_REQUIRED", message: "Session required" })
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  it("una cookie inventada también responde 401", async () => {
    const response = await request("/tasks", { cookie: "better-auth.session_token=inventado.firma" })

    expect(response.status).toBe(401)
  })
})

describe("crear", () => {
  it("crea una tarea en `todo` con el título recortado", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const response = await request("/tasks", { method: "POST", cookie, body: { title: "  Pagar la factura  " } })
    const body = taskSchema.parse(await response.json())

    expect(response.status).toBe(201)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(body).toMatchObject({ title: "Pagar la factura", status: "todo" })
  })

  it("guarda la descripción recortada y la devuelve", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const created = await createTask(cookie, { title: "Tarea", description: "  Antes del viernes " })
    const read = taskSchema.parse(await (await request(`/tasks/${created.id}`, { cookie })).json())

    expect(created.description).toBe("Antes del viernes")
    expect(read.description).toBe("Antes del viernes")
  })

  it("sin descripción, o con una vacía, la guarda como null", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const without = await createTask(cookie, { title: "Tarea" })
    const empty = await createTask(cookie, { title: "Tarea", description: "   " })

    expect([without.description, empty.description]).toEqual([null, null])
  })

  it.each(["todo", "in_progress", "done"])("no permite indicar el estado %s al crear", async (status) => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const response = await request("/tasks", { method: "POST", cookie, body: { title: "Tarea", status } })

    expect(response.status).toBe(400)
    expect(errorResponseSchema.parse(await response.json()).code).toBe("INVALID_TASK")
  })

  it("no expone el propietario", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const response = await request("/tasks", { method: "POST", cookie, body: { title: "Tarea" } })

    expect(Object.keys(await response.json()).toSorted()).toEqual([
      "createdAt",
      "description",
      "id",
      "status",
      "title",
      "updatedAt",
    ])
  })

  it.each([{}, { title: "   " }, { title: "a".repeat(121) }, { title: "Tarea", description: "a".repeat(501) }])(
    "rechaza %j con INVALID_TASK",
    async (body) => {
      const { cookie } = await signUpTestUser(emailPrefix)

      const response = await request("/tasks", { method: "POST", cookie, body })
      const error = errorResponseSchema.parse(await response.json())

      expect(response.status).toBe(400)
      expect(error).toMatchObject({ code: "INVALID_TASK", message: "Invalid task" })
    }
  )

  it("un cuerpo JSON mal formado responde 400 BAD_REQUEST", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const response = await request("/tasks", { method: "POST", cookie, rawBody: "{no es json" })

    expect(response.status).toBe(400)
    expect(errorResponseSchema.parse(await response.json()).code).toBe("BAD_REQUEST")
  })
})

describe("listar", () => {
  it("devuelve una lista vacía para un usuario sin tareas", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const response = await request("/tasks", { cookie })

    expect(response.status).toBe(200)
    expect(listTasksResponseSchema.parse(await response.json())).toEqual({ items: [], total: 0, page: 1, pageSize: 20 })
  })

  it("ordena de la más reciente a la más antigua", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    await createTask(cookie, { title: "Primera" })
    await createTask(cookie, { title: "Segunda" })

    const body = listTasksResponseSchema.parse(await (await request("/tasks", { cookie })).json())

    expect(body.items.map((item) => item.title)).toEqual(["Segunda", "Primera"])
  })

  it("filtra por estado y cuenta solo las coincidencias", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    await createTask(cookie, { title: "A" })
    await createTask(cookie, { title: "B" }, "done")
    await createTask(cookie, { title: "C" }, "done")

    const body = listTasksResponseSchema.parse(await (await request("/tasks?status=done", { cookie })).json())

    expect(body.total).toBe(2)
    expect(body.items.every((item) => item.status === "done")).toBe(true)
  })

  it("pagina con el total de todas las páginas", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    for (const title of ["A", "B", "C"]) await createTask(cookie, { title })

    const second = listTasksResponseSchema.parse(await (await request("/tasks?page=2&pageSize=2", { cookie })).json())

    expect(second).toMatchObject({ total: 3, page: 2, pageSize: 2 })
    expect(second.items.map((item) => item.title)).toEqual(["A"])
  })

  it.each(["page=0", "pageSize=101", "pageSize=0", "status=archived", "page=abc"])(
    "rechaza %s con INVALID_TASK_QUERY",
    async (query) => {
      const { cookie } = await signUpTestUser(emailPrefix)

      const response = await request(`/tasks?${query}`, { cookie })

      expect(response.status).toBe(400)
      expect(errorResponseSchema.parse(await response.json()).code).toBe("INVALID_TASK_QUERY")
    }
  )
})

describe("obtener, modificar y eliminar", () => {
  it("obtiene una tarea propia", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    const created = await createTask(cookie)

    const response = await request(`/tasks/${created.id}`, { cookie })

    expect(response.status).toBe(200)
    expect(taskSchema.parse(await response.json())).toEqual(created)
  })

  it("modifica solo los campos enviados y actualiza `updatedAt`", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    const created = await createTask(cookie)

    const response = await request(`/tasks/${created.id}`, { method: "PATCH", cookie, body: { status: "done" } })
    const updated = taskSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(updated).toMatchObject({ id: created.id, title: created.title, status: "done" })
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.updatedAt).getTime())
  })

  it("modifica y borra la descripción", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    const created = await createTask(cookie, { title: "Tarea", description: "Detalle" })

    const changed = await request(`/tasks/${created.id}`, { method: "PATCH", cookie, body: { description: "Nuevo" } })
    const cleared = await request(`/tasks/${created.id}`, { method: "PATCH", cookie, body: { description: "" } })

    expect(taskSchema.parse(await changed.json())).toMatchObject({ title: "Tarea", description: "Nuevo" })
    expect(taskSchema.parse(await cleared.json()).description).toBeNull()
  })

  it("rechaza una modificación sin campos", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    const created = await createTask(cookie)

    const response = await request(`/tasks/${created.id}`, { method: "PATCH", cookie, body: {} })

    expect(response.status).toBe(400)
    expect(errorResponseSchema.parse(await response.json()).code).toBe("INVALID_TASK")
  })

  it("elimina una tarea propia", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    const created = await createTask(cookie)

    const response = await request(`/tasks/${created.id}`, { method: "DELETE", cookie })
    const after = await request(`/tasks/${created.id}`, { cookie })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe("")
    expect(after.status).toBe(404)
  })

  it("una tarea inexistente responde 404 TASK_NOT_FOUND", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)
    const id = crypto.randomUUID()

    for (const method of ["GET", "PATCH", "DELETE"]) {
      const response = await request(`/tasks/${id}`, {
        method,
        cookie,
        body: method === "PATCH" ? { title: "x" } : undefined,
      })

      expect(response.status).toBe(404)
      expect(errorResponseSchema.parse(await response.json())).toMatchObject({ code: "TASK_NOT_FOUND" })
    }
  })

  it("un identificador que no es uuid responde 400 INVALID_TASK_ID", async () => {
    const { cookie } = await signUpTestUser(emailPrefix)

    const response = await request("/tasks/no-es-uuid", { cookie })

    expect(response.status).toBe(400)
    expect(errorResponseSchema.parse(await response.json()).code).toBe("INVALID_TASK_ID")
  })
})

describe("aislamiento entre usuarios", () => {
  it("una tarea ajena responde 404 y no se modifica ni se elimina", async () => {
    const owner = await signUpTestUser(emailPrefix)
    const intruder = await signUpTestUser(emailPrefix)
    const created = await createTask(owner.cookie)

    const read = await request(`/tasks/${created.id}`, { cookie: intruder.cookie })
    const update = await request(`/tasks/${created.id}`, {
      method: "PATCH",
      cookie: intruder.cookie,
      body: { title: "Hackeada" },
    })
    const remove = await request(`/tasks/${created.id}`, { method: "DELETE", cookie: intruder.cookie })
    const intact = taskSchema.parse(await (await request(`/tasks/${created.id}`, { cookie: owner.cookie })).json())

    expect([read.status, update.status, remove.status]).toEqual([404, 404, 404])
    expect(intact).toEqual(created)
  })

  it("la lista solo incluye las tareas propias", async () => {
    const owner = await signUpTestUser(emailPrefix)
    const other = await signUpTestUser(emailPrefix)
    await createTask(owner.cookie, { title: "Mía" })
    await createTask(other.cookie, { title: "Ajena" })

    const body = listTasksResponseSchema.parse(await (await request("/tasks", { cookie: owner.cookie })).json())

    expect(body.items.map((item) => item.title)).toEqual(["Mía"])
    expect(body.total).toBe(1)
  })
})
