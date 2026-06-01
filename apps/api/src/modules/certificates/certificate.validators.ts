import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid MongoDB ObjectId");

export const certificateIdParamsSchema = z.object({
  id: objectIdSchema
});

export const fileIdParamsSchema = z.object({
  fileId: objectIdSchema
});
