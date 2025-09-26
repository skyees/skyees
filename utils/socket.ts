// utils/socket.ts
import { io } from "socket.io-client";

let socket;

export default function useSocket() {
  if (!socket) {
    socket = io("http://192.168.31.230:3000", {
      transports: ["websocket"],
    });
  }
  return socket;
}