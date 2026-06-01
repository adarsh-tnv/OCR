import { asyncHandler } from "../../utils/async-handler.js";
import { jsonSafe } from "../../utils/json-safe.js";
import { fileAiService } from "./file-ai.service.js";

export const getDefaultExtractionFields = asyncHandler(async (_req, res) => {
  res.json({ items: fileAiService.getDefaultFields() });
});

export const extractPredefinedFields = asyncHandler(async (req, res) => {
  const data = await fileAiService.extractPredefinedFields(req.params.id as string, req.body);
  res.json(jsonSafe(data));
});

export const chatWithFile = asyncHandler(async (req, res) => {
  const data = await fileAiService.chat(req.params.id as string, req.body.message as string);
  res.json(jsonSafe(data));
});
