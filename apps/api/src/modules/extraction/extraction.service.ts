import {
  DEFAULT_EXTRACTION_PROFILES,
  extractedCertificateSchema,
  type ExtractedCertificatePayload,
  type ExtractionProfile
} from "@iso-ocr/shared";
import { z } from "zod";
import { env } from "../../config/env.js";
import { geminiService } from "../ai/gemini.service.js";
import type { OcrResult } from "../ocr/ocr.types.js";
import { extractionJsonSchema } from "./extraction.schema.js";
import { ISO_CERTIFICATE_EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from "./prompts.js";

const extractedProfileFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  mandatory: z.boolean().default(false),
  present: z.boolean().default(false),
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  confidence: z.number().min(0).max(1).default(0),
  evidence: z.string().nullable().default(null)
});

const extractedCheckpointSchema = z.object({
  key: z.string(),
  label: z.string(),
  mandatory: z.boolean().default(false),
  passed: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0),
  reason: z.string().nullable().default(null)
});

export const profileExtractionResultSchema = z.object({
  documentCategory: z.string(),
  summary: z.string().nullable().default(null),
  overallConfidence: z.number().min(0).max(1).default(0),
  fields: z.array(extractedProfileFieldSchema),
  checkpoints: z.array(extractedCheckpointSchema).default([]),
  missingMandatoryFields: z.array(z.string()).default([]),
  possibleIssues: z.array(z.string()).default([])
});

export type ProfileExtractionResult = z.infer<typeof profileExtractionResultSchema>;

const profileValue = (result: ProfileExtractionResult, key: string) => {
  const value = result.fields.find((field) => field.key === key)?.value;
  if (value === null || value === undefined || value === "") return null;
  return String(value);
};

const uniqueValues = (...values: Array<string | null>) => {
  const seen = new Set<string>();
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      const normalized = value.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

const fieldPresent = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== "";

const normalizeProfileResult = (
  profile: ExtractionProfile,
  rawResult: unknown,
  fallbackConfidence: number | null
): ProfileExtractionResult => {
  const parsed = profileExtractionResultSchema.parse(rawResult);
  const returnedByKey = new Map(parsed.fields.map((field) => [field.key, field]));
  const fields = profile.fields.map((profileField) => {
    const returned = returnedByKey.get(profileField.key);
    const value = returned?.value ?? null;
    return {
      key: profileField.key,
      label: profileField.label,
      mandatory: profileField.mandatory,
      present: returned?.present ?? fieldPresent(value),
      value,
      confidence: returned?.confidence ?? 0,
      evidence: returned?.evidence ?? null
    };
  });

  const checkpointByKey = new Map(parsed.checkpoints.map((checkpoint) => [checkpoint.key, checkpoint]));
  const checkpoints = profile.checkpoints.map((checkpoint) => {
    const returned = checkpointByKey.get(checkpoint.key);
    return {
      key: checkpoint.key,
      label: checkpoint.label,
      mandatory: checkpoint.mandatory,
      passed: returned?.passed ?? false,
      confidence: returned?.confidence ?? 0,
      reason: returned?.reason ?? null
    };
  });

  const missingMandatoryFields = fields
    .filter((field) => field.mandatory && !field.present)
    .map((field) => field.key);

  const failedMandatoryCheckpoints = checkpoints
    .filter((checkpoint) => checkpoint.mandatory && !checkpoint.passed)
    .map((checkpoint) => checkpoint.key);

  return {
    documentCategory: profile.category,
    summary: parsed.summary,
    overallConfidence: parsed.overallConfidence || fallbackConfidence || 0,
    fields,
    checkpoints,
    missingMandatoryFields,
    possibleIssues: [
      ...parsed.possibleIssues,
      ...missingMandatoryFields.map((field) => `Missing mandatory field: ${field}`),
      ...failedMandatoryCheckpoints.map((checkpoint) => `Failed mandatory checkpoint: ${checkpoint}`)
    ]
  };
};

export class ExtractionService {
  async extractWithProfile(ocr: OcrResult, profile: ExtractionProfile): Promise<ProfileExtractionResult> {
    if (env.AI_PROVIDER === "mock") {
      return normalizeProfileResult(
        profile,
        {
          documentCategory: profile.category,
          summary: ocr.rawText.slice(0, 300),
          overallConfidence: ocr.confidence ?? 0,
          fields: profile.fields.map((field) => ({
            key: field.key,
            label: field.label,
            mandatory: field.mandatory,
            present: false,
            value: null,
            confidence: 0,
            evidence: "AI_PROVIDER is set to mock"
          })),
          checkpoints: profile.checkpoints.map((checkpoint) => ({
            key: checkpoint.key,
            label: checkpoint.label,
            mandatory: checkpoint.mandatory,
            passed: false,
            confidence: 0,
            reason: "AI_PROVIDER is set to mock"
          })),
          possibleIssues: ["AI_PROVIDER is set to mock"]
        },
        ocr.confidence
      );
    }

    const payload = await geminiService.generateJson<unknown>({
      systemInstruction:
        "You extract document details from OCR using a configured profile. Use only the provided OCR text, tables, and form fields. Do not guess. Return JSON only.",
      prompt: `Document category:
${profile.category}

Extraction profile:
${JSON.stringify(profile, null, 2)}

Return this exact JSON shape:
{
  "documentCategory": "${profile.category}",
  "summary": "one sentence summary or null",
  "overallConfidence": 0.0,
  "fields": [
    {
      "key": "profile field key",
      "label": "profile field label",
      "mandatory": true,
      "present": true,
      "value": "extracted value or null",
      "confidence": 0.0,
      "evidence": "short supporting OCR span or null"
    }
  ],
  "checkpoints": [
    {
      "key": "profile checkpoint key",
      "label": "profile checkpoint label",
      "mandatory": true,
      "passed": true,
      "confidence": 0.0,
      "reason": "short reason or null"
    }
  ],
  "missingMandatoryFields": [],
  "possibleIssues": []
}

Rules:
1. Return one field entry for every configured profile field, using the same key.
2. Return one checkpoint entry for every configured checkpoint, using the same key.
3. Set present=false and value=null when the value is not directly supported by OCR.
4. Mandatory means required for review, not permission to invent a value.
5. Keep dates exactly as written unless OCR has an unambiguous normalized date.
6. For donor_certification_body_* fields, use the certification body/company that issued the certificate, not the certified entity.
7. For donor_certification_body_email, use the issuer certification body's email.
8. For original_registration_date, extract the date when the certificate was first issued or first registered. It may be titled Original Issue Date, Original Certification Date, First Issue Date, Initial Registration Date, Initial Certification Date, or similar. If only an initial registration/certification/issue date is printed, use that date for original_registration_date.
9. For expiry_date, use the certificate validity end date. It may be titled Validity of this Certificate, Valid until, Valid to, Recertification due date, or similar. Do semantic matching, not only exact label matching.
10. For first_surveillance_date and second_surveillance_date, return each surveillance date that is printed. If only one surveillance date exists, return only that field as present.
11. For certification_site_address, use the certified site/location address. If no separate site address is printed, use the certified entity address.

OCR context:
${buildExtractionUserPrompt({
  rawText: ocr.rawText,
  tables: ocr.tables,
  formFields: ocr.formFields,
  pageMetadata: ocr.pageMetadata,
  ocrConfidence: ocr.confidence,
  visualSignals: ocr.visualSignals
})}`,
      maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS
    });

    return normalizeProfileResult(profile, payload, ocr.confidence);
  }

  toIsoCertificatePayload(result: ProfileExtractionResult, ocr: OcrResult): ExtractedCertificatePayload {
    return extractedCertificateSchema.parse({
      document_type: "ISO Certificate",
      certificate_standard: profileValue(result, "standard_name"),
      certificate_number: profileValue(result, "certificate_number"),
      organization_name: profileValue(result, "certified_entity_name"),
      organization_address: profileValue(result, "donor_certification_body_address"),
      scope_of_certification: profileValue(result, "scope_of_certificate"),
      certification_body: profileValue(result, "donor_certification_body_name"),
      accreditation_body: null,
      issue_date: profileValue(result, "current_issue_date"),
      expiry_date: profileValue(result, "expiry_date"),
      original_certification_date:
        profileValue(result, "original_registration_date") ?? profileValue(result, "initial_registration_date"),
      surveillance_dates: uniqueValues(
        profileValue(result, "first_surveillance_date"),
        profileValue(result, "second_surveillance_date")
      ),
      iaf_codes: [],
      ea_codes: [],
      authorized_signatory: null,
      site_addresses: uniqueValues(
        profileValue(result, "certification_site_address"),
        profileValue(result, "certified_entity_address")
      ),
      registration_numbers: [profileValue(result, "certificate_number")].filter((value): value is string => Boolean(value)),
      qr_code_detected: ocr.visualSignals.qrCodeDetected,
      seal_detected: ocr.visualSignals.sealDetected,
      logo_detected: ocr.visualSignals.logoDetected,
      certificate_status: result.missingMandatoryFields.length ? "incomplete" : "unknown",
      confidence_score: result.overallConfidence || ocr.confidence || 0,
      possible_issues: result.possibleIssues,
      raw_summary: result.summary
    });
  }

  async extract(ocr: OcrResult): Promise<ExtractedCertificatePayload> {
    if (env.AI_PROVIDER === "mock") {
      return extractedCertificateSchema.parse({
        document_type: "ISO Certificate",
        certificate_standard: null,
        certificate_number: null,
        organization_name: null,
        organization_address: null,
        scope_of_certification: null,
        certification_body: null,
        accreditation_body: null,
        issue_date: null,
        expiry_date: null,
        original_certification_date: null,
        surveillance_dates: [],
        iaf_codes: [],
        ea_codes: [],
        authorized_signatory: null,
        site_addresses: [],
        registration_numbers: [],
        qr_code_detected: ocr.visualSignals.qrCodeDetected,
        seal_detected: ocr.visualSignals.sealDetected,
        logo_detected: ocr.visualSignals.logoDetected,
        certificate_status: "incomplete",
        confidence_score: ocr.confidence ?? 0,
        possible_issues: ["AI_PROVIDER is set to mock"],
        raw_summary: ocr.rawText.slice(0, 300)
      });
    }

    const profile = DEFAULT_EXTRACTION_PROFILES.find((item) => item.category === "iso_certificate");
    if (profile) {
      const result = await this.extractWithProfile(ocr, profile);
      return this.toIsoCertificatePayload(result, ocr);
    }

    const payload = await geminiService.generateJson<unknown>({
      systemInstruction: ISO_CERTIFICATE_EXTRACTION_SYSTEM_PROMPT,
      prompt: `${buildExtractionUserPrompt({
        rawText: ocr.rawText,
        tables: ocr.tables,
        formFields: ocr.formFields,
        pageMetadata: ocr.pageMetadata,
        ocrConfidence: ocr.confidence,
        visualSignals: ocr.visualSignals
      })}

Return JSON only. It must conform to this JSON Schema:
${JSON.stringify(extractionJsonSchema)}`,
      maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS
    });

    return extractedCertificateSchema.parse(payload);
  }
}

export const extractionService = new ExtractionService();
