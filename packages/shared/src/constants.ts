export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const;

export const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".docx"] as const;

export const SUPPORTED_CERTIFICATE_TYPES = [
  "ISO 9001",
  "ISO 14001",
  "ISO 27001",
  "ISO 22000",
  "ISO 45001",
  "CE",
  "GMP",
  "HACCP",
  "Other"
] as const;

export const FILE_STATUSES = [
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "OCR_COMPLETED",
  "EXTRACTED",
  "VALIDATED",
  "NEEDS_REVIEW",
  "FAILED",
  "DELETED"
] as const;

export const CERTIFICATE_STATUSES = [
  "valid",
  "expired",
  "suspicious",
  "incomplete",
  "pending_review",
  "unknown"
] as const;

export const DOCUMENT_CATEGORIES = [
  "iso_certificate",
  "company_registration"
] as const;
