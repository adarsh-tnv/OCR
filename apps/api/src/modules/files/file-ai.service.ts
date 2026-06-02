import {
  DEFAULT_EXTRACTION_PROFILES,
  extractionProfileSchema,
  predefinedExtractionRequestSchema,
  type ExtractionProfile,
  type PredefinedField,
  type PredefinedExtractionRequest
} from "@iso-ocr/shared";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { badRequest, notFound } from "../../utils/api-error.js";
import { geminiService } from "../ai/gemini.service.js";
import { fileRepository } from "./file.repository.js";

const fallbackFields: PredefinedField[] = [
  { key: "document_title", label: "Document title", description: "Main title or document name" },
  { key: "issuer", label: "Issuer", description: "Company, authority, or person that issued the document" },
  { key: "document_date", label: "Document date", description: "Primary issue, invoice, certificate, or letter date" },
  { key: "reference_number", label: "Reference number", description: "Certificate, invoice, policy, order, or document number" },
  { key: "organization_name", label: "Organization name", description: "Primary organization or recipient named in the document" }
];

const defaultExtractionProfiles: ExtractionProfile[] = DEFAULT_EXTRACTION_PROFILES.map((profile) =>
  extractionProfileSchema.parse(profile)
);

const extractionResultSchema = z.object({
  fields: z.array(
    z.object({
      key: z.string(),
      label: z.string().nullable().default(null),
      mandatory: z.boolean().optional(),
      present: z.boolean().optional(),
      value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
      confidence: z.number().min(0).max(1).default(0),
      evidence: z.string().nullable().default(null)
    })
  ),
  summary: z.string().nullable().default(null)
});

const chatResultSchema = z.object({
  answer: z.string(),
  evidence: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0)
});

export type PredefinedExtractionResult = z.infer<typeof extractionResultSchema>;
export type FileChatResult = z.infer<typeof chatResultSchema> & {
  messageId: string;
  createdAt: string;
};

const slugKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "field";

const normalizeField = (field: string | PredefinedField): PredefinedField => {
  if (typeof field !== "string") return field;
  const [labelPart, ...descriptionParts] = field.split(":");
  const label = labelPart?.trim() || field.trim();
  const description = descriptionParts.join(":").trim();
  return {
    key: slugKey(label),
    label,
    ...(description ? { description } : {})
  };
};

type PromptField = PredefinedField & {
  aliases?: string[];
  mandatory?: boolean;
};

type ReturnedField = PredefinedExtractionResult["fields"][number];

const normalizeMatchText = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const hasFieldValue = (value: ReturnedField["value"] | undefined) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const enrichField = (
  field: PredefinedField,
  file: Awaited<ReturnType<typeof fileRepository.findById>>
): PromptField => {
  const parsedProfile = extractionProfileSchema.safeParse(file?.extractionProfile);
  const fileProfile = parsedProfile.success ? parsedProfile.data : null;
  const defaultProfile = defaultExtractionProfiles.find(
    (profile) => profile.category === (fileProfile?.category ?? file?.documentCategory)
  );
  const fileProfileField = fileProfile?.fields.find((item) => item.key === field.key);
  const defaultProfileField = defaultProfile?.fields.find((item) => item.key === field.key);
  const description = field.description ?? fileProfileField?.description ?? defaultProfileField?.description;
  const aliases = unique([...(fileProfileField?.aliases ?? []), ...(defaultProfileField?.aliases ?? [])]);
  const mandatory = fileProfileField?.mandatory ?? defaultProfileField?.mandatory;

  return {
    key: field.key,
    label: field.label ?? fileProfileField?.label ?? defaultProfileField?.label ?? field.key,
    ...(description ? { description } : {}),
    ...(aliases.length ? { aliases } : {}),
    ...(mandatory !== undefined ? { mandatory } : {})
  };
};

const findReturnedField = (requested: PromptField, returnedFields: ReturnedField[]) => {
  const exact = returnedFields.find((field) => field.key === requested.key);
  if (exact && hasFieldValue(exact.value)) return exact;

  const matchKeys = new Set([
    normalizeMatchText(requested.key),
    normalizeMatchText(requested.label),
    ...(requested.aliases ?? []).map(normalizeMatchText)
  ]);

  const aliasMatch = returnedFields.find((field) => {
    const returnedKey = normalizeMatchText(field.key);
    const returnedLabel = normalizeMatchText(field.label);
    return hasFieldValue(field.value) && (matchKeys.has(returnedKey) || matchKeys.has(returnedLabel));
  });

  return aliasMatch ?? exact ?? null;
};

const normalizeExtractionResult = (
  requestedFields: PromptField[],
  rawResult: unknown
): PredefinedExtractionResult => {
  const parsed = extractionResultSchema.parse(rawResult);

  return {
    fields: requestedFields.map((field) => {
      const returned = findReturnedField(field, parsed.fields);
      const value = returned?.value ?? null;

      return {
        key: field.key,
        label: field.label ?? field.key,
        ...(field.mandatory !== undefined ? { mandatory: field.mandatory } : {}),
        present: returned?.present ?? hasFieldValue(value),
        value,
        confidence: returned?.confidence ?? 0,
        evidence: returned?.evidence ?? null
      };
    }),
    summary: parsed.summary
  };
};

const parseDefaultFields = () => {
  if (!env.DEFAULT_EXTRACTION_FIELDS?.trim()) return fallbackFields;

  const raw = env.DEFAULT_EXTRACTION_FIELDS.trim();
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = predefinedExtractionRequestSchema.parse(Array.isArray(parsed) ? { fields: parsed } : parsed);
    return (result.fields ?? fallbackFields).map(normalizeField);
  } catch {
    const fields = raw
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(normalizeField);
    return fields.length ? fields : fallbackFields;
  }
};

const asArray = (value: unknown) => (Array.isArray(value) ? value : []);

const documentContext = (file: Awaited<ReturnType<typeof fileRepository.findById>>) => {
  if (!file) throw notFound("Uploaded file");
  if (!file.ocrText?.trim()) {
    throw badRequest("OCR text is not available for this file yet");
  }

  return {
    rawText: file.ocrText,
    tables: asArray(file.tables),
    formFields: asArray(file.formFields),
    pageMetadata: asArray(file.pageMetadata),
    extractedCertificate: file.extractedCertificate
  };
};

export class FileAiService {
  getDefaultFields() {
    return parseDefaultFields();
  }

  async extractPredefinedFields(fileId: string, rawPayload: unknown) {
    const payload = predefinedExtractionRequestSchema.parse(rawPayload);
    const file = await fileRepository.findById(fileId);
    const context = documentContext(file);
    const fields = (payload.fields?.length ? payload.fields : this.getDefaultFields())
      .map(normalizeField)
      .map((field) => enrichField(field, file));

    if (env.AI_PROVIDER === "mock") {
      const mockResult: PredefinedExtractionResult = {
        fields: fields.map((field) => ({
          key: field.key,
          label: field.label ?? field.key,
          ...(field.mandatory !== undefined ? { mandatory: field.mandatory } : {}),
          present: false,
          value: null,
          confidence: 0,
          evidence: "AI_PROVIDER is set to mock"
        })),
        summary: context.rawText.slice(0, 300)
      };
      await fileRepository.updateCustomExtractions(fileId, mockResult as Prisma.InputJsonValue);
      return mockResult;
    }

    const rawResult = await geminiService.generateJson<unknown>({
      systemInstruction:
        "You extract user-requested fields from OCR text. Use only the provided document content. Do not guess. Return JSON only.",
      prompt: `Requested fields:
${JSON.stringify(fields, null, 2)}

Return this exact JSON shape:
{
  "fields": [
    {
      "key": "requested key",
      "label": "requested label or key",
      "value": "extracted value or null",
      "confidence": 0.0,
      "evidence": "short text span that supports the value or null"
    }
  ],
  "summary": "one sentence document summary or null"
}

Rules:
1. Return exactly one field entry for each requested field.
2. Use the requested key exactly. Do not create new keys and do not rename keys.
3. For donor_certification_body_* fields, use the certification body/company that issued the certificate, not the certified entity.
4. For donor_certification_body_email, use the issuer certification body's email.
5. For original_registration_date, extract the date when the certificate was first issued or first registered. The certificate may title it Original Issue Date, Original Certification Date, First Issue Date, Initial Registration Date, Initial Certification Date, or similar. If only an initial registration/certification/issue date is printed, use that date for original_registration_date.
6. For expiry_date, use the certificate validity end date. It may be titled Validity of this Certificate, Valid until, Valid to, Recertification due date, or similar. Do semantic matching, not only exact label matching.
7. For first_surveillance_date and second_surveillance_date, return each surveillance date that is printed. If only one surveillance date exists, return only that field as present.
8. For certification_site_address, use the certified site/location address. If no separate site address is printed, use the certified entity address.
9. If a value is not directly supported by the OCR, return value=null.

Tables:
${JSON.stringify(context.tables, null, 2)}

Form fields:
${JSON.stringify(context.formFields, null, 2)}

Page metadata:
${JSON.stringify(context.pageMetadata, null, 2)}

OCR text:
${context.rawText}`,
      maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS
    });
    const result = normalizeExtractionResult(fields, rawResult);

    await fileRepository.updateCustomExtractions(fileId, result as Prisma.InputJsonValue);
    const history: Parameters<typeof fileRepository.createHistory>[0] = {
      uploadedFileId: fileId,
      action: "UPDATED",
      note: "Predefined file fields extracted",
      after: result as Prisma.InputJsonValue
    };
    if (context.extractedCertificate?.id) history.certificateId = context.extractedCertificate.id;
    await fileRepository.createHistory(history);

    return result;
  }

  async chat(fileId: string, message: string): Promise<FileChatResult> {
    const file = await fileRepository.findById(fileId);
    const context = documentContext(file);

    if (env.AI_PROVIDER === "mock") {
      const result: FileChatResult = {
        messageId: randomUUID(),
        createdAt: new Date().toISOString(),
        answer: "AI_PROVIDER is set to mock, so no document answer was generated.",
        evidence: [],
        confidence: 0
      };
      await this.persistChat(fileId, file?.chatMessages, message, result);
      return result;
    }

    const answer = chatResultSchema.parse(
      await geminiService.generateJson<unknown>({
        systemInstruction:
          "You answer questions using only the provided OCR document content. If the answer is not present, say that the document does not contain enough information.",
        prompt: `Question:
${message}

Return this exact JSON shape:
{
  "answer": "direct answer grounded in the document",
  "evidence": ["short supporting OCR snippets"],
  "confidence": 0.0
}

Extracted certificate record, if available:
${JSON.stringify(context.extractedCertificate, null, 2)}

Tables:
${JSON.stringify(context.tables, null, 2)}

Form fields:
${JSON.stringify(context.formFields, null, 2)}

OCR text:
${context.rawText}`,
        maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS
      })
    );

    const result: FileChatResult = {
      ...answer,
      messageId: randomUUID(),
      createdAt: new Date().toISOString()
    };
    await this.persistChat(fileId, file?.chatMessages, message, result);
    return result;
  }

  private async persistChat(
    fileId: string,
    existingMessages: unknown,
    userMessage: string,
    assistantMessage: FileChatResult
  ) {
    const messages = asArray(existingMessages).slice(-40);
    messages.push(
      {
        id: randomUUID(),
        role: "user",
        content: userMessage,
        createdAt: new Date().toISOString()
      },
      {
        id: assistantMessage.messageId,
        role: "assistant",
        content: assistantMessage.answer,
        evidence: assistantMessage.evidence,
        confidence: assistantMessage.confidence,
        createdAt: assistantMessage.createdAt
      }
    );
    await fileRepository.updateChatMessages(fileId, messages as Prisma.InputJsonValue);
  }
}

export const fileAiService = new FileAiService();
