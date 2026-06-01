export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown | undefined;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (resource: string) =>
  new ApiError(404, "NOT_FOUND", `${resource} was not found`);

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "BAD_REQUEST", message, details);

export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, "CONFLICT", message, details);
