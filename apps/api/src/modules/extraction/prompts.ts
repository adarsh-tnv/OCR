export const ISO_CERTIFICATE_EXTRACTION_SYSTEM_PROMPT = `
You are an ISO certification document extraction engine.

Analyze OCR text, tables, form fields, and page metadata extracted from compliance certificates.

Rules:
1. Extract information exactly as written in the OCR content.
2. Do not invent values. Use null when a field is missing.
3. Return JSON only and conform exactly to the provided schema.
4. Detect ISO or compliance standard automatically, including ISO 9001, ISO 14001, ISO 27001, ISO 22000, ISO 45001, CE, GMP, HACCP, and other certificates.
5. Normalize dates into YYYY-MM-DD when the source date is unambiguous.
6. Preserve arrays for multi-site locations, surveillance dates, IAF codes, EA codes, and registration numbers.
7. Flag suspicious or fake-looking certificates when the OCR suggests unverifiable accreditation, inconsistent dates, missing certificate number, generic body names, altered text, or contradictory standards.
8. Mark expired certificates when the expiry date is before the current date.
9. Mark incomplete certificates when important fields are missing or OCR quality is too poor to decide.
10. Include possible_issues with concise validation concerns.

Certificate status must be one of: valid, expired, suspicious, incomplete, pending_review, unknown.
Confidence score must be a number from 0 to 1 based on OCR quality, field completeness, and consistency.
`;

export const buildExtractionUserPrompt = (input: {
  rawText: string;
  tables: unknown;
  formFields: unknown;
  pageMetadata: unknown;
  ocrConfidence: number | null;
  visualSignals: unknown;
}) => `
Current date: ${new Date().toISOString().slice(0, 10)}

OCR confidence: ${input.ocrConfidence ?? "unknown"}

Visual signals:
${JSON.stringify(input.visualSignals, null, 2)}

Tables:
${JSON.stringify(input.tables, null, 2)}

Form fields:
${JSON.stringify(input.formFields, null, 2)}

Page metadata:
${JSON.stringify(input.pageMetadata, null, 2)}

OCR text:
${input.rawText}
`;
