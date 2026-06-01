import { logger } from "./config/logger.js";
import { prisma } from "./config/prisma.js";
import { redisConnection } from "./config/redis.js";
import { startOcrWorker } from "./queue/worker.js";

const worker = startOcrWorker();

logger.info("OCR worker started");

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down OCR worker");
  await worker.close();
  await redisConnection.quit();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
