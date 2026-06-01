import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } from "@iso-ocr/shared";
import { extname } from "node:path";
import { z } from "zod";
import { env } from "../../config/env.js";
import { badRequest } from "../../utils/api-error.js";
import { objectIdSchema } from "../certificates/certificate.validators.js";

export const fileIdParamsSchema = z.object({
  id: objectIdSchema
});

export const listFilesQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const extensionMimeTypes: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg", "image/jpg"],
  ".jpeg": ["image/jpeg", "image/jpg"]
};

const hasPdfSignature = (buffer: Buffer) => buffer.subarray(0, 5).toString("ascii") === "%PDF-";

const hasPngSignature = (buffer: Buffer) =>
  buffer.length >= 8 &&
  buffer[0] === 0x89 &&
  buffer[1] === 0x50 &&
  buffer[2] === 0x4e &&
  buffer[3] === 0x47 &&
  buffer[4] === 0x0d &&
  buffer[5] === 0x0a &&
  buffer[6] === 0x1a &&
  buffer[7] === 0x0a;

const hasJpegSignature = (buffer: Buffer) =>
  buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

const contentMatchesMimeType = (file: Express.Multer.File) => {
  if (file.mimetype === "application/pdf") return hasPdfSignature(file.buffer);
  if (file.mimetype === "image/png") return hasPngSignature(file.buffer);
  if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") return hasJpegSignature(file.buffer);
  return false;
};

export const validateUploadedFile = (file: Express.Multer.File) => {
  if (!ACCEPTED_MIME_TYPES.includes(file.mimetype as (typeof ACCEPTED_MIME_TYPES)[number])) {
    throw badRequest(`Unsupported file type: ${file.mimetype}`);
  }

  const extension = extname(file.originalname).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
    throw badRequest(`Unsupported file extension: ${extension || "none"}`);
  }

  if (!extensionMimeTypes[extension]?.includes(file.mimetype)) {
    throw badRequest("File extension and MIME type do not match");
  }

  if (!contentMatchesMimeType(file)) {
    throw badRequest("File content does not match the declared file type");
  }

  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw badRequest(`File exceeds maximum size of ${env.MAX_UPLOAD_MB} MB`);
  }
};
