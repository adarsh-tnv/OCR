import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { isProduction } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/api-error.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, "ROUTE_NOT_FOUND", `Route ${req.method} ${req.originalUrl} was not found`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (typeof error === "object" && error && "code" in error && String(error.code).startsWith("LIMIT_")) {
    res.status(400).json({
      error: {
        code: String(error.code),
        message: error instanceof Error ? error.message : "Upload validation failed",
        details: null
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null
      }
    });
    return;
  }

  logger.error({ error }, "Unhandled API error");
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: isProduction ? "Internal server error" : error.message,
      details: null
    }
  });
};
