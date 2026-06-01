import { z } from "zod";
import {
  ACCEPTED_MIME_TYPES,
  CERTIFICATE_STATUSES,
  FILE_STATUSES,
  SUPPORTED_CERTIFICATE_TYPES
} from "./constants.js";

export const certificateStatusSchema = z.enum(CERTIFICATE_STATUSES);
export const fileStatusSchema = z.enum(FILE_STATUSES);
export const supportedCertificateTypeSchema = z.enum(SUPPORTED_CERTIFICATE_TYPES);

const nullableString = z.string().trim().min(1).nullable();

export const extractedCertificateSchema = z.object({
  document_type: nullableString,
  certificate_standard: nullableString,
  certificate_number: nullableString,
  organization_name: nullableString,
  organization_address: nullableString,
  scope_of_certification: nullableString,
  certification_body: nullableString,
  accreditation_body: nullableString,
  issue_date: nullableString,
  expiry_date: nullableString,
  original_certification_date: nullableString,
  surveillance_dates: z.array(z.string()).default([]),
  iaf_codes: z.array(z.string()).default([]),
  ea_codes: z.array(z.string()).default([]),
  authorized_signatory: nullableString,
  site_addresses: z.array(z.string()).default([]),
  registration_numbers: z.array(z.string()).default([]),
  qr_code_detected: z.boolean().default(false),
  seal_detected: z.boolean().default(false),
  logo_detected: z.boolean().default(false),
  certificate_status: certificateStatusSchema.default("unknown"),
  confidence_score: z.number().min(0).max(1).default(0),
  possible_issues: z.array(z.string()).default([]),
  raw_summary: z.string().nullable().default(null)
});

export type ExtractedCertificatePayload = z.infer<typeof extractedCertificateSchema>;

export const updateCertificateSchema = extractedCertificateSchema.partial().extend({
  reviewer_comment: z.string().trim().max(4000).optional()
});

export type UpdateCertificatePayload = z.infer<typeof updateCertificateSchema>;

export const fileUploadConstraintsSchema = z.object({
  maxFileSizeMb: z.number().int().positive(),
  mimeTypes: z.array(z.enum(["application/pdf", "image/png", "image/jpeg", "image/jpg"]))
});

export const certificateSearchSchema = z.object({
  query: z.string().optional(),
  certificateNumber: z.string().optional(),
  organizationName: z.string().optional(),
  certificateStandard: z.string().optional(),
  certificationBody: z.string().optional(),
  status: certificateStatusSchema.optional(),
  expiryFrom: z.string().optional(),
  expiryTo: z.string().optional(),
  confidenceMin: z.coerce.number().min(0).max(1).optional(),
  confidenceMax: z.coerce.number().min(0).max(1).optional(),
  uploadedFrom: z.string().optional(),
  uploadedTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export type CertificateSearchParams = z.infer<typeof certificateSearchSchema>;

export const reviewerCommentSchema = z.object({
  authorName: z.string().trim().min(1).max(120).default("Reviewer"),
  comment: z.string().trim().min(1).max(4000)
});

export type ReviewerCommentPayload = z.infer<typeof reviewerCommentSchema>;

export const predefinedFieldSchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_.-]+$/),
  label: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).optional()
});

export const predefinedExtractionRequestSchema = z.object({
  fields: z.array(z.union([z.string().trim().min(1), predefinedFieldSchema])).min(1).max(50).optional()
});

export type PredefinedField = z.infer<typeof predefinedFieldSchema>;
export type PredefinedExtractionRequest = z.infer<typeof predefinedExtractionRequestSchema>;

export const fileChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000)
});

export type FileChatRequest = z.infer<typeof fileChatRequestSchema>;

export const signedPreviewSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string()
});

export type SignedPreview = z.infer<typeof signedPreviewSchema>;
