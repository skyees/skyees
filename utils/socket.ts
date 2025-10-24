import { io } from "socket.io-client";

const apiURL = process.env.EXPO_PUBLIC_API_URL;

// Create the socket instance one time when the module is first loaded.
const socket = io(`${apiURL}`, {
  transports: ["websocket"],
});

// The function now just returns the single, already-created instance.
export default function useSocket() {
  return socket;
}