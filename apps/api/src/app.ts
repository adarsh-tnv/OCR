import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import hpp from "hpp";
import { pinoHttp } from "pino-http";
import { env, isProduction } from "./config/env.js";
import { logger } from "./config/logger.js";
import { apiAuthEnabled, requireApiAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestSanitizer } from "./middleware/request-sanitizer.js";
import { certificateRoutes } from "./modules/certificates/certificate.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { exportRoutes } from "./modules/exports/export.routes.js";
import { extractionProfileRoutes } from "./modules/extraction-profiles/extraction-profile.routes.js";
import { fileRoutes } from "./modules/files/file.routes.js";
import { ocrRoutes } from "./modules/ocr/ocr.routes.js";
import { reviewRoutes } from "./modules/review/review.routes.js";

const corsOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());

export const createApp = () => {
  const app = express();

  app.set("trust proxy", isProduction ? 1 : 0);
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true
    })
  );
  app.use(compression());
  app.use(hpp());
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(requestSanitizer);
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req: { url?: string }) => req.url === "/health"
      }
    })
  );

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "iso-certificate-ocr-api",
      authRequired: apiAuthEnabled,
      timestamp: new Date().toISOString()
    });
  });

  app.use(requireApiAuth);

  app.use("/api/files", fileRoutes);
  app.use("/api/ocr", ocrRoutes);
  app.use("/api/certificates", certificateRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/extraction-profiles", extractionProfileRoutes);
  app.use("/api/review", reviewRoutes);
  app.use("/api/exports", exportRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
