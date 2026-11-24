# Vista de ejecución

## Backend

### Ciclo de una petición

1. `requestId()` genera un identificador por petición, lo guarda en `c.var.requestId` y lo devuelve en la cabecera
   `X-Request-Id`. Reutiliza el del cliente si tiene hasta 255 caracteres de `[A-Za-z0-9_=-]` y, si no, genera un UUID.
2. `requestLogger` registra la petición cuando termina, con ese identificador, el estado y la duración.
3. `secureHeaders` añade las cabeceras de seguridad a la respuesta.
4. `cors` responde al preflight y añade las cabeceras CORS a las peticiones de `WEB_ORIGIN`.
5. `rateLimit` responde `429` si la IP supera el límite. Solo se registra cuando `NODE_ENV` es `production`.
6. `compress()` comprime la respuesta con `gzip` o `deflate` según `Accept-Encoding`.
7. `csrf` rechaza con `403` los formularios de otro origen, salvo en `/v1/auth/*`.
8. Los middlewares de la ruta se ejecutan antes que los validadores. Una petición sin sesión recibe `401` aunque además
   sea inválida.
9. Hono valida `param`, `query` y `json` con los esquemas del contrato. Si la validación falla, responde el
   `defaultHook` del módulo.
10. El handler consulta, autoriza, ejecuta la acción y serializa la respuesta con el esquema.
11. Cualquier error no controlado llega a `app.onError`.

Los middlewares globales se registran en `app.ts`, en este orden, antes de montar los módulos. `requestId()` va primero
porque los demás lo usan. `onError` y `notFound` se definen en `app`, no en el prefijo. Qué hace cada middleware se
describe en [Middlewares](./08-conceptos-transversales.md#middlewares).

Hono no añade a una `Response` ya construida las cabeceras guardadas en el contexto. Cualquier ruta que devuelva una
`Response` propia, como la de la librería de autenticación, copia `X-Request-Id` a ella.

## Frontend

### Rutas y layouts

El árbol de rutas se compone así:

```text
RootLayout (ErrorBoundary: ErrorPage)
├── <funcionalidad pública>          layout propio, sin guarda de sesión
│   ├── (index)  página principal
│   └── <ruta>   otras páginas
├── <funcionalidad protegida>        layout propio con guarda de sesión
│   ├── (index)  página principal
│   └── <ruta>   otras páginas
└── *                                NotFoundPage
```

- Cada `routes.tsx` exporta una ruta con su layout y sus páginas hijas. `app/router.tsx` solo las ensambla.
- Un layout no declara rutas. Es la ruta padre y muestra la página activa con `<Outlet />`. Las páginas nuevas se añaden
  como hijas de su layout.
- La guarda de sesión vive en el layout de la funcionalidad protegida, no en `app/`. Redirige a la pantalla de acceso
  cuando no hay sesión y muestra un estado de carga mientras la comprueba. Las funcionalidades públicas no la llevan.
- El layout de cada funcionalidad aporta la cabecera de página y el contenedor del contenido.
- Si varias funcionalidades comparten un mismo shell (por ejemplo, una barra lateral), este vive en `components/common/`
  y recibe su navegación por props, porque lo compartido no conoce los destinos de cada funcionalidad.
- El `ErrorBoundary` de `RootLayout` muestra `ErrorPage` ante un error inesperado. La ruta `*` muestra `NotFoundPage`.
- Las páginas de una funcionalidad se cargan de forma diferida cuando su peso lo justifique. La carga diferida se
  declara en `routes.tsx`.

[React Router: rutas anidadas y `Outlet`](https://reactrouter.com/start/data/routing)

### Flujo de datos

```text
ProductsPage ──► useProductFilters (hooks/) ──► filtros y página en la URL
     │
     ├──► useProductsQuery (hooks/) ──► fetchProducts (api/fetch-products.ts) ──► cliente HTTP ──► API
     │
     └──► ProductList (components/lists/)
```

La página lee los filtros del hook de la URL y llama al hook de consulta. El hook usa la librería de consultas y ejecuta
la función de `api/`, que realiza la petición y valida la respuesta con el esquema del contrato. La página entrega los
datos a sus componentes.
