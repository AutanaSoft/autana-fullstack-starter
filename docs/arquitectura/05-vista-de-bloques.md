# Vista de bloques de construcción

## Backend

### Estructura de `apps/api`

`<name>` representa el nombre de un módulo y `<action>` el de una operación.

```text
apps/api/
├── vite.config.ts
├── vitest.config.ts
├── test/
│   ├── integration/
│   └── support/
└── src/
    ├── index.ts
    ├── app.ts
    ├── config/
    │   ├── env-config.ts
    │   └── load-env.ts
    ├── auth/
    │   └── auth.ts
    ├── errors/
    │   └── error-response.ts
    ├── middleware/
    │   └── <name>.ts
    ├── db/
    │   └── client.ts
    └── features/
        └── <name>/
            ├── routes/
            │   ├── index.ts
            │   └── <action>.ts
            ├── schemas.ts
            └── <helper>.ts
```

- `src/index.ts` arranca el servidor en Node.js. Al recibir `SIGTERM` o `SIGINT`, deja de aceptar conexiones y cierra el
  pool.
- `src/app.ts` configura Hono, los middlewares globales, `onError`, `notFound` y el documento OpenAPI.
- `src/config/` valida las variables de entorno al arrancar (`env-config.ts`) y carga el `.env` local (`load-env.ts`).
- `src/auth/` configura la librería de autenticación y sus sesiones (`auth.ts`) y adapta sus respuestas al contrato de
  la API (`auth-handler.ts`).
- `src/errors/` construye los errores públicos (`createErrorResponse`) y describe los de `HTTPException`.
- `src/middleware/` contiene los middlewares compartidos por varios módulos.
- `src/db/` crea la conexión con PostgreSQL (`client.ts`) con la URL validada de `config/`, usando el paquete
  `database`.
- `src/features/<name>/` contiene un módulo por funcionalidad.
- `test/integration/` contiene las pruebas de integración de la API, y `test/support/`, la preparación de la base de
  pruebas. Las pruebas unitarias viven junto al archivo que prueban (`<archivo>.test.ts`). Los niveles y su criterio
  están en [Pruebas](./08-conceptos-transversales.md#pruebas).

#### Reglas de dependencia

- `app.ts` monta los módulos y no contiene lógica de negocio.
- Un módulo importa de `db/`, `middleware/`, `auth/`, `config/` y de los paquetes `contracts` y `database`. Estos no
  importan de los módulos.
- Los módulos no se importan entre sí. Lo que dos módulos necesitan en común sube a `middleware/` o, si lo consume el
  frontend, al paquete `contracts`.
- Un helper o una consulta pasa de la ruta al módulo cuando otra ruta del mismo módulo lo reutiliza. Un middleware pasa
  a `src/middleware/` cuando lo reutiliza otro módulo.
- Importa con el alias `@/` los módulos que estén a dos o más niveles de distancia. Los imports cercanos son relativos.

#### Anatomía de un módulo

- `routes/<action>.ts` define una operación con `createRoute` y la registra con `app.openapi()`. Exporta un
  `OpenAPIHono` con esa única operación.
- `routes/index.ts` monta las operaciones con `route('/', ...)`, aplica los middlewares del módulo y declara el
  `defaultHook` de validación.
- `schemas.ts` contiene los esquemas Zod compartidos por varias rutas del módulo. Los esquemas de uso exclusivo pueden
  vivir junto a su ruta.
- `<helper>.ts` contiene los helpers del módulo, como los que adaptan una fila de la base de datos al tipo del contrato.

`app.ts` monta cada módulo bajo su prefijo con `api.route('/<name>', <name>Routes)`, donde `api` es
`app.basePath(apiBasePath)`. El prefijo se aplica a la ruta HTTP y al contrato OpenAPI. Cada módulo declara sus rutas
relativas a él.

### Estructura de `packages/contracts`

```text
packages/contracts/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── api.ts
    ├── <name>.ts
    └── <name>.test.ts
```

- `src/api.ts` exporta `apiBasePath`, el prefijo común de la API.
- `src/<name>.ts` contiene los esquemas Zod de peticiones y respuestas de un módulo, junto con los tipos que se infieren
  de ellos. Se importa como `@autana/contracts/<name>`.
- `src/<name>.test.ts` prueba los esquemas de `<name>.ts` y vive junto a ellos.
- El paquete se distribuye como fuente TypeScript, sin paso de compilación: `exports` apunta a `./src/*.ts`. `zod` es
  una dependencia de pares para que el backend y el frontend compartan una sola instancia.
- Quien lo consume resuelve la fuente de forma distinta. El backend la incluye en su bundle con `ssr.noExternal` en
  `vite.config.ts`. El frontend la resuelve con `paths` en `tsconfig.app.json` y con el propio Vite.

### Estructura de `packages/database`

```text
packages/database/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── vitest.config.ts
├── .env.example
├── migrations/
├── test/
└── src/
    ├── client.ts
    ├── migrate.ts
    ├── reset.ts
    ├── scripts/
    │   └── reset.ts
    └── schema/
        └── <name>.ts
```

- `src/schema/<name>.ts` define las tablas, y `migrations/` contiene las migraciones versionadas de Drizzle Kit.
- `src/client.ts` exporta `createDatabase(url)`, que crea el pool de PostgreSQL y el cliente de Drizzle. El paquete no
  lee variables de entorno ni depende de la API: la URL llega por parámetro.
- `src/migrate.ts` exporta `migrateDatabase(url)`, que aplica las migraciones pendientes a la base indicada.
- `src/reset.ts` exporta `resetDatabase(url)`, que deja la base como recién creada, y `src/scripts/reset.ts` es el
  comando que lo ejecuta con confirmación.
- `drizzle.config.ts` configura Drizzle Kit y carga el `.env` del paquete, que solo define `DATABASE_URL`.
- Se distribuye como fuente TypeScript, igual que `contracts`. El backend la incluye en su bundle con `ssr.noExternal`.

## Frontend

### Estructura de carpetas

`<name>` representa el nombre de la funcionalidad.

```text
src/
├── main.tsx
├── app/
│   ├── router.tsx
│   ├── providers.tsx
│   ├── layouts/
│   │   └── root-layout.tsx
│   └── pages/
│       ├── error-page.tsx
│       ├── loading-page.tsx
│       └── not-found-page.tsx
├── features/
│   └── <name>/
│       ├── routes.tsx
│       ├── layouts/
│       ├── pages/
│       ├── components/
│       ├── api/
│       ├── hooks/
│       └── schemas/
├── components/
│   └── common/
├── hooks/
├── lib/
└── test/
```

Junto a `src/`, `apps/app` contiene `vitest.config.ts`. `src/test/` reúne lo compartido por las pruebas de Vitest: el
servidor de MSW, su preparación y los auxiliares.

Crea en cada funcionalidad solo las carpetas que use:

- Las subcarpetas de `components/` se crean según la necesidad y se nombran por su contenido: `forms/`, `dialogs/`,
  `lists/`, `filters/`, `menus/`.
- `api/errors.ts` existe únicamente cuando varias peticiones interpretan sus errores del mismo modo.
- Cuando una funcionalidad tiene muchos endpoints, `api/` se subdivide por recurso (por ejemplo, `api/comments/`).

#### Responsabilidad de cada pieza

- **`app/router.tsx`:** crea el router y ensambla las rutas de cada funcionalidad bajo `RootLayout`.
- **`app/layouts/root-layout.tsx`:** layout raíz. Renderiza `<Outlet />` y lleva el `ErrorBoundary` de toda la
  aplicación.
- **`app/pages/`:** páginas globales: error inesperado, ruta no encontrada y estado de carga inicial (`HydrateFallback`)
  mientras se descarga el código diferido de la primera ruta.
- **`app/providers.tsx`:** monta los proveedores globales, como el cliente de consultas.
- **`features/panel/`:** contenedor de las pantallas privadas. Su layout aplica la guarda de sesión y muestra la barra
  lateral y la cabecera. No es un recurso: como una funcionalidad no importa de otra, `app/router.tsx` lo compone con
  las rutas de las funcionalidades privadas mediante `createPanelRoutes([...])`. Cada ruta declara su título en `handle`
  y la cabecera lo lee.
- **`routes.tsx`:** exporta la ruta de la funcionalidad: su layout y las páginas hijas.
- **`layouts/`:** estructura compartida por las páginas de la funcionalidad. No consulta datos. Las pantallas privadas
  no llevan layout propio: se montan bajo el layout de `features/panel`, que aplica la guarda de sesión.
- **`pages/`:** conectan la ruta con los datos. Llaman a los hooks, definen las acciones de negocio y componen los
  componentes de la página.
- **`components/`:** piezas de interfaz de la funcionalidad. Pueden gestionar su estado local, como un formulario.
- **`api/`:** funciones de TypeScript sin React. Cada archivo realiza una petición con el cliente HTTP, valida la
  respuesta con el esquema del contrato e interpreta los errores propios de esa petición.
- **`hooks/` de la feature:** envuelven las funciones de `api/` con la librería de consultas. Definen la clave de caché,
  la invalidación y las opciones. Un hook de filtros lee y escribe en la URL los filtros y la página.
- **`schemas/`:** esquemas de validación propios de la funcionalidad, como los de sus formularios. Cada esquema vive en
  su propio archivo. Los contratos de la API se importan del paquete de contratos del monorepo.
- **`components/common/`:** componentes propios reutilizados entre funcionalidades.
- **`hooks/` y `lib/`:** hooks y utilidades compartidos entre funcionalidades, como el cliente HTTP y el cliente de
  autenticación.

### Reglas de dependencia

1. Una funcionalidad no importa código de otra. Si dos funcionalidades necesitan lo mismo, ese código sube a
   `components/`, `hooks/` o `lib/`.
2. `app/` puede importar de cualquier funcionalidad. Ninguna funcionalidad importa de `app/`.
3. `components/`, `hooks/` y `lib/` no importan de las funcionalidades.
4. Los hooks no importan el cliente HTTP. Llaman a las funciones de `api/`.
5. Las funciones de `api/` no usan React ni la librería de consultas. La única excepción es el cliente de autenticación
   (`lib/auth-client.ts`), que se importa de `better-auth/react` porque los layouts también lo usan para leer la sesión
   con `useSession`.
6. No se usan archivos `index.ts` que reexporten módulos. Cada import apunta directamente al archivo que define lo
   importado.
7. Los layouts no consultan los datos de una página. Esa responsabilidad corresponde a la página. El layout del panel sí
   comprueba la sesión para proteger las pantallas privadas.
8. Si un componente existe en el registro de shadcn/ui, se instala con el CLI en lugar de escribirse a mano.
9. `className` se usa para el layout. No se sobrescriben los colores, la tipografía ni los tamaños de un componente: se
   usan sus variantes (`variant`, `size`).
10. Los filtros y la página de una lista viven en la URL, no en el estado de un componente.

> **Verificación.** Estas reglas se comprueban en la revisión de código. La configuración de lint de la plantilla no las
> aplica automáticamente. Si se decide automatizarlas, debe añadirse una regla de restricción de imports por carpeta;
> hasta entonces, el revisor es quien las hace cumplir.

### Ejemplo de una funcionalidad

Consulta la guía [Crear una funcionalidad en el frontend](../guias/frontend/nueva-funcionalidad/README.md). La plantilla
incluye `tasks` y `profile` como funcionalidades de ejemplo, que se retiran según
[Retirar las funcionalidades de ejemplo](../guias/general/retirar-funcionalidades-de-ejemplo.md).
