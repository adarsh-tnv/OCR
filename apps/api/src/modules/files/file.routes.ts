import { Router } from "express";
import { fileChatRequestSchema, predefinedExtractionRequestSchema } from "@iso-ocr/shared";
import { validate } from "../../middleware/validate.js";
import {
  chatWithFile,
  extractPredefinedFields,
  getDefaultExtractionFields
} from "./file-ai.controller.js";
import {
  deleteFile,
  getFile,
  getPreview,
  listFiles,
  uploadFiles,
  uploadMiddleware
} from "./file.controller.js";
import { fileIdParamsSchema, listFilesQuerySchema } from "./file.validators.js";

export const fileRoutes = Router();

fileRoutes.post("/upload", uploadMiddleware, uploadFiles);
fileRoutes.get("/extraction-fields/defaults", getDefaultExtractionFields);
fileRoutes.get("/", validate(listFilesQuerySchema, "query"), listFiles);
fileRoutes.post(
  "/:id/extract-fields",
  validate(fileIdParamsSchema, "params"),
  validate(predefinedExtractionRequestSchema, "body"),
  extractPredefinedFields
);
fileRoutes.post(
  "/:id/chat",
  validate(fileIdParamsSchema, "params"),
  validate(fileChatRequestSchema, "body"),
  chatWithFile
);
fileRoutes.get("/:id", validate(fileIdParamsSchema, "params"), getFile);
fileRoutes.get("/:id/preview", validate(fileIdParamsSchema, "params"), getPreview);
fileRoutes.delete("/:id", validate(fileIdParamsSchema, "params"), deleteFile);
