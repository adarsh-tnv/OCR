import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { certificateIdParamsSchema } from "../certificates/certificate.validators.js";
import { exportCertificate } from "./export.controller.js";

export const exportRoutes = Router();

exportRoutes.get("/certificates/:id", validate(certificateIdParamsSchema, "params"), exportCertificate);
