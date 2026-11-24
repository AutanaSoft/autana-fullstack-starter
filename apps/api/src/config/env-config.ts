import "./load-env"
import z from "zod"

// Better Auth lee BETTER_AUTH_SECRET y BETTER_AUTH_URL por su cuenta; se validan aquí para fallar al arrancar.
const envSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  // Una ruta en la URL tendría prioridad sobre el basePath de Better Auth, que se fija en auth.ts.
  BETTER_AUTH_URL: z.url().refine((url) => new URL(url).pathname === "/", { error: "No debe incluir una ruta" }),
  // Origen del frontend que Better Auth acepta en las peticiones con cookies.
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
  // Una variable vacía (`PORT=`) se trata como no definida y usa el puerto por defecto.
  PORT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(65535).default(3000)
  ),
  // Activar solo detrás de un proxy inverso que añada la IP del cliente a `X-Forwarded-For`; si no, es falsificable.
  TRUST_PROXY: z.stringbool().default(false),
  NODE_ENV: z.string().optional(),
})

export function parseEnv(source: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(source)
  if (!result.success) throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(result.error)}`)
  return result.data
}

export default parseEnv(process.env)
