import type { NextFunction, Request, Response } from "express";

export const asyncHandler =
  <TRequest extends Request = Request>(
    handler: (req: TRequest, res: Response, next: NextFunction) => Promise<unknown>
  ) =>
  (req: TRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
