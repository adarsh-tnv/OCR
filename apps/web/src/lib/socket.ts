"use client";

import { io } from "socket.io-client";
import { getAuthToken } from "@/lib/auth-token";

export const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
  autoConnect: false,
  transports: ["websocket"]
});

export const attachSocketAuth = () => {
  socket.auth = { token: getAuthToken() };
};
