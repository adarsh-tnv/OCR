import multer from "multer";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { jsonSafe } from "../../utils/json-safe.js";
import { fileService } from "./file.service.js";

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: 20
  }
}).array("files", 20);

export const uploadFiles = asyncHandler(async (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  const uploaded = await fileService.upload(files);
  res.status(201).json(jsonSafe({ items: uploaded }));
});

export const listFiles = asyncHandler(async (req, res) => {
  const data = await fileService.list(req.query as never);
  res.json(jsonSafe(data));
});

export const getFile = asyncHandler(async (req, res) => {
  const data = await fileService.getById(req.params.id as string);
  res.json(jsonSafe(data));
});

export const getPreview = asyncHandler(async (req, res) => {
  const data = await fileService.getPreview(req.params.id as string);
  res.json(data);
});

export const deleteFile = asyncHandler(async (req, res) => {
  const data = await fileService.delete(req.params.id as string);
  res.json(jsonSafe(data));
});
