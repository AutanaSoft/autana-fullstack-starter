import { errorResponseSchema } from "@autana/contracts/errors"
import { describe, expect, it } from "vitest"

import { createErrorResponse, describeHttpError } from "./error-response"

describe("describeHttpError", () => {
  it.each([
    [400, "BAD_REQUEST", "Bad request"],
    [404, "NOT_FOUND", "Resource not found"],
    [415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported media type"],
  ] as const)("el estado %i tiene un código y un mensaje propios", (status, code, message) => {
    expect(describeHttpError(status)).toEqual({ code, message })
  })

  it("el resto de estados usan HTTP_ERROR con el texto estándar del estado", () => {
    expect(describeHttpError(418)).toEqual({ code: "HTTP_ERROR", message: "I'm a Teapot" })
    expect(describeHttpError(503)).toEqual({ code: "HTTP_ERROR", message: "Service Unavailable" })
  })
})

describe("createErrorResponse", () => {
  it("deriva `error` del estado y cumple el contrato público", () => {
    const body = createErrorResponse(404, "NOT_FOUND", "Resource not found", "req-1")

    expect(errorResponseSchema.parse(body)).toEqual({
      message: "Resource not found",
      error: "Not Found",
      statusCode: 404,
      code: "NOT_FOUND",
      requestId: "req-1",
    })
  })
})
