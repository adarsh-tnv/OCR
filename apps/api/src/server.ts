import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/prisma.js";
import { redisConnection } from "./config/redis.js";
import { apiAuthEnabled, verifyApiToken } from "./middleware/auth.js";
import { ocrQueue, ocrQueueEvents } from "./queue/queues.js";
import { emitJobUpdate, setSocketServer } from "./realtime/socket.js";

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true
  }
});

setSocketServer(io);

io.use((socket, next) => {
  if (!apiAuthEnabled) {
    next();
    return;
  }

  const authToken = socket.handshake.auth?.token;
  const header = socket.handshake.headers.authorization;
  const bearerToken =
    typeof header === "string" && header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;

  if (verifyApiToken(typeof authToken === "string" ? authToken : bearerToken)) {
    next();
    return;
  }

  next(new Error("Unauthorized"));
});

io.on("connection", (socket) => {
  socket.on("file:subscribe", (fileId: string) => {
    if (!/^[a-f\d]{24}$/i.test(fileId)) return;
    socket.join(`file:${fileId}`);
  });

  socket.on("file:unsubscribe", (fileId: string) => {
    if (!/^[a-f\d]{24}$/i.test(fileId)) return;
    socket.leave(`file:${fileId}`);
  });
});

ocrQueueEvents.on("progress", ({ jobId, data }) => {
  emitJobUpdate({ jobId, status: "progress", progress: Number(data) });
});

ocrQueueEvents.on("completed", ({ jobId, returnvalue }) => {
  const result = returnvalue as { fileId?: string } | undefined;
  emitJobUpdate({
    jobId,
    status: "completed",
    progress: 100,
    ...(result?.fileId ? { fileId: result.fileId } : {})
  });
});

ocrQueueEvents.on("failed", ({ jobId, failedReason }) => {
  emitJobUpdate({ jobId, status: "failed", message: failedReason });
});

server.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "API server listening");
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down API server");
  server.close(async () => {
    await ocrQueueEvents.close();
    await ocrQueue.close();
    await redisConnection.quit();
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
