# Plan de ejemplo: tareas

> Plan de ejemplo de la funcionalidad `tasks` incluida en la plantilla. Parte del
> [PRD de ejemplo](../prd/ejemplo-tareas.md).

## Objetivo

Implementar el registro personal de tareas, de la base de datos a la pantalla.

## Pasos

1. **Contrato** (`packages/contracts/src/tasks.ts`): esquemas Zod de la tarea, de la creación, de la modificación y de
   la lista, con sus límites. Incluir sus pruebas unitarias.
2. **Base de datos** (`packages/database/src/schema/task.ts`): tabla `task` con `user_id` (borrado en cascada), estado
   como enumeración e índice por usuario y estado. Regenerar la migración `0000_db_init` y reiniciar la base.
3. **API** (`apps/api/src/features/tasks/`): una operación por archivo en `routes/` (`list`, `create`, `get`, `update`,
   `delete`), con `requireSession`, `defaultHook` de validación y consultas limitadas al usuario. Montar el módulo en
   `app.ts`.
4. **Pruebas de la API** (`apps/api/test/integration/tasks.test.ts`): sin sesión, validación, tareas ajenas, paginación
   y filtro.
5. **Frontend, datos** (`apps/app/src/features/tasks/`): funciones de `api/`, hooks de consulta y de mutación, y el hook
   de filtros que guarda estado y página en la URL.
6. **Frontend, interfaz**: esquema del formulario, componentes (lista, filtros, formulario y diálogos), página y
   `routes.tsx`. Registrar la ruta en `app/router.tsx` y en la barra lateral.
7. **Pruebas del frontend**: funciones de `api/` con MSW y la página con React Testing Library.
8. **Verificación**: `npm run check` y `npm test`.

## Riesgos

- El esquema de la base y el contrato comparten los valores del estado sin depender uno del otro. Si cambian, deben
  actualizarse a la vez; una prueba de integración lo comprueba.
