import { env } from "../../config/env.js";
import { notFound } from "../../utils/api-error.js";
import { fileRepository } from "../files/file.repository.js";
import { textractDocumentClient } from "./textract.client.js";
import type { OcrResult } from "./ocr.types.js";

export class OcrService {
  async processUploadedFile(fileId: string): Promise<OcrResult> {
    const file = await fileRepository.findById(fileId);
    if (!file) throw notFound("Uploaded file");

    if (env.OCR_PROVIDER === "mock") {
      return {
        rawText: `Mock OCR text for ${file.originalName}`,
        tables: [],
        formFields: [],
        pageMetadata: [{ pageNumber: 1, width: null, height: null, detectedLanguages: ["en"], tokenCount: 5 }],
        pageCount: 1,
        language: "en",
        confidence: 0.95,
        visualSignals: {
          qrCodeDetected: false,
          sealDetected: false,
          logoDetected: false
        }
      };
    }

    return textractDocumentClient.processDocument({
      bucket: file.s3Bucket,
      key: file.s3Key
    });
  }

  async getOcrResult(fileId: string) {
    const file = await fileRepository.findById(fileId);
    if (!file) throw notFound("Uploaded file");

    return {
      fileId: file.id,
      rawText: file.ocrText,
      confidence: file.ocrConfidence,
      pageCount: file.pageCount,
      language: file.language,
      pageMetadata: file.pageMetadata,
      tables: file.tables,
      formFields: file.formFields,
      status: file.status
    };
  }
}

export const ocrService = new OcrService();
