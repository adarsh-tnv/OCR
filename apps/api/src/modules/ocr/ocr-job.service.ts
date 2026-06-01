import { env } from "../../config/env.js";
import { ocrQueue } from "../../queue/queues.js";
import { notFound } from "../../utils/api-error.js";
import { fileRepository } from "../files/file.repository.js";

export class OcrJobService {
  async enqueue(fileId: string, retry = false) {
    const file = await fileRepository.findById(fileId);
    if (!file) throw notFound("Uploaded file");

    const processingJob = await fileRepository.createProcessingJob({
      uploadedFileId: fileId,
      jobType: retry ? "RETRY" : "OCR_EXTRACTION",
      maxAttempts: env.QUEUE_MAX_ATTEMPTS,
      metadata: { source: retry ? "retry" : "manual" }
    });

    const queueJob = await ocrQueue.add("ocr-extraction", {
      fileId,
      processingJobId: processingJob.id
    });
    const queueJobId = queueJob.id ?? processingJob.id;

    await fileRepository.updateProcessingJob(processingJob.id, {
      queueJobId,
      status: "QUEUED"
    });

    await fileRepository.updateStatus(fileId, "QUEUED", {
      failureReason: null
    });

    if (retry) {
      await fileRepository.createHistory({
        uploadedFileId: fileId,
        action: "RETRIED",
        after: { processingJobId: processingJob.id, queueJobId }
      });
    }

    return {
      fileId,
      processingJobId: processingJob.id,
      queueJobId
    };
  }
}

export const ocrJobService = new OcrJobService();
