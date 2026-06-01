import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { fileIdParamsSchema } from "../certificates/certificate.validators.js";
import { getOcrResult, processDocument, retryProcessing } from "./ocr.controller.js";

export const ocrRoutes = Router();

ocrRoutes.post("/:fileId/process", validate(fileIdParamsSchema, "params"), processDocument);
ocrRoutes.post("/:fileId/retry", validate(fileIdParamsSchema, "params"), retryProcessing);
ocrRoutes.get("/:fileId", validate(fileIdParamsSchema, "params"), getOcrResult);
