import { io } from "socket.io-client";

const apiURL = process.env.EXPO_PUBLIC_API_URL+"/pyapi/ws/";
const socket = io("https://skyees.com", {
  path: "/socket.io",
  transports: ["websocket"],
  reconnection: true,
});


// The function now just returns the single, already-created instance.
export default function useSocket() {
  return socket;
}