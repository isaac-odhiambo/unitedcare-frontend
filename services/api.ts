import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/* =========================
   BASE URL (UNCHANGED)
========================= */
const BASE_URL =
  Platform.OS === "web"
    ? "http://127.0.0.1:8000/api"
    : "http://10.0.2.2:8000/api"; // Android emulator

/* =========================
   AXIOS INSTANCE (UNCHANGED)
========================= */
export const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/* =========================
   🔴 NEW: JWT INTERCEPTOR
========================= */
API.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync("access"); // 🔴 NEW
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

