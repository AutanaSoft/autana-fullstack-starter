import { resolve } from "node:path"
import devServer from "@hono/vite-dev-server"
import nodeAdapter from "@hono/vite-dev-server/node"
import { defineConfig, loadEnv } from "vite"

// Las variables de apps/api/.env llegan a `process.env` mediante `--env-file-if-exists` en los scripts de
// package.json; las del entorno prevalecen. Vite solo las usa aquí para el puerto del servidor de desarrollo.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "")

  return {
    resolve: { alias: { "@": resolve(import.meta.dirname, "./src") } },
    plugins: [devServer({ entry: "src/app.ts", adapter: nodeAdapter })],
    server: { port: Number(env.PORT ?? 3000) },
    // Los paquetes del workspace se distribuyen como fuente TypeScript, que Node no ejecuta:
    // entran en el bundle y el resto de dependencias quedan como imports externos.
    ssr: { noExternal: ["@autana/contracts", "@autana/database"] },
    build: {
      ssr: "src/index.ts",
      outDir: "dist",
      emptyOutDir: true,
    },
  }
})
