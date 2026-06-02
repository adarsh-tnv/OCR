import { asyncHandler } from "../../utils/async-handler.js";
import { jsonSafe } from "../../utils/json-safe.js";
import { extractionProfileService } from "./extraction-profile.service.js";

export const listExtractionProfiles = asyncHandler(async (_req, res) => {
  const profiles = await extractionProfileService.list();
  res.json(jsonSafe({ items: profiles }));
});

export const getExtractionProfile = asyncHandler(async (req, res) => {
  const profile = await extractionProfileService.get(req.params.category as string);
  res.json(jsonSafe(profile));
});

export const updateExtractionProfile = asyncHandler(async (req, res) => {
  const profile = await extractionProfileService.update(req.params.category as string, req.body);
  res.json(jsonSafe(profile));
});
