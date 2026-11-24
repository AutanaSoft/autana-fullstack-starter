import type { ContentfulStatusCode } from "hono/utils/http-status"

import { createErrorResponse, describeHttpError } from "../errors/error-response"
import { auth } from "./auth"

// Better Auth devuelve una `Response` propia: Hono no le añade `X-Request-Id` y sus errores tienen otra forma.
// Aquí se copia la cabecera y se reescriben los errores con el contrato público de la API. Las respuestas
// correctas y las redirecciones pasan sin cambios.
export async function handleAuthRequest(request: Request, requestId: string) {
  const response = await auth.handler(request)
  const headers = new Headers(response.headers)
  headers.set("X-Request-Id", requestId)

  if (response.status < 400) {
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }

  const statusCode = response.status as ContentfulStatusCode
  const original = await readErrorBody(response)
  const fallback = describeHttpError(statusCode)
  const code = original.code ?? fallback.code
  // El mensaje de `VALIDATION_ERROR` lleva el detalle de Zod; se sustituye por un texto fijo, como el resto de códigos.
  const message = code === "VALIDATION_ERROR" ? "Validation error" : (original.message ?? fallback.message)
  const body = createErrorResponse(statusCode, code, message, requestId)

  headers.delete("content-length")
  headers.set("content-type", "application/json")
  return new Response(JSON.stringify(body), { status: response.status, headers })
}

async function readErrorBody(response: Response): Promise<{ code?: string; message?: string }> {
  try {
    const payload: unknown = JSON.parse(await response.text())
    if (typeof payload !== "object" || payload === null) return {}
    const { code, message } = payload as Record<string, unknown>
    return {
      code: typeof code === "string" ? code : undefined,
      message: typeof message === "string" ? message : undefined,
    }
  } catch {
    return {}
  }
}
