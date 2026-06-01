import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { redisConnection } from "../config/redis.js";
import { OCR_QUEUE_NAME } from "./queues.js";
import { processOcrJob } from "./ocr.processor.js";

export const startOcrWorker = () => {
  const worker = new Worker(OCR_QUEUE_NAME, processOcrJob, {
    connection: redisConnection,
    concurrency: env.QUEUE_CONCURRENCY
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Queue job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error, message: error.message }, "Queue job failed");
  });

  worker.on("error", (error) => {
    logger.error({ error, message: error.message }, "Queue worker error");
  });

  return worker;
};
