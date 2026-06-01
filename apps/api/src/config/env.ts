import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: resolve(currentDir, "../../../../.env")
});
dotenv.config();

const numeric = (fallback: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return fallback;
    return Number(value);
  }, z.number());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: numeric(4000),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  API_AUTH_TOKEN: z
    .string()
    .min(24)
    .refine((value) => !value.toLowerCase().includes("replace-"), "API_AUTH_TOKEN must not be a placeholder")
    .optional(),
  MONGO_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
  AWS_S3_SIGNED_URL_TTL_SECONDS: numeric(900),
  OCR_PROVIDER: z.enum(["textract", "mock"]).default("textract"),
  TEXTRACT_FEATURE_TYPES: z.string().default("FORMS,TABLES,SIGNATURES"),
  TEXTRACT_POLL_INTERVAL_MS: numeric(2000),
  TEXTRACT_MAX_POLL_ATTEMPTS: numeric(90),
  AI_PROVIDER: z.enum(["gemini", "mock"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
  GEMINI_MAX_OUTPUT_TOKENS: numeric(4000),
  DEFAULT_EXTRACTION_FIELDS: z.string().optional(),
  MAX_UPLOAD_MB: numeric(25),
  OCR_CONFIDENCE_THRESHOLD: numeric(0.75),
  QUEUE_CONCURRENCY: numeric(3),
  QUEUE_MAX_ATTEMPTS: numeric(3),
  EMAIL_PROVIDER: z.enum(["disabled", "smtp"]).default("disabled"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: numeric(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional()
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === "production" && !value.API_AUTH_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["API_AUTH_TOKEN"],
      message: "API_AUTH_TOKEN is required in production"
    });
  }
});

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === "production";
