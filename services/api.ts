// services/api.ts
import axios, { AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const LAN_IP = "192.168.100.34"; // your PC Wi-Fi IP
const PORT = 8000;

// Optional env override (remember to restart Expo with -c)
const ENV_URL = process.env.EXPO_PUBLIC_API_URL;

// Choose baseURL per platform
function computeBaseUrl() {
  // If you provided EXPO_PUBLIC_API_URL, use it
  if (ENV_URL && ENV_URL.trim().length > 0) return ENV_URL.replace(/\/$/, "");

  // Web: browser runs on your PC, localhost works best
  if (Platform.OS === "web") return `http://127.0.0.1:${PORT}`;

  // Mobile (Expo Go): must use LAN IP
  return `http://${LAN_IP}:${PORT}`;
}

export const BASE_URL = computeBaseUrl();
export const API_BASE = `${BASE_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ----------------------
// Token helpers
// ----------------------
export async function saveTokens(access?: string, refresh?: string) {
  if (access) await SecureStore.setItemAsync("access", access);
  if (refresh) await SecureStore.setItemAsync("refresh", refresh);
}
export async function clearTokens() {
  await SecureStore.deleteItemAsync("access");
  await SecureStore.deleteItemAsync("refresh");
}
async function getAccessToken() {
  return SecureStore.getItemAsync("access");
}

// Attach token automatically
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ----------------------
// Error formatter
// ----------------------
export function getErrorMessage(err: unknown): string {
  const e = err as AxiosError<any>;

  // No response => network (wrong IP / backend not reachable / firewall)
  if (!e.response) {
    return (
      `Network error: cannot reach API.\n\n` +
      `BaseURL: ${API_BASE}\n` +
      `Tips:\n` +
      `- Run Django: python manage.py runserver 0.0.0.0:8000\n` +
      `- On phone open: http://${LAN_IP}:${PORT}\n` +
      `- Allow port 8000 in firewall\n`
    );
  }

  const data = e.response.data;
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length)
    return data.non_field_errors[0];

  const keys = data && typeof data === "object" ? Object.keys(data) : [];
  for (const k of keys) {
    const v = data[k];
    if (Array.isArray(v) && v.length) return `${k}: ${v[0]}`;
    if (typeof v === "string") return `${k}: ${v}`;
  }

  return `Request failed (HTTP ${e.response.status}).`;
}