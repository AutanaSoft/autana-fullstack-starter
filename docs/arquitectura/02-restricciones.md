# Restricciones de la arquitectura

## Stack tecnológico

> Esta sección lista únicamente las tecnologías elegidas por el proyecto y sus versiones. No incluye las dependencias
> que traen por defecto las plantillas de los frameworks ni las del monorepo.

### Monorepo y herramientas base

| Tecnología          | Versión | Rol                                      |
| ------------------- | ------- | ---------------------------------------- |
| Node.js             | 26 LTS  | Entorno de ejecución (`engines`: `>=26`) |
| npm                 | 11.20.0 | Gestor de paquetes y workspaces          |
| Turborepo (`turbo`) | 2.11.13 | Orquestador de tareas del monorepo       |
| TypeScript          | 7.0.2   | Lenguaje                                 |

### Frontend

| Tecnología                                         | Versión  | Rol                                     |
| -------------------------------------------------- | -------- | --------------------------------------- |
| React (`react` y `react-dom`)                      | ^19.3.1  | Biblioteca de interfaz de usuario       |
| Vite                                               | ^8.3.8   | Servidor de desarrollo y compilación    |
| `@vitejs/plugin-react`                             | ^6.3.0   | Plugin de React para Vite               |
| shadcn/ui (CLI `shadcn`)                           | ^4.23.0  | Colección de componentes de interfaz    |
| Tailwind CSS (`tailwindcss` y `@tailwindcss/vite`) | ^4.3.5   | Framework de CSS                        |
| Axios                                              | ^1.21.1  | Cliente HTTP                            |
| TanStack Query (`@tanstack/react-query`)           | ^5.108.1 | Estado del servidor y caché             |
| React Hook Form                                    | ^7.92.0  | Gestión de formularios                  |
| `@hookform/resolvers`                              | ^7.0.8   | Esquemas de validación para formularios |
| Zod                                                | ^4.6.7   | Validación de esquemas                  |
| React Router (`react-router`)                      | ^8.5.2   | Enrutador                               |
| Better Auth (`better-auth`)                        | ^1.7.27  | Cliente de autenticación                |

### Backend

| Tecnología                     | Versión  | Rol                                            |
| ------------------------------ | -------- | ---------------------------------------------- |
| Hono                           | ^4.13.19 | Framework web                                  |
| `@hono/node-server`            | ^2.1.9   | Adaptador de Hono para Node.js                 |
| `hono-rate-limiter`            | ^0.5.4   | Límite de peticiones por IP                    |
| Better Auth                    | ^1.7.27  | Biblioteca de autenticación                    |
| `@better-auth/drizzle-adapter` | ^1.7.27  | Adaptador de Better Auth para Drizzle          |
| Zod                            | ^4.6.7   | Validación de esquemas                         |
| OpenAPI                        | 3.1.2    | Especificación de APIs                         |
| `@hono/zod-openapi`            | ^1.6.3   | Generación de OpenAPI a partir de esquemas Zod |
| `@scalar/hono-api-reference`   | ^0.12.24 | Documentación interactiva de APIs              |
| Vite                           | ^8.3.8   | Compilación de la API en un bundle SSR         |
| `@hono/vite-dev-server`        | ^0.26.1  | Servidor de desarrollo de Hono sobre Vite      |

### Base de datos

| Tecnología  | Versión       | Rol                                          |
| ----------- | ------------- | -------------------------------------------- |
| PostgreSQL  | 18 o superior | Base de datos relacional (desarrollo con 19) |
| `pg`        | ^8.23.1       | Controlador de PostgreSQL para Node.js       |
| `@types/pg` | ^8.23.1       | Tipos de `pg`                                |
| Drizzle ORM | ^0.45.4       | ORM                                          |
| Drizzle Kit | ^0.31.11      | Herramienta de migraciones                   |

### Pruebas

| Tecnología                                       | Versión  | Rol                                                  |
| ------------------------------------------------ | -------- | ---------------------------------------------------- |
| Vitest                                           | ^5.1.1   | Ejecutor de pruebas                                  |
| React Testing Library (`@testing-library/react`) | ^16.3.3  | Pruebas de componentes                               |
| `@testing-library/user-event`                    | ^14.6.13 | Simulación de la interacción del usuario             |
| `@testing-library/jest-dom`                      | ^8.0.0   | Comprobaciones sobre el DOM                          |
| jsdom                                            | ^31.0.1  | Entorno de navegador para las pruebas de componentes |
| MSW (`msw`)                                      | ^3.0.7   | Simulación de la API en las pruebas del frontend     |

### Calidad de código

| Tecnología                                     | Versión | Rol                                      |
| ---------------------------------------------- | ------- | ---------------------------------------- |
| Husky                                          | ^9.1.7  | Gestor de hooks de Git                   |
| Commitlint CLI (`@commitlint/cli`)             | ^21.2.4 | Validación de mensajes de commit         |
| Commitlint (`@commitlint/config-conventional`) | ^21.2.4 | Reglas de Conventional Commits           |
| lint-staged                                    | ^17.6.2 | Comprobaciones sobre archivos preparados |
| Prettier                                       | ^3.10.1 | Formateador de código                    |
| markdownlint (`markdownlint-cli2`)             | ^0.24.2 | Linter de Markdown                       |
| Oxlint                                         | ^1.94.0 | Linter de JavaScript y TypeScript        |
