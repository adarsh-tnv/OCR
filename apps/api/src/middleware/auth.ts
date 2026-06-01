import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

const hash = (value: string) => createHash("sha256").update(value).digest();

export const apiAuthEnabled = Boolean(env.API_AUTH_TOKEN);

export const verifyApiToken = (token: unknown) => {
  if (!apiAuthEnabled) return true;
  if (typeof token !== "string" || !token) return false;

  const expected = hash(env.API_AUTH_TOKEN as string);
  const received = hash(token);
  return timingSafeEqual(expected, received);
};

const bearerToken = (header: string | undefined) => {
  if (!header) return null;
  const [scheme, token] = header.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
};

export const requireApiAuth: RequestHandler = (req, _res, next) => {
  if (!apiAuthEnabled) {
    next();
    return;
  }

  const token = bearerToken(req.get("authorization")) ?? req.get("x-api-key");
  if (!verifyApiToken(token)) {
    next(new ApiError(401, "UNAUTHORIZED", "Valid API authorization token is required"));
    return;
  }

  next();
};
