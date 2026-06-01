import { env } from "../../config/env.js";
import { parseCertificateDate } from "../../utils/parse-date.js";
import type { ExtractedCertificatePayload } from "@iso-ocr/shared";
import type { OcrResult } from "../ocr/ocr.types.js";

export interface CertificateValidationResult {
  status: ExtractedCertificatePayload["certificate_status"];
  confidenceScore: number;
  validationFlags: string[];
  possibleIssues: string[];
}

const STANDARD_PATTERN =
  /\b(ISO\s*9001|ISO\s*14001|ISO\s*27001|ISO\s*22000|ISO\s*45001|CE\b|GMP\b|HACCP\b)(?::?\s*\d{4})?/i;

const SUSPICIOUS_TEXT_PATTERN =
  /\b(sample|specimen|template|draft|not valid|invalid certificate|for demo|unauthori[sz]ed)\b/i;

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export class CertificateValidationService {
  validate(input: {
    payload: ExtractedCertificatePayload;
    ocr: OcrResult;
    duplicateCertificateId?: string | null;
  }): CertificateValidationResult {
    const flags = new Set<string>();
    const issues = new Set(input.payload.possible_issues);
    const payload = input.payload;
    const now = new Date();
    const issueDate = parseCertificateDate(payload.issue_date);
    const expiryDate = parseCertificateDate(payload.expiry_date);
    const originalDate = parseCertificateDate(payload.original_certification_date);

    const missingCriticalFields = [
      ["certificate_standard", payload.certificate_standard],
      ["certificate_number", payload.certificate_number],
      ["organization_name", payload.organization_name],
      ["certification_body", payload.certification_body],
      ["expiry_date", payload.expiry_date]
    ].filter(([, value]) => !value);

    missingCriticalFields.forEach(([field]) => {
      flags.add(`Missing critical field: ${field}`);
    });

    if (payload.certificate_standard && !STANDARD_PATTERN.test(payload.certificate_standard)) {
      flags.add("Certificate standard does not match supported ISO/compliance patterns");
      issues.add("Unrecognized certificate standard");
    }

    if (input.ocr.confidence !== null && input.ocr.confidence < env.OCR_CONFIDENCE_THRESHOLD) {
      flags.add(`OCR confidence below threshold: ${input.ocr.confidence.toFixed(2)}`);
      issues.add("Low OCR confidence may affect extracted values");
    }

    if (expiryDate && expiryDate < now) {
      flags.add("Certificate expiry date is in the past");
      issues.add("Certificate appears expired");
    }

    if (issueDate && expiryDate && issueDate > expiryDate) {
      flags.add("Issue date is after expiry date");
      issues.add("Date sequence is inconsistent");
    }

    if (originalDate && issueDate && originalDate > issueDate) {
      flags.add("Original certification date is after issue date");
    }

    if (input.duplicateCertificateId) {
      flags.add(`Duplicate certificate number found on certificate ${input.duplicateCertificateId}`);
      issues.add("Duplicate certificate number detected");
    }

    if (SUSPICIOUS_TEXT_PATTERN.test(input.ocr.rawText)) {
      flags.add("OCR text contains suspicious validity terms");
      issues.add("Document contains suspicious validity language");
    }

    if (!payload.accreditation_body) {
      flags.add("Accreditation body is missing");
    }

    let status: ExtractedCertificatePayload["certificate_status"] = payload.certificate_status;
    if (expiryDate && expiryDate < now) {
      status = "expired";
    } else if (
      input.duplicateCertificateId ||
      SUSPICIOUS_TEXT_PATTERN.test(input.ocr.rawText) ||
      flags.has("Issue date is after expiry date")
    ) {
      status = "suspicious";
    } else if (missingCriticalFields.length > 0 || !input.ocr.rawText.trim()) {
      status = "incomplete";
    } else if (input.ocr.confidence !== null && input.ocr.confidence < env.OCR_CONFIDENCE_THRESHOLD) {
      status = "pending_review";
    } else {
      status = "valid";
    }

    const ocrConfidence = input.ocr.confidence ?? 0.5;
    const missingPenalty = Math.min(0.35, missingCriticalFields.length * 0.07);
    const duplicatePenalty = input.duplicateCertificateId ? 0.2 : 0;
    const datePenalty = flags.has("Issue date is after expiry date") ? 0.2 : 0;
    const confidenceScore = clamp(
      Math.min(payload.confidence_score, ocrConfidence) - missingPenalty - duplicatePenalty - datePenalty
    );

    return {
      status,
      confidenceScore,
      validationFlags: [...flags],
      possibleIssues: [...issues]
    };
  }
}

export const certificateValidationService = new CertificateValidationService();
