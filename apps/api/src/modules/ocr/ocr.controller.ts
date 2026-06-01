import { asyncHandler } from "../../utils/async-handler.js";
import { jsonSafe } from "../../utils/json-safe.js";
import { ocrJobService } from "./ocr-job.service.js";
import { ocrService } from "./ocr.service.js";

export const processDocument = asyncHandler(async (req, res) => {
  const data = await ocrJobService.enqueue(req.params.fileId as string, false);
  res.status(202).json(data);
});

export const retryProcessing = asyncHandler(async (req, res) => {
  const data = await ocrJobService.enqueue(req.params.fileId as string, true);
  res.status(202).json(data);
});

export const getOcrResult = asyncHandler(async (req, res) => {
  const data = await ocrService.getOcrResult(req.params.fileId as string);
  res.json(jsonSafe(data));
});
