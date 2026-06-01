import { Queue, QueueEvents } from "bullmq";
import { env } from "../config/env.js";
import { redisConnection } from "../config/redis.js";

export const OCR_QUEUE_NAME = "ocr-extraction";

export interface OcrJobPayload {
  fileId: string;
  processingJobId: string;
}

export const ocrQueue = new Queue<OcrJobPayload>(OCR_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: env.QUEUE_MAX_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: 10_000
    },
    removeOnComplete: {
      age: 60 * 60 * 24,
      count: 1000
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 7
    }
  }
});

export const ocrQueueEvents = new QueueEvents(OCR_QUEUE_NAME, {
  connection: redisConnection
});
