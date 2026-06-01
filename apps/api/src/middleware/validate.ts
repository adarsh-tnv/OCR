import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";

type ValidationTarget = "body" | "query" | "params";

export const validate =
  (schema: ZodSchema, target: ValidationTarget = "body"): RequestHandler =>
  (req, _res, next) => {
    req[target] = schema.parse(req[target]);
    next();
  };
