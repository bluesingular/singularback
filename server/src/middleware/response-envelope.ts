/**
 * server/src/middleware/response-envelope.ts
 *
 * T5 — API response envelope standardisation.
 *
 * All Swwarm API routes must return:
 *   { ok: true, data: T }         on success
 *   { ok: false, error: { code, message, details? } }  on error
 *
 * This middleware wraps express error handling to normalise errors.
 * Success responses are NOT automatically wrapped (routes already return data)
 * to avoid breaking the existing codebase — only errors are normalised here.
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import pino from "pino";

const logger = pino({ name: "response-envelope" });

export class SwwarmError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "SwwarmError";
  }
}

export const errorEnvelopeMiddleware: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) { next(err); return; }

  if (err instanceof SwwarmError) {
    res.status(err.statusCode).json({
      ok: false,
      error: {
        code:    err.code,
        message: err.message,
        ...(process.env.NODE_ENV !== "production" && err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Known HTTP errors (from errors.js helpers)
  const httpErr = err as { statusCode?: number; status?: number; message?: string; code?: string };
  const status  = httpErr.statusCode ?? httpErr.status ?? 500;
  const message = status < 500
    ? (httpErr.message ?? "Requête invalide")
    : "Une erreur interne s'est produite. Veuillez réessayer.";
  const code = httpErr.code ?? (status < 500 ? "SWWARM_CLIENT_ERROR" : "SWWARM_SERVER_ERROR");

  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, "unhandled server error");
  }

  res.status(status).json({
    ok: false,
    error: { code, message },
  });
};
