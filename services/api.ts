// services/api.ts
// -----------------------------------------------------------
// API client setup only
// - axios instance
// - token storage
// - auth header interceptor
// - error parser
// - small request wrappers
// - buildUrl helper
// -----------------------------------------------------------

import { ENDPOINTS } from "@/services/endpoints";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Set in .env:
 * EXPO_PUBLIC_API_URL=http://192.168.100.34:8000
 *
 * After editing .env run:
 * npx expo start -c
 */
let BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!BASE_URL) {
  console.warn(
    "⚠️ EXPO_PUBLIC_API_URL is missing. Add it to your .env and restart Expo."
  );
}

/* ============================================================
   TOKEN STORAGE KEYS
============================================================ */
const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

/* ============================================================
   AXIOS INSTANCE
============================================================ */
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/* ============================================================
   OPTIONAL: allow updating baseURL at runtime
============================================================ */
export function setApiBaseUrl(url: string) {
  BASE_URL = url;
  api.defaults.baseURL = url;
}

/* ============================================================
   TOKEN HELPERS
   - Mobile -> SecureStore
   - Web -> localStorage
============================================================ */
export async function saveAuthTokens(access: string, refresh?: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    return;
  }

  await SecureStore.setItemAsync(ACCESS_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function getAccessToken() {
  if (Platform.OS === "web") return localStorage.getItem(ACCESS_KEY);
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken() {
  if (Platform.OS === "web") return localStorage.getItem(REFRESH_KEY);
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearAuthTokens() {
  if (Platform.OS === "web") {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

/* ============================================================
   FRIENDLY ERROR PARSER (DRF Compatible)
============================================================ */
export function getErrorMessage(err: any): string {
  const e = err as AxiosError<any>;
  const data = e?.response?.data;

  if (!e?.response) {
    if ((e as any)?.code === "ECONNABORTED") {
      return "Request timed out. Please try again.";
    }
    return e?.message || "Network error. Check your internet and API URL.";
  }

  if (typeof data?.detail === "string") return data.detail;

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return data.non_field_errors[0];
  }

  if (data && typeof data === "object") {
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = (data as any)[firstKey];
      if (Array.isArray(val) && val.length) return String(val[0]);
      if (typeof val === "string") return val;
    }
  }

  const status = e.response?.status;
  if (status === 401) return "Unauthorized. Please login again.";
  if (status === 403) return "Access denied.";
  if (status === 404) return "Endpoint not found.";
  if (status && status >= 500) return "Server error. Please try again later.";

  return "Request failed. Please try again.";
}

/* ============================================================
   ATTACH JWT ACCESS TOKEN AUTOMATICALLY
============================================================ */
function isPublicEndpoint(url: string) {
  const publicPaths = [
    ENDPOINTS.accounts.login,
    ENDPOINTS.accounts.register,
    ENDPOINTS.accounts.verifyOtp,
    ENDPOINTS.accounts.forgotPassword,
    ENDPOINTS.accounts.resetPassword,
    ENDPOINTS.accounts.resendOtp,
  ];

  return publicPaths.some((p) => url.includes(p));
}

api.interceptors.request.use(
  async (config) => {
    const url = String(config.url || "");

    if (isPublicEndpoint(url)) {
      if (config.headers?.Authorization) {
        delete (config.headers as any).Authorization;
      }
      return config;
    }

    const token = await getAccessToken();

    if (typeof token === "string" && token.split(".").length === 3) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      if (config.headers?.Authorization) {
        delete (config.headers as any).Authorization;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ============================================================
   SMALL REQUEST WRAPPERS
============================================================ */
export async function GET<T = any>(url: string, config?: AxiosRequestConfig) {
  const res = await api.get<T>(url, config);
  return res.data;
}

export async function POST<T = any>(
  url: string,
  body?: any,
  config?: AxiosRequestConfig
) {
  const res = await api.post<T>(url, body ?? {}, config);
  return res.data;
}

export async function PATCH<T = any>(
  url: string,
  body?: any,
  config?: AxiosRequestConfig
) {
  const res = await api.patch<T>(url, body ?? {}, config);
  return res.data;
}

export async function DEL<T = any>(url: string, config?: AxiosRequestConfig) {
  const res = await api.delete<T>(url, config);
  return res.data;
}

/* ============================================================
   URL HELPERS
============================================================ */
export function buildUrl(path: string) {
  const base = String(api.defaults.baseURL || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${base}/${p}`;
}

export default api;