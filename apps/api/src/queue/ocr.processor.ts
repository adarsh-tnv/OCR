import type { Job } from "bullmq";
import type { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { fileRepository } from "../modules/files/file.repository.js";
import { extractionService } from "../modules/extraction/extraction.service.js";
import { extractionProfileService } from "../modules/extraction-profiles/extraction-profile.service.js";
import { ocrService } from "../modules/ocr/ocr.service.js";
import { certificateService } from "../modules/certificates/certificate.service.js";
import type { OcrJobPayload } from "./queues.js";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown processing error";

export const processOcrJob = async (job: Job<OcrJobPayload>) => {
  const { fileId, processingJobId } = job.data;
  logger.info({ fileId, jobId: job.id }, "Starting OCR extraction job");

  await fileRepository.updateProcessingJob(processingJobId, {
    status: "ACTIVE",
    attempts: job.attemptsMade + 1,
    startedAt: new Date()
  });

  await fileRepository.updateStatus(fileId, "PROCESSING", {
    processingStartedAt: new Date(),
    failureReason: null
  });

  try {
    await job.updateProgress(20);
    const ocr = await ocrService.processUploadedFile(fileId);

    await fileRepository.updateOcrResult(fileId, {
      status: "OCR_COMPLETED",
      ocrText: ocr.rawText,
      ocrConfidence: ocr.confidence,
      pageCount: ocr.pageCount,
      language: ocr.language,
      pageMetadata: ocr.pageMetadata as unknown as Prisma.InputJsonValue,
      tables: ocr.tables as unknown as Prisma.InputJsonValue,
      formFields: ocr.formFields as unknown as Prisma.InputJsonValue
    });

    await fileRepository.createHistory({
      uploadedFileId: fileId,
      action: "OCR_COMPLETED",
      after: {
        confidence: ocr.confidence,
        pageCount: ocr.pageCount,
        language: ocr.language
      }
    });

    const file = await fileRepository.findById(fileId);
    const documentCategory = file?.documentCategory ?? "iso_certificate";
    const profile = await extractionProfileService.get(documentCategory);

    await job.updateProgress(60);
    const profileExtraction = await extractionService.extractWithProfile(ocr, profile);

    await fileRepository.updateCustomExtractions(fileId, profileExtraction as unknown as Prisma.InputJsonValue);

    await fileRepository.createHistory({
      uploadedFileId: fileId,
      action: "EXTRACTION_COMPLETED",
      after: profileExtraction as unknown as Prisma.InputJsonValue
    });

    if (documentCategory !== "iso_certificate") {
      const hasMissingMandatory =
        profileExtraction.missingMandatoryFields.length > 0 ||
        profileExtraction.checkpoints.some((checkpoint) => checkpoint.mandatory && !checkpoint.passed);

      await fileRepository.updateProcessingJob(processingJobId, {
        status: "COMPLETED",
        completedAt: new Date(),
        metadata: {
          documentCategory,
          missingMandatoryFields: profileExtraction.missingMandatoryFields
        }
      });

      await fileRepository.updateStatus(fileId, hasMissingMandatory ? "NEEDS_REVIEW" : "VALIDATED", {
        processingEndedAt: new Date()
      });

      await job.updateProgress(100);
      logger.info({ fileId, jobId: job.id, documentCategory }, "OCR profile extraction job completed");

      return {
        fileId,
        documentCategory,
        status: hasMissingMandatory ? "NEEDS_REVIEW" : "VALIDATED"
      };
    }

    const extractedPayload = extractionService.toIsoCertificatePayload(profileExtraction, ocr);
    await job.updateProgress(85);
    const certificate = await certificateService.persistExtraction(fileId, extractedPayload, ocr);

    await fileRepository.updateProcessingJob(processingJobId, {
      status: "COMPLETED",
      completedAt: new Date(),
      metadata: {
        certificateId: certificate.id,
        certificateStatus: certificate.certificateStatus,
        documentCategory
      }
    });

    await job.updateProgress(100);
    logger.info({ fileId, jobId: job.id, certificateId: certificate.id }, "OCR extraction job completed");

    return {
      fileId,
      certificateId: certificate.id,
      status: certificate.certificateStatus
    };
  } catch (error) {
    const message = errorMessage(error);
    const willRetry = job.attemptsMade + 1 < env.QUEUE_MAX_ATTEMPTS;

    await fileRepository.updateProcessingJob(processingJobId, {
      status: willRetry ? "RETRYING" : "FAILED",
      attempts: job.attemptsMade + 1,
      lastError: message,
      completedAt: willRetry ? null : new Date()
    });

    await fileRepository.updateStatus(fileId, willRetry ? "QUEUED" : "FAILED", {
      failureReason: message,
      processingEndedAt: willRetry ? null : new Date()
    });

    await fileRepository.createHistory({
      uploadedFileId: fileId,
      action: "FAILED",
      note: message
    });

    logger.error({ fileId, jobId: job.id, error, message }, "OCR extraction job failed");
    throw error;
  }
};
