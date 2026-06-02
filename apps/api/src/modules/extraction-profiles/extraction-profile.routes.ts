import { Router } from "express";
import { documentCategorySchema, updateExtractionProfileSchema } from "@iso-ocr/shared";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import {
  getExtractionProfile,
  listExtractionProfiles,
  updateExtractionProfile
} from "./extraction-profile.controller.js";

const paramsSchema = z.object({
  category: documentCategorySchema
});

export const extractionProfileRoutes = Router();

extractionProfileRoutes.get("/", listExtractionProfiles);
extractionProfileRoutes.get("/:category", validate(paramsSchema, "params"), getExtractionProfile);
extractionProfileRoutes.put(
  "/:category",
  validate(paramsSchema, "params"),
  validate(updateExtractionProfileSchema, "body"),
  updateExtractionProfile
);
