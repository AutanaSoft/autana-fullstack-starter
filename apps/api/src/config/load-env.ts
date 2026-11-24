import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

// Carga apps/api/.env, que es el directorio desde el que se ejecutan los scripts del workspace (dev, start, test y
// db:*). No usa `import.meta.dirname`, que no existe cuando Drizzle Kit carga drizzle.config.ts como CommonJS, y
// funciona igual desde src/ y desde dist/. No sobrescribe las variables ya definidas, de modo que en producción
// prevalecen las del despliegue.
if (existsSync(".env")) loadEnvFile(".env")
