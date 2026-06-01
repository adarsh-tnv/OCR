export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  s3Bucket: string;
  s3Key: string;
  status: string;
  ocrText: string | null;
  ocrConfidence: number | null;
  pageCount: number | null;
  language: string | null;
  createdAt: string;
  updatedAt: string;
  failureReason?: string | null;
  customExtractions?: PredefinedExtractionResult | null;
  chatMessages?: FileChatMessage[] | null;
  extractedCertificate?: CertificateRecord | null;
}

export interface CertificateRecord {
  id: string;
  uploadedFileId: string;
  documentType: string | null;
  certificateStandard: string | null;
  certificateNumber: string | null;
  organizationName: string | null;
  organizationAddress: string | null;
  scopeOfCertification: string | null;
  certificationBody: string | null;
  accreditationBody: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  originalCertificationDate: string | null;
  surveillanceDates: string[];
  iafCodes: string[];
  eaCodes: string[];
  authorizedSignatory: string | null;
  siteAddresses: string[];
  registrationNumbers: string[];
  qrCodeDetected: boolean;
  sealDetected: boolean;
  logoDetected: boolean;
  certificateStatus: "valid" | "expired" | "suspicious" | "incomplete" | "pending_review" | "unknown";
  confidenceScore: number;
  possibleIssues: string[];
  validationFlags: string[];
  normalizedPayload: Record<string, unknown>;
  rawSummary: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedFile?: UploadedFile;
  extractionHistory?: ExtractionHistory[];
  reviewerComments?: ReviewerComment[];
}

export interface ExtractionHistory {
  id: string;
  action: string;
  before: unknown;
  after: unknown;
  actorName: string | null;
  note: string | null;
  createdAt: string;
}

export interface ReviewerComment {
  id: string;
  authorName: string;
  comment: string;
  createdAt: string;
}

export interface PredefinedField {
  key: string;
  label?: string;
  description?: string;
}

export interface PredefinedExtractionResult {
  fields: Array<{
    key: string;
    label: string | null;
    value: string | number | boolean | null;
    confidence: number;
    evidence: string | null;
  }>;
  summary: string | null;
}

export interface FileChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidence?: string[];
  confidence?: number;
  createdAt: string;
}

export interface FileChatResult {
  messageId: string;
  createdAt: string;
  answer: string;
  evidence: string[];
  confidence: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DashboardStatistics {
  totalUploads: number;
  pendingReview: number;
  processedCertificates: number;
  failedExtractions: number;
  expiringCertificates: number;
  ocrAccuracyRate: number;
}

export interface DashboardCharts {
  uploadTrends: Array<{ date: string; count: number }>;
  certificateTypes: Array<{ type: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
}
