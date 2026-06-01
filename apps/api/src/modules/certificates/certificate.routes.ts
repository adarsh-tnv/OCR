import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import {
  addCertificateComment,
  getCertificate,
  getCertificateByFile,
  listCertificates,
  updateCertificate
} from "./certificate.controller.js";
import { certificateIdParamsSchema, fileIdParamsSchema } from "./certificate.validators.js";

export const certificateRoutes = Router();

certificateRoutes.get("/", listCertificates);
certificateRoutes.get("/file/:fileId", validate(fileIdParamsSchema, "params"), getCertificateByFile);
certificateRoutes.get("/:id", validate(certificateIdParamsSchema, "params"), getCertificate);
certificateRoutes.patch("/:id", validate(certificateIdParamsSchema, "params"), updateCertificate);
certificateRoutes.post("/:id/comments", validate(certificateIdParamsSchema, "params"), addCertificateComment);
