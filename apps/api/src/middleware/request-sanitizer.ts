import type { RequestHandler } from "express";

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
    (acc, [key, nestedValue]) => {
      if (key.startsWith("$") || key.includes(".")) return acc;
      acc[key] = sanitizeValue(nestedValue);
      return acc;
    },
    {}
  );
};

export const requestSanitizer: RequestHandler = (req, _res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query) as typeof req.query;
  next();
};
