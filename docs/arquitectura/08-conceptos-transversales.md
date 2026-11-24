# Conceptos transversales

## Backend

### Compilación y desarrollo

`apps/api` se empaqueta con Vite (`vite build`, modo SSR) en un único `dist/index.js`. `tsc` solo comprueba tipos
(`noEmit`) y no genera código.

- **Alias `@/`.** Se declara en `tsconfig.json` (`paths`), en `vite.config.ts` y en `vitest.config.ts`, y los tres deben
  mantenerse sincronizados. `paths` solo afecta a los tipos: Node no lo resuelve, por lo que el código se ejecuta
  siempre desde el bundle y nunca con `node src/index.ts`.
- **Ruta del bundle.** El bundle se escribe en `dist/`. El código fuente y el bundle están a distinta profundidad, por
  lo que `load-env.ts` no depende de su ubicación: carga `.env` relativo al directorio de ejecución, `apps/api`. Por eso
  funciona igual desde `src/config/` y desde `dist/`.
- **Desarrollo.** `npm run dev` ejecuta mediante Turborepo la tarea `dev` de `apps/api`, que lanza `vite`.
  `@hono/vite-dev-server` (adaptador de Node) carga `src/app.ts` y recarga cuando cambia el código, sin compilar un
  bundle ni reiniciar Node. El servidor de desarrollo no ejecuta `src/index.ts`: el arranque, el puerto de producción y
  el cierre ordenado solo existen en el bundle.
- **Puerto.** `env-config.ts` lee `PORT` (3000 por defecto, y también si está vacío). `vite.config.ts` lo lee con
  `loadEnv` de `apps/api/.env` para el servidor de desarrollo. Una variable definida en el entorno prevalece sobre el
  `.env`.

### Definición de una ruta

Define cada operación con `createRoute` y regístrala con `app.openapi(route, handler)`. Escribe el handler justo después
de la definición de la ruta, como recomienda la
[guía de buenas prácticas de Hono](https://hono.dev/docs/guides/best-practices).

- `method` y `path`. Escribe los parámetros de ruta con llaves, como `/{resourceId}`. Hono los convierte a `:resourceId`
  y OpenAPI conserva las llaves.
- `middleware: [<middleware>] as const`, solo cuando una única ruta del módulo lo necesita. `as const` permite a
  TypeScript inferir el contexto. Si todas las rutas del módulo exigen sesión, `routes/index.ts` aplica `noStore` y
  `requireSession` con `use()`.
- `request`. Declara `params`, `query` o `body` con los esquemas Zod del paquete `contracts`.
- `responses`. Declara cada estado que la ruta puede devolver con su esquema, incluidos `401` (si la ruta exige sesión)
  y `500`. Estos esquemas documentan el contrato y tipan el handler, pero Hono no valida la respuesta en ejecución.

Crea el router con el tipo de contexto, por ejemplo `new OpenAPIHono<SessionEnv>()`, para que las variables del
contexto, como el identificador de usuario, no sean opcionales. En el handler:

1. Lee los datos validados con `c.req.valid('param')`, `c.req.valid('query')` o `c.req.valid('json')`.
2. Consulta con Drizzle y autoriza. Limita siempre el acceso a la cuenta autenticada y devuelve `404` cuando un recurso
   es ajeno, para no revelar qué identificadores existen.
3. Ejecuta la acción. En una mutación, incluye el propietario y la precondición de estado en el `WHERE`. Si una
   operación concurrente impide que se modifique la fila, responde `409` con un código propio de la operación.
4. Serializa el cuerpo con el esquema y responde con `c.json(schema.parse(body), status)`. Indica siempre el código de
   estado. Los errores se construyen con `createErrorResponse`, que valida el cuerpo con `errorResponseSchema`.

Las reglas que relacionan varios campos de una petición se comprueban en el handler y responden con el error público de
la operación.

#### Ejemplo genérico

Consulta la guía [Definir una ruta en el backend](../guias/backend/nueva-ruta.md).

### Validación y errores

El router de cada módulo declara un `defaultHook` que convierte un fallo de validación en el error público de la
operación según el destino que falló (`param`, `query` o `json`). Los sub-routers lo heredan al montarse. Los códigos
son propios de cada módulo, por lo que el hook no vive en `app.ts`.

Hono lanza una `HTTPException` cuando el cuerpo no es procesable: un JSON malformado o un tipo de contenido distinto de
`application/json`. `app.onError` es el único manejador de errores y responde siempre con el cuerpo de
`errorResponseSchema` (`packages/contracts/src/errors.ts`):

```json
{
  "message": "Resource not found",
  "error": "Not Found",
  "statusCode": 404,
  "code": "NOT_FOUND",
  "requestId": "3f2b8c1e-7a4d-4e9b-a6c5-1d2e8f90b7a3"
}
```

- `code` es el identificador estable. El cliente decide qué mostrar según él, nunca según `message`.
- `message` está en inglés y es un texto fijo por `code`: nunca contiene el detalle de una excepción.
- `error` y `statusCode` salen siempre del estado HTTP, porque `createErrorResponse` (`src/errors/error-response.ts`)
  los deriva de él.
- `requestId` es el de la cabecera `X-Request-Id`, para que el usuario pueda indicarlo al reportar un fallo.

| Origen                           | Estado  | Código                                                                |
| -------------------------------- | ------- | --------------------------------------------------------------------- |
| `HTTPException`                  | El suyo | `BAD_REQUEST` (`400`), `UNSUPPORTED_MEDIA_TYPE` (`415`), `HTTP_ERROR` |
| Error inesperado                 | `500`   | `INTERNAL_ERROR`, y se registra el detalle y el `requestId` en el log |
| Ruta inexistente bajo `/v1/`     | `404`   | `NOT_FOUND`                                                           |
| Ruta inexistente fuera de `/v1/` | `404`   | Respuesta de texto                                                    |

- Lanza una `HTTPException` solo cuando un middleware de Hono lo requiera. En los handlers, responde con
  `c.json(createErrorResponse(status, code, message, c.get('requestId')), status)` y el código público de la operación.

### Serialización de respuestas con Zod

Serializa con el esquema del contrato todas las respuestas correctas, porque es la capa que impide que un dato interno o
sensible llegue al cliente.

- Declara los campos públicos con `z.object()` en cada nivel: `parse` descarta las propiedades que el esquema no
  declara, como el propietario de una fila.
- Si el cuerpo no cumple el esquema, `parse` lanza un error y `app.onError` responde `500 INTERNAL_ERROR` sin exponer el
  detalle.
- No uses `z.strictObject()` ni `.passthrough()` en los esquemas de respuesta. El primero convierte un campo adicional
  en un `500` y el segundo lo deja pasar.
- Los helpers de un módulo solo adaptan los tipos que el esquema no convierte, como las fechas de la base de datos. No
  filtran campos.
- Para errores con un código público definido por el servidor, construye el cuerpo con `createErrorResponse`.

### Autenticación y autorización

- La librería de autenticación atiende por sí misma sus rutas bajo `/v1/auth/*`, con sus propios contratos y códigos de
  error. `app.ts` las monta con `auth.handler`. No definas rutas de autenticación propias.
- `auth.ts` usa `@better-auth/drizzle-adapter` con `advanced.database.generateId: "uuid"`, que con PostgreSQL delega la
  generación del id en la base de datos. Habilita el acceso con correo y contraseña (de 8 a 64 caracteres) y acepta
  peticiones del origen de la variable `WEB_ORIGIN` (`http://localhost:5173` por defecto). El plugin `openAPI`, que
  publica `/v1/auth/reference`, solo se registra cuando `NODE_ENV` es `development`.
- Las reglas de la cuenta (nombre, correo y contraseña) viven en `packages/contracts/src/auth.ts` y las usan el
  formulario y el servidor. El servidor las aplica en `databaseHooks.user.create.before` y `update.before`
  (`src/auth/user-validation.ts`), para cubrir todos los endpoints que crean o modifican un usuario, no solo el
  registro. Guarda los valores normalizados (nombre recortado, correo en minúsculas) y, si una regla falla, responde
  `400` con `INVALID_NAME` o `INVALID_EMAIL` y un `message` fijo. Los mensajes de las reglas son el texto del formulario
  y nunca salen de la API. Los límites de la contraseña (`passwordLength`) se leen del mismo contrato en la
  configuración de Better Auth.
- Los errores de validación de Better Auth (`VALIDATION_ERROR`) llevan en `handleAuthRequest` el mensaje fijo
  `Validation error`, porque el original contiene el detalle de Zod.
- `app.ts` no devuelve la respuesta de `auth.handler` tal cual: pasa por `handleAuthRequest`
  (`src/auth/auth-handler.ts`), que copia `X-Request-Id` y reescribe sus errores con `errorResponseSchema`. Conserva el
  `code` y el `message` originales y deja intactas las respuestas correctas y las redirecciones. La referencia
  `/v1/auth/reference` sigue describiendo los errores con la forma original de la librería.
- `auth.ts` fija su `basePath` en `${apiBasePath}/auth`, de modo que coincide con el montaje. La variable de entorno con
  la URL base no debe incluir una ruta, porque tendría prioridad.
- `src/middleware/session.ts` exporta `requireSession`, que exige una sesión válida y publica el identificador del
  usuario en el contexto, y el tipo `SessionEnv` con el que se crean los routers que lo usan. Sin sesión responde `401`
  con el código `SESSION_REQUIRED` y un mensaje fijo, que no distingue una cookie ausente, caducada o manipulada.
- La autorización se hace en el handler: toda consulta se limita a la cuenta autenticada, y un recurso ajeno responde
  `404`.

### Middlewares

Cada middleware global vive en `src/middleware/`. Su orden de registro, que importa, está en
[Ciclo de una petición](./06-vista-de-ejecucion.md#ciclo-de-una-petición).

- **Registro.** `requestLogger` escribe una línea por petición con el `requestId`, el método, la ruta, el estado y la
  duración. No registra cabeceras ni cuerpos.
- **Cabeceras de seguridad.** `secureHeaders` de Hono. Fuera de desarrollo añade una CSP que no permite cargar nada
  (`default-src 'none'`); en desarrollo se omite porque la documentación (Scalar) carga recursos propios.
- **CORS.** Solo acepta el origen `WEB_ORIGIN`, con `credentials: true`, y expone `X-Request-Id`. Con el frontend y la
  API en el mismo origen el navegador no lo usa; con dominios distintos lo exige.
- **CSRF.** `hono/csrf` con `WEB_ORIGIN`, en todas las rutas salvo `/v1/auth/*`, donde Better Auth valida el origen.
  Solo inspecciona peticiones con tipo de contenido de formulario, y trata una petición sin tipo de contenido (como un
  `DELETE`) como `text/plain`: exige entonces que `Origin` sea `WEB_ORIGIN`, cosa que un navegador cumple siempre. La
  API exige JSON, así que la protección principal es CORS más las cookies `SameSite=Lax`.
- **Límite de peticiones.** Solo en producción, para que el desarrollo y las pruebas no choquen con él. Un límite global
  por IP (100 por minuto) y otro para las escrituras (20 por minuto, excepto `/v1/auth/*`, que usa el límite de Better
  Auth). Responde `429 RATE_LIMITED` con `Retry-After`. Con `TRUST_PROXY=true` toma la IP de la última entrada de
  `X-Forwarded-For`; actívalo solo detrás de un proxy inverso que la añada.

### Caché

Las respuestas no se guardan en una caché del servidor. Las rutas cuyo contenido no debe almacenarse añaden
`Cache-Control: no-store` con el middleware `noStore` (`src/middleware/no-store.ts`), y la librería de autenticación lo
añade a las suyas. `noStore` se registra antes que `requireSession` para que también alcance a su `401`. El middleware
`cache` de Hono usa la Cache API, que Node.js no incluye.

### Datos

- **Nombres de las bases de datos.** `DATABASE_URL` es la única variable de conexión y apunta a la base de desarrollo.
  `<base>` es el nombre con el que termina esa URL. Las pruebas derivan su base añadiéndole un sufijo, en el mismo
  servidor: `<base>_test` para las de Vitest. Cambiar el nombre en `DATABASE_URL` cambia las dos, y ningún archivo del
  código ni de la documentación escribe un nombre fijo. La preparación de las bases de pruebas se describe en
  [Particularidades del backend](#particularidades-del-backend).
- `packages/database/src/schema/<name>.ts` define las tablas de cada módulo.
- `apps/api/src/db/client.ts` crea el pool de PostgreSQL y el cliente de Drizzle con `createDatabase` del paquete
  `database`. Al apagar el servidor se cierra el pool.
- `packages/database/drizzle.config.ts` configura Drizzle Kit, y `packages/database/migrations/` contiene las
  migraciones versionadas. Se generan con `npm run db:generate` y se aplican con `npm run db:migrate`. El `DATABASE_URL`
  de ese comando sale de `packages/database/.env`. Mientras no haya datos que preservar hay una sola migración,
  `0000_db_init`, que se regenera al cambiar el esquema en lugar de añadir otra. La guía de
  [comandos](../guias/general/comandos.md) explica cómo.
- `npm run db:reset` deja la base de `DATABASE_URL` como recién creada: en una transacción elimina los esquemas `public`
  y `drizzle` y recrea `public`, y después aplica las migraciones. Muestra la base, el host y el entorno, y exige
  escribir el nombre de la base y responder `yes`; no hay forma de omitirlo. Además, `resetDatabase` se niega con
  `NODE_ENV=production` y con un nombre de base no válido. Al eliminar `public` se pierden también sus extensiones; la
  plantilla no usa ninguna, y si se añade una debe recrearse en `reset.ts`. Sus pruebas, en `packages/database/test/`,
  usan una base temporal propia, porque el reinicio destruye el esquema.
- Los identificadores son `uuid` y los genera PostgreSQL con `gen_random_uuid()`. Las columnas de fecha son
  `timestamptz` (`timestamp` con `withTimezone: true`).
- `packages/database/src/schema/auth.ts` define las tablas de Better Auth (`user`, `session`, `account` y
  `verification`) y es la fuente de verdad: no se regenera con la CLI de Better Auth, que crea los ids como texto y las
  fechas sin zona horaria. Better Auth comprueba que el esquema coincida con lo que necesita (`validateSchema`, activo
  fuera de producción).

### Configuración y entornos

- `src/config/env-config.ts` valida las variables de entorno al arrancar y detiene el proceso con un mensaje que nombra
  cada variable inválida. Lee únicamente `process.env`; importa `load-env.ts` antes de validar.
- `src/config/load-env.ts` carga el `.env` de `apps/api`, que no se versiona y contiene los valores propios de cada
  equipo. Lo importa `env-config.ts`, y solo lo carga si existe. No sobrescribe las variables ya definidas. Usa una ruta
  relativa al directorio de ejecución, por lo que los scripts del workspace deben ejecutarse desde `apps/api`.
  `vitest.config.ts` lee el `.env` con `loadEnv` y lo pasa a las pruebas de integración mediante `test.env`.
- `packages/database/drizzle.config.ts` carga `packages/database/.env` con el mismo criterio, y tampoco usa
  `import.meta.dirname`, que no existe cuando Drizzle Kit carga el archivo como CommonJS.
- Cada workspace tiene su propio `.env` (`apps/api/.env`, `apps/app/.env` y `packages/database/.env`). El frontend lo
  lee con `loadEnv` y el `envDir` por defecto de Vite, y su proxy de desarrollo usa `API_PROXY_TARGET`, sin depender de
  variables de la API.
- Cada `.env.example` se versiona, lista las variables del workspace con valores de ejemplo y sin secretos, y sirve de
  plantilla.
- En producción no existe `.env`: el despliegue define las variables de entorno y debe definir `NODE_ENV=production`.
  Además de ocultar la documentación, la librería de autenticación activa en producción su límite de peticiones y las
  cookies seguras.

## Frontend

### Estado

Cada tipo de estado tiene un único lugar:

- **Datos del servidor:** caché de la librería de consultas (hooks de la feature). Ejemplo: lista de recursos, detalle.
- **Filtros, página y orden:** parámetros de búsqueda de la URL. Ejemplo: `?status=archived&page=2`.
- **Valores de un formulario:** librería de formularios, dentro del componente. Ejemplo: campos y errores de validación.
- **Estado de interfaz puntual:** estado local del componente. Ejemplo: diálogo abierto, pestaña activa interna.
- **Sesión:** cliente de autenticación, consultado en el layout de la funcionalidad protegida. Ejemplo: usuario
  autenticado.
- **Preferencias de la app:** proveedor global en `app/providers.tsx`. Ejemplo: tema.

Reglas de uso:

- Los datos del servidor no se copian a estado local ni a un almacén global. La caché es la fuente de verdad.
- No se añade un almacén global de cliente salvo que un requisito concreto lo exija y ningún tipo de la lista lo cubra.
- Lo que el usuario debe recuperar al recargar o compartir un enlace va en la URL.

#### Estado en la URL

Los filtros y la paginación se guardan en los parámetros de búsqueda con `useSearchParams`, dentro de un hook de la
funcionalidad (por ejemplo, `useProductFilters`). Así sobreviven a una recarga y al botón Atrás.

- Un valor ausente o inválido se sustituye por el predeterminado, y el predeterminado no se escribe en la URL.
- Cambiar un filtro vuelve a la primera página.
- Los enlaces de paginación llevan un `href` real, que conserva el resto de filtros, y navegan sin recargar la página.
  En los extremos se muestra un botón deshabilitado.

[React Router: `useSearchParams`](https://reactrouter.com/api/hooks/useSearchParams)

### Autenticación en el frontend

- `lib/auth-client.ts` crea el cliente de Better Auth con `basePath` igual a `${apiBasePath}/auth` y sin `baseURL`, de
  modo que usa el origen de la página. Lo comparten las funcionalidades que lo necesitan y el layout del panel.
- Las funciones de `features/auth/api/` llaman al cliente, que devuelve el error en lugar de lanzarlo, y lanzan un
  `Error` con un mensaje en español. El registro usa un mensaje genérico para no revelar qué correos ya existen.
- `PanelLayout` (`features/panel`) es el layout protegido de todas las pantallas privadas: sin sesión redirige a
  `/auth/sign-in`, y un fallo de red no redirige. `AuthLayout` redirige a la primera pantalla privada cuando ya hay
  sesión, y la raíz `/` hace lo mismo.
- Las páginas de acceso no navegan al terminar: la redirección de `AuthLayout` ocurre cuando la sesión ya existe. Si
  navegaran de inmediato, `PanelLayout` leería una sesión sin refrescar y redirigiría de vuelta al acceso durante unos
  milisegundos.
- **Mismo origen.** La cookie de sesión y la validación de `Origin` de Better Auth funcionan sin CORS cuando el
  navegador solo habla con un origen. En desarrollo lo garantiza el proxy de `server.proxy` en `vite.config.ts`, que
  reenvía `${apiBasePath}` al puerto `PORT` de la API. En producción debe hacerlo un proxy inverso que sirva el frontend
  y la API bajo el mismo dominio.
- **Dominios distintos del mismo sitio** (por ejemplo `app.example.com` y `api.example.com`): se activan con
  `VITE_API_URL`, que `lib/auth-client.ts` pasa como `baseURL`. El cliente de Better Auth ya envía las cookies en las
  peticiones entre orígenes. En la API, `WEB_ORIGIN` debe ser el origen real del frontend (lo usan CORS y
  `trustedOrigins`) y `BETTER_AUTH_URL` el de la API. La cookie de sesión queda ligada al dominio de la API y
  `SameSite=Lax` la envía porque ambos dominios son del mismo sitio. Fuera de desarrollo la cookie es `Secure`, así que
  ambos orígenes deben usar `https`.
- **Sitios distintos** (por ejemplo `miapp.com` y `miapi.com`) no están soportados: `SameSite=Lax` no envía la cookie de
  sesión y haría falta `SameSite=None`, que los navegadores restringen como cookie de terceros.

### Cliente HTTP y consultas

- `lib/api-client.ts` es la instancia de Axios para la API. Su `baseURL` es `VITE_API_URL` (o el origen de la página)
  seguido de `apiBasePath`, y envía las cookies (`withCredentials`). Las funciones de `api/` escriben las rutas sin el
  prefijo.
- `lib/api-error.ts` extrae el `code` público de un error de la API (`getApiErrorCode`), o `null` si el fallo no vino de
  ella. Las pantallas deciden qué mostrar según el código, nunca según el `message`.
- `lib/query-client.ts` crea el cliente de consultas. Reintenta dos veces, y solo ante una caída de red o un `5xx`: un
  `4xx` no cambia al repetirlo. Cuando la API responde `SESSION_REQUIRED` (por ejemplo, porque la sesión caducó), vuelve
  a consultar la sesión y `PanelLayout` redirige al acceso. `app/providers.tsx` lo monta.

### Errores, carga y estados vacíos

- **Error inesperado:** lo captura el `ErrorBoundary` de `RootLayout`.
- **Ruta inexistente:** la muestra `NotFoundPage`.
- **Error de una petición:** lo interpreta la función de `api/` que la realiza (o `api/errors.ts` si varias comparten la
  interpretación). La página decide cómo mostrarlo.
- **Respuesta inválida:** el esquema del contrato falla en `api/` y el error llega a la página como cualquier otro error
  de petición.
- **Carga y vacío:** cada página muestra un estado de carga (esqueleto) y un estado vacío explícito. Un error de
  petición no se confunde con un resultado vacío.
- **Error de envío de un formulario:** se muestra dentro del formulario, sin salir de la pantalla.

### Formularios

La página define `handleSubmit` con la acción de negocio y pasa esa función como `onSubmit` hasta el componente del
formulario. Los componentes intermedios, como una tarjeta, reenvían la función.

El componente que contiene el `<form>` inicializa la librería de formularios y controla los valores, la validación y la
presentación de errores. Valida con el esquema del formulario mediante su resolver. La página devuelve o espera la
promesa de la mutación, de modo que el formulario puede usar `isSubmitting` mientras se guarda y mostrar un mensaje si
el envío falla. [React Hook Form: `handleSubmit`](https://react-hook-form.com/docs/useform/handlesubmit)

### Estilos y sistema de diseño

- Los componentes base proceden de shadcn/ui y se instalan con su CLI en el paquete de interfaz compartido.
- Los colores, la tipografía y el modo oscuro se definen con variables CSS globales del paquete de interfaz. Los
  componentes los consumen mediante clases de utilidad y no definen valores propios.
- `className` aporta layout y espaciado. El aspecto de un componente se cambia con sus variantes, no con clases que
  sobrescriban su estilo.
- Si un componente base necesita un cambio de aspecto permanente, se modifica en el paquete de interfaz y no se replica
  en cada uso.
- Antes de sobrescribir un componente existente con el CLI, revisa la diferencia (`--diff`). No se usa `--overwrite` sin
  una decisión explícita.

[shadcn/ui: CLI](https://ui.shadcn.com/docs/cli)

### Accesibilidad, internacionalización y rendimiento

- **Accesibilidad:** los componentes de shadcn/ui aportan la semántica base. Los formularios asocian cada campo con su
  etiqueta y su mensaje de error (`aria-invalid`, `aria-describedby`).
- **Internacionalización:** no hay una librería de i18n definida. Los textos visibles se escriben en un único idioma,
  directamente en los componentes. Si se añade más de un idioma, esta sección debe definir dónde viven los textos.
- **Rendimiento:** los imports directos (sin `index.ts`) mantienen el árbol de dependencias explícito. La carga diferida
  de rutas se aplica donde el tamaño del bundle lo justifique: el panel y cada funcionalidad protegida se declaran con
  `lazy` en su `routes.tsx`, de modo que cada pantalla se descarga al entrar en ella y la primera carga solo incluye el
  núcleo.

### Convenciones de nombres

- Todos los archivos usan kebab-case: componentes, páginas, layouts, hooks y peticiones (`product-form.tsx`,
  `products-layout.tsx`, `products-page.tsx`). Es la convención de shadcn/ui y la del código existente
  (`app-sidebar.tsx`, `use-mobile.ts`).
- Los símbolos exportados mantienen la convención del lenguaje: PascalCase para componentes (`ProductForm`) y camelCase
  para hooks y funciones (`useProductsQuery`).
- Los hooks se nombran `use-<name>-query.ts`, `use-<name>-mutation.ts` y `use-<name>-filters.ts`. `<name>` puede incluir
  el verbo de la operación (`use-create-product-mutation.ts`).
- Los archivos de `api/` llevan el nombre de la operación (`fetch-products.ts`, `create-product.ts`).
- Los archivos de `schemas/` se nombran `<name>-schema.ts` y exportan un único esquema (`create-product-schema.ts`
  exporta `createProductSchema`).
- La ruta de cada funcionalidad se exporta como `<name>Routes`.
- Los identificadores nuevos del código se escriben en inglés.

## Pruebas

### Niveles

La clasificación depende de lo que la prueba necesita para ejecutarse, no del nombre del archivo.

| Nivel                | Qué comprueba                                    | Qué necesita                          |
| -------------------- | ------------------------------------------------ | ------------------------------------- |
| Unitaria             | Una función, esquema, hook o middleware          | Ni la aplicación ni una base de datos |
| De componente        | Un componente o página de React                  | jsdom, Testing Library y MSW          |
| De integración       | Varias piezas conectadas, con `app` o PostgreSQL | La aplicación y, a veces, PostgreSQL  |
| De extremo a extremo | El frontend y la API juntas, en un navegador     | Ambas aplicaciones en ejecución       |

Las unitarias existen en el backend, el frontend y los paquetes. Las de componente, solo en el frontend, y las de
integración, solo en el backend. Las de extremo a extremo todavía no existen.

- Una prueba unitaria puede usar el framework real (Hono o React) sin simular sus piezas. Es lo que Fowler llama una
  prueba unitaria _sociable_ ([UnitTest](https://martinfowler.com/bliki/UnitTest.html)): lo que la hace unitaria es que
  no necesita la aplicación completa ni una base de datos.
- Una prueba de integración comprueba que unidades desarrolladas por separado funcionan al conectarse
  ([IntegrationTest](https://martinfowler.com/bliki/IntegrationTest.html)).
- «De componente» designa siempre una prueba de React. No es el _component test_ de Fowler, que es cualquier prueba que
  limita su alcance a una parte del sistema ([Software Testing Guide](https://martinfowler.com/testing)). Las pruebas de
  la API que llaman a `app.request()` sin base de datos, como las de errores o salud, son de integración en este
  proyecto.
- Las pruebas de una página con MSW son de componentes, aunque recorran varios componentes, el enrutado y la caché de
  consultas.

### Ubicación y convenciones

- Las unitarias y las de componentes viven junto al archivo que prueban y se nombran `<archivo>.test.ts` o
  `<archivo>.test.tsx` (`fetch-products.test.ts`, `product-form.test.tsx`).
- Las de integración viven en `test/integration/` de la aplicación. Hoy solo existen en `apps/api`.
- Lo que una aplicación comparte entre sus pruebas y no es una prueba (la preparación de la base de datos, el servidor
  de MSW) vive en `test/support/` en la API y en `src/test/` en el frontend.
- Cada paquete con pruebas tiene su propio `vitest.config.ts` y su script `test`. `contracts` prueba sus esquemas junto
  a ellos (`src/auth.test.ts`). `database` mantiene sus pruebas en `test/`, y todas usan PostgreSQL.
- Los casos límite de una regla se prueban en unitarias. Las de integración comprueban que las piezas están conectadas y
  que los flujos completos funcionan, no cada combinación de entradas. La proporción sigue la forma de pirámide: muchas
  unitarias y menos pruebas cuanto más amplio es el alcance
  ([The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)).
- `npm test` en la raíz ejecuta las pruebas de todos los workspaces. En la API, `test:unit` y `test:integration`
  ejecutan cada nivel por separado, y el primero no necesita PostgreSQL. Los comandos están en
  [Comandos](../guias/general/comandos.md).
- Para escribir una prueba, consulta las guías [Escribir una prueba en el backend](../guias/backend/nueva-prueba.md) y
  [Escribir pruebas en el frontend](../guias/frontend/nueva-funcionalidad/pruebas.md).

### Qué cubre cada nivel en una API REST

- **Unitaria:** las reglas de validación y sus casos límite, las funciones puras, la configuración y cada middleware por
  separado. Por ejemplo, los esquemas de `contracts`, `describeHttpError`, `validateUserFields`, `parseEnv`, y los
  middleware de CSRF, límite de peticiones y CSP sobre un `Hono` mínimo.
- **De integración:** el contrato HTTP, los middleware dentro de `app`, la persistencia y los flujos de varios pasos.
  Por ejemplo, los errores públicos, las cabeceras y CORS, el registro, el inicio de sesión y la lectura de sesión, el
  esquema de la base frente a Better Auth y el cableado con `NODE_ENV=production`.

### Particularidades del backend

- Las pruebas de integración de `apps/api/test/integration/` llaman a la API con `app.request()` sin abrir un puerto.
- Usan una base PostgreSQL real, por lo que comprueban las consultas, los códigos de estado y los cuerpos públicos. Las
  rutas que exigen sesión se prueban con el flujo real: `signUpTestUser` (`test/support/test-user.ts`) registra un
  usuario y devuelve su cookie, y `deleteTestUsers` elimina los usuarios de cada archivo según su prefijo de correo.
- `vitest.config.ts` define dos proyectos. `unit` incluye `src/**/*.test.ts` y `test/support/**/*.test.ts`, y no tiene
  preparación global. `integration` incluye `test/integration/**/*.test.ts`, fija `NODE_ENV=development` para que la
  documentación esté disponible y deriva la conexión de `DATABASE_URL` hacia `<base>_test` (ver [Datos](#datos)).
- `test/support/global-setup.ts` solo corre con el proyecto `integration`: crea la base de pruebas si no existe y aplica
  las migraciones antes de ejecutarlas, por lo que `npm test` no necesita pasos manuales.
- La preparación rechaza una `DATABASE_URL` que ya termine en `_test`, para no derivar una base de pruebas de otra de
  pruebas. `test/integration/ensure-database.test.ts` comprueba la creación de la base con una base temporal.
- Los middleware de CSRF, límite de peticiones y CSP se prueban dos veces: aislados, en una prueba unitaria junto a su
  código, y registrados en `app`, en `test/integration/production.test.ts`. Esa prueba vuelve a importar `app` con
  `NODE_ENV=production` (`vi.resetModules()` y `vi.stubEnv()`), porque en desarrollo el límite no se registra. Si se
  quita un middleware de `app.ts`, falla la prueba de integración, no la unitaria.
- Las pruebas de la documentación hacen lo mismo con otro `NODE_ENV` para comprobar que responde `404` fuera de
  desarrollo.
- `parseEnv` se prueba de forma unitaria con `vi.stubEnv()` y una importación dinámica, porque `env-config.ts` valida
  `process.env` al importarse. Así la prueba no depende del `.env` de quien la ejecute. `getClientAddress` no se
  exporta: se prueba por su efecto, comprobando qué peticiones comparten contador.
- `test/integration/db-schema.test.ts` compara las tablas que Better Auth necesita (`getAuthTables`) con la base
  migrada: columnas, tipos, nulabilidad y claves foráneas, con ids `uuid` y fechas `timestamptz`.
- Bajo Vitest, Better Auth desactiva la comprobación de origen de las peticiones. El rechazo de un origen no confiable
  (`403 INVALID_ORIGIN`) no puede probarse allí y se comprueba contra la API en ejecución.
- Cada prueba de integración crea sus propios usuarios y los elimina al terminar, lo que borra también los datos
  asociados.
- Las pruebas construyen las URL con `apiBasePath`.

### Particularidades del frontend

- **Unitarias (Vitest).** Prueban funciones sin interfaz: las de `api/` y la configuración del cliente de autenticación
  (`lib/`). Los hooks y los esquemas de `schemas/` se prueban igual cuando una funcionalidad los tiene.
- **De componentes (Vitest, React Testing Library y jsdom).** Renderizan un componente o una página y comprueban lo que
  ve y hace el usuario, no su implementación interna. Las peticiones HTTP se simulan con MSW, así que no necesitan la
  API real.
- Qué se prueba en cada capa:
  - `api/`: unitarias, con la API simulada con MSW. Comprueban lo que la función envía, lo que devuelve y cómo traduce
    los errores.
  - `hooks/`: unitarias, o de componentes cuando dependen de la caché de consultas o de la URL.
  - `components/`: de componentes.
  - `layouts/`: de componentes, con un router en memoria y la sesión simulada con `mockSession`. Cubren cada rama:
    sesión, sin sesión, carga y error.
  - `pages/`: de componentes, con MSW para los datos. Renderizan la página dentro de su layout y comprueban el flujo:
    enviar el formulario y la redirección que provoca la sesión nueva.
  - `app/router.tsx`: se prueba con el router real, navegando a cada ruta.
- `src/test/setup.ts` activa MSW al cargarse y no en `beforeAll`, porque el cliente de autenticación captura `fetch` al
  importarse. Con `onUnhandledFrame: "error"`, una petición sin respuesta declarada hace fallar la prueba en lugar de
  salir a la red.
- El estado de sesión del cliente de autenticación es global al módulo. `mockSession` (`src/test/mock-session.ts`)
  declara la respuesta de `get-session` y espera a que el cliente la consulte, para que una prueba no herede el estado
  de la anterior.
- jsdom no implementa `window.matchMedia`, que usan el sidebar y el proveedor del tema. `stubMatchMedia`
  (`src/test/match-media.ts`) lo sustituye en las pruebas que lo necesitan y se deshace con `vi.unstubAllGlobals()`.

### Pruebas de extremo a extremo

Recorren el frontend y la API juntas en un navegador real, y comprueban lo que ninguna otra capa ve: la cookie de sesión
entre recargas, las guardas de ruta y el proxy de Vite. No pertenecen a una sola aplicación. Hoy no existen: el motivo y
la condición para reintroducirlas están en [Riesgos y deuda técnica](./11-riesgos-y-deuda-tecnica.md).
