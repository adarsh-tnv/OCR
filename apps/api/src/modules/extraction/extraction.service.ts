import { extractedCertificateSchema, type ExtractedCertificatePayload } from "@iso-ocr/shared";
import { env } from "../../config/env.js";
import { geminiService } from "../ai/gemini.service.js";
import type { OcrResult } from "../ocr/ocr.types.js";
import { extractionJsonSchema } from "./extraction.schema.js";
import { ISO_CERTIFICATE_EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from "./prompts.js";

export class ExtractionService {
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
