import { serve } from "@hono/node-server"

import app from "./app"
import envConfig from "./config/env-config"
import { pool } from "./db/client"

const shutdownTimeoutMs = 10_000

const server = serve(
  {
    fetch: app.fetch,
    port: envConfig.PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  }
)

// Cierra el servidor de forma ordenada y fuerza la salida si las
// conexiones abiertas no terminan dentro del plazo.
const shutdown = () => {
  server.close(() => void pool.end().finally(() => process.exit(0)))
  setTimeout(() => process.exit(1), shutdownTimeoutMs).unref()
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
