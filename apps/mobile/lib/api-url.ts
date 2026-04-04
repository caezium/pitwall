import Constants from "expo-constants";
import { Platform } from "react-native";

// Expo dev server exposes the LAN IP via debuggerHost (e.g. "192.168.1.66:8081").
// Strip the port and use it so physical devices can reach the API.
const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.experienceUrl ?? "";
const lanHost = debuggerHost.split(":")[0];

function getDevApiUrl(): string {
  if (lanHost) {
    return `http://${lanHost}:3000`;
  }
  // Fallback for simulator/emulator
  return Platform.OS === "android"
    ? "http://10.0.2.2:3000"
    : "http://localhost:3000";
}

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? getDevApiUrl();
