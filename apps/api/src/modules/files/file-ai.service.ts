import {
  predefinedExtractionRequestSchema,
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

const extractionResultSchema = z.object({
  fields: z.array(
    z.object({
      key: z.string(),
      label: z.string().nullable().default(null),
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
    const fields = (payload.fields?.length ? payload.fields : this.getDefaultFields()).map(normalizeField);
    const file = await fileRepository.findById(fileId);
    const context = documentContext(file);

    if (env.AI_PROVIDER === "mock") {
      const mockResult: PredefinedExtractionResult = {
        fields: fields.map((field) => ({
          key: field.key,
          label: field.label ?? field.key,
          value: null,
          confidence: 0,
          evidence: "AI_PROVIDER is set to mock"
        })),
        summary: context.rawText.slice(0, 300)
      };
      await fileRepository.updateCustomExtractions(fileId, mockResult as Prisma.InputJsonValue);
      return mockResult;
    }

    const result = extractionResultSchema.parse(
      await geminiService.generateJson<unknown>({
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

Tables:
${JSON.stringify(context.tables, null, 2)}

Form fields:
${JSON.stringify(context.formFields, null, 2)}

Page metadata:
${JSON.stringify(context.pageMetadata, null, 2)}

OCR text:
${context.rawText}`,
        maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS
      })
    );

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
