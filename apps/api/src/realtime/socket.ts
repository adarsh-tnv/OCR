import type { Server } from "socket.io";

let socketServer: Server | null = null;

export const setSocketServer = (server: Server) => {
  socketServer = server;
};

export const emitJobUpdate = (payload: {
  fileId?: string;
  jobId?: string;
  status: string;
  message?: string;
  progress?: number;
}) => {
  socketServer?.emit("job:update", payload);
  if (payload.fileId) {
    socketServer?.to(`file:${payload.fileId}`).emit("job:update", payload);
  }
};
