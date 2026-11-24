# Decisiones de arquitectura

## Backend

### Decisiones

- **Rutas con `createRoute` y sin controladores separados.** Hono infiere los tipos de los parámetros solo cuando el
  handler está junto a la ruta ([guía de Hono](https://hono.dev/docs/guides/best-practices)).
- **Esquemas Zod en un paquete compartido.** Backend, frontend y pruebas validan con la misma definición y OpenAPI se
  genera de ella.
- **`parse` del esquema en todas las respuestas correctas.** Hono no valida la respuesta en ejecución y `parse` descarta
  los campos no declarados.
- **`z.object()` en lugar de `strictObject` o `passthrough`.** El primero convierte un campo adicional en `500` y el
  segundo lo expone.
- **`404` para recursos ajenos.** No revela qué identificadores existen.
- **`WHERE` con propietario y precondición en las mutaciones.** Resuelve las operaciones concurrentes con un `409`.
- **Contratos con `zod` puro y metadatos con `.meta()`.** El paquete compartido no depende de Hono ni de
  `@hono/zod-openapi`; el generador de OpenAPI lee los esquemas de Zod 4 tal cual. Alternativa descartada: importar `z`
  de `@hono/zod-openapi` en los contratos, que ataría el frontend a una dependencia del backend.
- **Paquete de contratos sin compilar.** Las fuentes se consumen directamente, igual que el paquete de interfaz, y no
  hay artefactos que sincronizar. Alternativa descartada: compilar a `dist/` y publicar tipos y JavaScript.
- **Base de datos en un paquete compartido.** El esquema, las migraciones y el cliente viven en `packages/database`, con
  su propio `drizzle.config.ts`, y cualquier workspace puede reutilizarlos sin importar código de la API. Alternativa
  descartada: dejarlos en `apps/api`, que obligaría a otros consumidores a depender de la API.
- **El paquete de base de datos recibe la URL por parámetro.** No importa la configuración de la API, que exige
  variables que el paquete no usa, y cada entorno decide a qué base se conecta.
- **Una sola migración mientras no haya datos que preservar.** Una migración por cambio solo acumula historia sin valor.
  La plantilla la mantiene como `0000_db_init`, se regenera al cambiar el esquema y la base se reinicia con
  `npm run db:reset`. Antes del primer despliegue con datos reales debe volver a migraciones incrementales.
- **Los datos propios del usuario van en tablas aparte de las de Better Auth.** `schema/auth.ts` es el esquema que la
  librería valida, y mezclar columnas propias lo acopla a ella. Se relacionan con `user` por su `id`, con borrado en
  cascada. Alternativa descartada: columnas nuevas en `user` con `additionalFields`.
- **Reinicio de la base con `drop schema` y nueva migración.** Deja la base como recién creada, con el registro de
  migraciones incluido, y comprueba a la vez que las migraciones se aplican desde cero. Alternativa descartada: vaciar
  las tablas con `truncate`, que conserva un esquema obsoleto y no revisa las migraciones.
- **Bundle con Vite y `tsc` solo para tipos.** Un único artefacto resuelve el alias `@/` y el paquete del monorepo, que
  Node no resuelve por sí solo.
- **Cuerpo de error plano, con `requestId` incluido.** Todos los errores comparten un único esquema, y el usuario puede
  indicar el identificador al reportar un fallo. `error` y `statusCode` se derivan del mismo estado para que no se
  desincronicen. `message` es inglés y fijo por `code`, porque el cliente decide por `code`.
- **Errores de Better Auth reescritos con el mismo esquema.** El cliente recibe un único formato en toda la API, y
  conserva el `code` y el `message` originales. Alternativa descartada: dejar la forma de la librería como excepción.
- **Reglas de la cuenta en el contrato, aplicadas también por el servidor.** El formulario y la API validan con el mismo
  esquema, de modo que llamar a la API directamente no permite saltarse las reglas. Se aplican en los hooks de base de
  datos de Better Auth y no solo en `/sign-up/email`, porque `/update-user` también cambia el nombre. Alternativa
  descartada: validar solo en el formulario.
- **Sin caché de servidor.** El middleware `cache` de Hono requiere la Cache API, que Node.js no incluye.
- **`hono-rate-limiter` para el límite de peticiones.** Hono no incluye un limitador. Alternativa descartada: uno
  propio, que habría que mantener y probar.
- **Contadores del límite en memoria.** Una sola instancia no necesita infraestructura adicional. Alternativa
  descartada: PostgreSQL como almacén compartido; se reconsidera si hay varias instancias.
- **Límite de peticiones solo en producción.** Evita que el desarrollo y Vitest choquen con el límite, igual que el de
  Better Auth.
- **Registro de peticiones propio.** El `PrintFunc` de `hono/logger` no tiene acceso al contexto y no puede incluir el
  `requestId`. Alternativa descartada: `hono/logger`.
- **`/v1/auth/*` fuera de CSRF y del límite de escrituras.** Better Auth ya valida el origen y aplica su propio límite;
  duplicarlos podría generar conflictos.
- **Documentación solo con `NODE_ENV=development`.** Evita publicar el contrato y la referencia de autenticación en
  producción.
- **Pruebas unitarias junto al código y de integración en `test/integration/`, con dos proyectos de Vitest.** Las
  unitarias se ejecutan en milisegundos y sin PostgreSQL, y el frontend ya colocaba las suyas junto al código. Las de
  integración conservan la preparación de la base de datos, que solo ejecuta su proyecto. Alternativa descartada: un
  único proyecto con una preparación global, que obliga a toda prueba a depender de la base de datos. La distinción
  sigue las definiciones de [Fowler](https://martinfowler.com/bliki/UnitTest.html) y
  [Microsoft](https://learn.microsoft.com/aspnet/core/test/integration-tests).
- **Cada middleware se prueba aislado y registrado en `app`.** La prueba aislada comprueba que la pieza funciona; la de
  integración, con `NODE_ENV=production`, comprueba que `app.ts` la conecta. Alternativa descartada: solo probar la
  pieza, que no detecta que alguien quite su registro.

## Frontend

### Decisiones y alternativas

- **Organizar por funcionalidad.** Mantiene juntos los cambios que se hacen a la vez y evita dependencias ocultas.
  Alternativa descartada: organizar por tipo de archivo.
  [Bulletproof React: estructura del proyecto](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
- **Sin archivos `index.ts` que reexportan.** Cada import apunta a su origen. Los barrel files pueden dificultar el tree
  shaking de Vite y degradar el rendimiento. Alternativa descartada: barrel files por carpeta.
  [Bulletproof React: estructura del proyecto](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
- **Filtros y página en la URL.** Sobreviven a la recarga y al botón Atrás, y se pueden compartir. Alternativa
  descartada: estado local del componente.
  [React Router: `useSearchParams`](https://reactrouter.com/api/hooks/useSearchParams)
- **Axios con TanStack Query, y reintentos solo ante fallos transitorios.** Un `4xx` no cambia al repetirlo, y repetirlo
  retrasa el error que ve el usuario. Una respuesta `SESSION_REQUIRED` refresca la sesión para que el panel redirija al
  acceso.
- **Datos del servidor solo en la caché de consultas.** Una única fuente de verdad, sin sincronizar copias. Alternativa
  descartada: copiar los datos a un almacén global.
- **`api/` sin React y hooks que la envuelven.** Las peticiones se prueban y reutilizan sin depender de React.
  Alternativa descartada: peticiones dentro de los hooks o componentes.
- **Un panel como contenedor de las pantallas privadas.** La guarda de sesión, la barra lateral y la cabecera se
  escriben una vez en `features/panel`, y `app/router.tsx` monta bajo él las rutas de cada funcionalidad. Una
  funcionalidad no importa de otra, así que el layout de una no podría compartirse con otra. Alternativa descartada: un
  layout por funcionalidad, que repite la barra lateral.
- **El título de la cabecera sale de `handle` en la ruta.** El panel no importa las funcionalidades para conocer sus
  títulos. Alternativa descartada: una tabla de títulos en el panel, que obliga a editarlo con cada pantalla nueva.
- **Archivos en kebab-case.** Coincide con el CLI de shadcn/ui y con el código existente. Alternativa descartada:
  PascalCase para componentes y camelCase para hooks.
- **Componentes base en un paquete de interfaz compartido.** Varias aplicaciones del monorepo pueden compartir el
  sistema de diseño. Alternativa descartada: copiar los componentes en cada aplicación.
