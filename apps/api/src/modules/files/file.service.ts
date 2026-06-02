import type { FileStatus, Prisma } from "@prisma/client";
import type { DocumentCategory } from "@iso-ocr/shared";
import crypto from "node:crypto";
import type { z } from "zod";
import { env } from "../../config/env.js";
import { ocrQueue } from "../../queue/queues.js";
import { s3StorageService } from "../../storage/s3.service.js";
import { badRequest, notFound } from "../../utils/api-error.js";
import { extractionProfileService } from "../extraction-profiles/extraction-profile.service.js";
import { fileRepository } from "./file.repository.js";
import { listFilesQuerySchema, validateUploadedFile } from "./file.validators.js";

type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;

export class FileService {
  async upload(files: Express.Multer.File[], options: { documentCategory?: DocumentCategory } = {}) {
    if (!files.length) {
      throw badRequest("At least one file is required");
    }

    const documentCategory = extractionProfileService.normalizeCategory(options.documentCategory);
    const extractionProfile = await extractionProfileService.get(documentCategory);
    const results = [];

    for (const file of files) {
      validateUploadedFile(file);
      const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
      const stored = await s3StorageService.uploadCertificate(file);
      const uploadedFile = await fileRepository.createUploadedFile({
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        checksum,
        s3Bucket: stored.bucket,
        s3Key: stored.key,
        documentCategory,
        extractionProfile: extractionProfile as unknown as Prisma.InputJsonValue,
        status: "UPLOADED",
        deletedAt: null
      });

      await fileRepository.createHistory({
        uploadedFileId: uploadedFile.id,
        action: "CREATED",
        after: {
          originalName: uploadedFile.originalName,
          mimeType: uploadedFile.mimeType,
          sizeBytes: uploadedFile.sizeBytes.toString(),
          documentCategory
        }
      });

      const processingJob = await fileRepository.createProcessingJob({
        uploadedFileId: uploadedFile.id,
        jobType: "OCR_EXTRACTION",
        maxAttempts: env.QUEUE_MAX_ATTEMPTS,
        metadata: { source: "upload" }
      });

      const queueJob = await ocrQueue.add("ocr-extraction", {
        fileId: uploadedFile.id,
        processingJobId: processingJob.id
      });
      const queueJobId = queueJob.id ?? processingJob.id;

      await fileRepository.updateProcessingJob(processingJob.id, {
        queueJobId,
        status: "QUEUED"
      });

      const queuedFile = await fileRepository.updateStatus(uploadedFile.id, "QUEUED");
      results.push({ ...queuedFile, processingJobId: processingJob.id, queueJobId });
    }

    return results;
  }

  async list(query: ListFilesQuery) {
    const page = query.page;
    const pageSize = query.pageSize;
    const listParams: { status?: FileStatus; skip: number; take: number } = {
      skip: (page - 1) * pageSize,
      take: pageSize
    };
    if (query.status) listParams.status = query.status as FileStatus;

    const [total, items] = await fileRepository.list(listParams);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async getById(id: string) {
    const file = await fileRepository.findById(id);
    if (!file) throw notFound("Uploaded file");
    return file;
  }

  async getPreview(id: string) {
    const file = await this.getById(id);
    return s3StorageService.getSignedPreviewUrl(file.s3Bucket, file.s3Key);
  }

  async delete(id: string) {
    const file = await this.getById(id);
    await s3StorageService.delete(file.s3Bucket, file.s3Key);
    return fileRepository.softDelete(id);
  }
}

export const fileService = new FileService();
