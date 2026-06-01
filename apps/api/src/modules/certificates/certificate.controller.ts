import { asyncHandler } from "../../utils/async-handler.js";
import { jsonSafe } from "../../utils/json-safe.js";
import { certificateService } from "./certificate.service.js";

export const listCertificates = asyncHandler(async (req, res) => {
  const data = await certificateService.list(req.query);
  res.json(jsonSafe(data));
});

export const getCertificate = asyncHandler(async (req, res) => {
  const data = await certificateService.getById(req.params.id as string);
  res.json(jsonSafe(data));
});

export const getCertificateByFile = asyncHandler(async (req, res) => {
  const data = await certificateService.getByFileId(req.params.fileId as string);
  res.json(jsonSafe(data));
});

export const updateCertificate = asyncHandler(async (req, res) => {
  const data = await certificateService.update(req.params.id as string, req.body);
  res.json(jsonSafe(data));
});

export const addCertificateComment = asyncHandler(async (req, res) => {
  const data = await certificateService.addComment(req.params.id as string, req.body);
  res.status(201).json(jsonSafe(data));
});
