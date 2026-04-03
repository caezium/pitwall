import Constants from "expo-constants";
import { Platform } from "react-native";

// In development, the API runs on your computer.
// Android emulator uses 10.0.2.2 for localhost, iOS simulator uses localhost.
const DEV_API =
  Platform.OS === "android"
    ? "http://10.0.2.2:3000"
    : "http://localhost:3000";

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? DEV_API;
