# API

Backend de la aplicación, construido con Hono. Consulta la arquitectura en
[`docs/arquitectura/`](../../docs/arquitectura/README.md).

## Comandos

Ejecuta los comandos desde la raíz del repositorio.

- `npm run dev`: inicia el servidor de desarrollo de Vite con `@hono/vite-dev-server`, que recarga al cambiar el código.
  Escucha en el puerto de `PORT` (3000 por defecto), por ejemplo <http://localhost:3000>.
- `npm run build`: genera el bundle en `apps/api/dist/index.js`.
- `npm run start -w api`: ejecuta el bundle generado.
- `npm run typecheck`: comprueba los tipos sin generar código.
- `npm test`: ejecuta todas las pruebas con Vitest. Crea la base `<base>_test` si no existe y aplica las migraciones.
- `npm run test:unit -w api`: ejecuta solo las unitarias, que no necesitan PostgreSQL.
- `npm run test:integration -w api`: ejecuta solo las de integración.

## Configuración

Copia `.env.example` a `.env` en este directorio y ajusta los valores. La API necesita una base PostgreSQL accesible en
`DATABASE_URL`: crea la base y aplica las migraciones con `npm run db:migrate` antes de arrancar.
