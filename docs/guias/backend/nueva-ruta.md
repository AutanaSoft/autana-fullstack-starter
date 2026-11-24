# Definir una ruta en el backend

Ejemplo genérico de una operación con `<resource>` y `<action>`, que ilustra las reglas de
[Conceptos transversales](../../arquitectura/08-conceptos-transversales.md). La implementación de referencia incluida en
la plantilla es `apps/api/src/features/tasks/`.

```ts
const <action>Route = createRoute({
  method: 'patch',
  path: '/{resourceId}/<action>',
  summary: '<Descripción de la operación>',
  request: { params: resourceIdParamsSchema },
  responses: {
    200: { description: 'Operación realizada', content: { 'application/json': { schema: <action>ResponseSchema } } },
    400: { description: 'Identificador inválido', content: { 'application/json': { schema: errorResponseSchema } } },
    401: { description: 'Sin sesión válida', content: { 'application/json': { schema: errorResponseSchema } } },
    404: { description: 'Recurso ajeno', content: { 'application/json': { schema: errorResponseSchema } } },
    409: { description: 'El recurso cambió', content: { 'application/json': { schema: errorResponseSchema } } },
    500: { description: 'Error interno', content: { 'application/json': { schema: errorResponseSchema } } },
  },
});

export const <action>Routes = new OpenAPIHono<SessionEnv>().openapi(<action>Route, async (c) => {
  const { resourceId } = c.req.valid('param');
  const { userId } = c.var;

  const [resource] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.id, resourceId), eq(resources.userId, userId)))
    .limit(1);
  if (!resource) {
    return c.json(createErrorResponse(404, 'RESOURCE_NOT_FOUND', 'Resource not found', c.get('requestId')), 404);
  }

  // El WHERE repite el propietario y el estado para resolver las operaciones concurrentes.
  const [updated] = await db
    .update(resources)
    .set({ /* cambios */ })
    .where(and(eq(resources.id, resourceId), eq(resources.userId, userId), eq(resources.status, resource.status)))
    .returning({ id: resources.id });
  if (!updated) {
    return c.json(createErrorResponse(409, 'RESOURCE_CHANGED', 'Resource changed', c.get('requestId')), 409);
  }

  return c.json(<action>ResponseSchema.parse({ id: updated.id }), 200);
});
```

## Montar el módulo

Si todas las rutas del módulo exigen sesión, `routes/index.ts` aplica los middlewares una vez y declara el
`defaultHook`, que los sub-routers heredan al montarse. `noStore` va antes que `requireSession` para que también alcance
a su `401`. Con una sola ruta que necesite un middleware, usa `middleware: [<middleware>] as const` en su `createRoute`.

```ts
// features/<resource>/routes/index.ts
const defaultHook: Hook<unknown, SessionEnv, string, unknown> = (result, c) => {
  if (result.success) return
  return c.json(createErrorResponse(400, "INVALID_<RESOURCE>", "Invalid <resource>", c.get("requestId")), 400)
}

export const resourceRoutes = new OpenAPIHono<SessionEnv>({ defaultHook })
  .use(noStore)
  .use(requireSession)
  .route("/", listRoutes)
  .route("/", <action>Routes)
```

Después se monta en `app.ts`, en el bloque de rutas del final: `api.route('/<resource>', resourceRoutes)`.
