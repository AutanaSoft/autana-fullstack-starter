import { resolve } from "node:path"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

import { getTestDatabaseUrl } from "./test/support/test-database-url.ts"

export default defineConfig(({ mode }) => {
  // `loadEnv` no escribe en `process.env`: las variables de .env llegan a las pruebas mediante `test.env`.
  const env = loadEnv(mode, import.meta.dirname, "")

  return {
    resolve: { alias: { "@": resolve(import.meta.dirname, "./src") } },
    test: {
      projects: [
        {
          // Junto al código que prueban. No necesitan PostgreSQL ni variables de entorno.
          extends: true,
          test: { name: "unit", include: ["src/**/*.test.ts", "test/support/**/*.test.ts"] },
        },
        {
          extends: true,
          test: {
            name: "integration",
            include: ["test/integration/**/*.test.ts"],
            globalSetup: "./test/support/global-setup.ts",
            // NODE_ENV=development publica la documentación de la API, que las pruebas comprueban.
            env: { ...env, NODE_ENV: "development", DATABASE_URL: getTestDatabaseUrl(env.DATABASE_URL) },
          },
        },
      ],
    },
  }
})
