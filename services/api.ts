// services/api.ts
// -----------------------------------------------------------
// Production-ready API client
// - axios instance
// - token storage
// - auth header interceptor
// - error parser
// - request wrappers
// - URL helper
// - unauthorized/session-expired handling
// -----------------------------------------------------------

import { ENDPOINTS } from "@/services/endpoints";
import { clearSessionUser } from "@/services/session";
import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Example .env
 * EXPO_PUBLIC_API_URL=https://unitedcare-backend.onrender.com
 *
 * After editing .env run:
 * npx expo start -c
 */

function cleanBaseUrl(url: string) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

let BASE_URL = cleanBaseUrl(process.env.EXPO_PUBLIC_API_URL || "");

if (!BASE_URL) {
  console.warn(
    "⚠️ EXPO_PUBLIC_API_URL is missing. Add it to your .env and restart Expo."
  );
} else {
  console.log("🌐 API BASE URL:", BASE_URL);
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
  baseURL: BASE_URL || undefined,
  timeout: 20000,
  headers: {
    Accept: "application/json",
    // NOTE:
    // Do NOT force "Content-Type": "application/json" here.
    // Some requests (like KYC upload) use FormData/multipart.
    // We set JSON content type conditionally in the request interceptor below.
  },
});

/* ============================================================
   OPTIONAL: allow updating baseURL at runtime
============================================================ */
export function setApiBaseUrl(url: string) {
  const clean = cleanBaseUrl(url);
  BASE_URL = clean;
  api.defaults.baseURL = clean || undefined;
  console.log("🌐 API BASE URL updated:", clean || "(empty)");
}

/* ============================================================
   TOKEN HELPERS
   - Web -> localStorage
   - Mobile -> SecureStore
============================================================ */
export async function saveAuthTokens(access?: string, refresh?: string) {
  const cleanAccess = String(access || "").trim();
  const cleanRefresh = String(refresh || "").trim();

  if (Platform.OS === "web") {
    if (cleanAccess) localStorage.setItem(ACCESS_KEY, cleanAccess);
    else localStorage.removeItem(ACCESS_KEY);

    if (cleanRefresh) localStorage.setItem(REFRESH_KEY, cleanRefresh);
    else localStorage.removeItem(REFRESH_KEY);

    return;
  }

  if (cleanAccess) await SecureStore.setItemAsync(ACCESS_KEY, cleanAccess);
  else await SecureStore.deleteItemAsync(ACCESS_KEY);

  if (cleanRefresh) await SecureStore.setItemAsync(REFRESH_KEY, cleanRefresh);
  else await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  const raw =
    Platform.OS === "web"
      ? localStorage.getItem(ACCESS_KEY)
      : await SecureStore.getItemAsync(ACCESS_KEY);

  const token = String(raw || "").trim();
  return token || null;
}

export async function getRefreshToken(): Promise<string | null> {
  const raw =
    Platform.OS === "web"
      ? localStorage.getItem(REFRESH_KEY)
      : await SecureStore.getItemAsync(REFRESH_KEY);

  const token = String(raw || "").trim();
  return token || null;
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
   GLOBAL UNAUTHORIZED HANDLER
============================================================ */
let unauthorizedHandler: null | (() => void) = null;
let isHandlingUnauthorized = false;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

async function handleUnauthorizedSession() {
  if (isHandlingUnauthorized) return;

  isHandlingUnauthorized = true;

  try {
    await clearAuthTokens();
    await clearSessionUser();
    console.warn("🔐 Session expired or token invalid. Please login again.");

    if (unauthorizedHandler) {
      unauthorizedHandler();
    }
  } catch {
    // ignore cleanup errors
  } finally {
    setTimeout(() => {
      isHandlingUnauthorized = false;
    }, 800);
  }
}

/* ============================================================
   ERROR PARSER
============================================================ */
export function getErrorMessage(err: unknown): string {
  const e = err as AxiosError<any>;
  const data = e?.response?.data;

  if (!e?.response) {
    if ((e as any)?.code === "ECONNABORTED") {
      return "Request timed out. Please try again.";
    }
    return e?.message || "Network error. Check your internet and API URL.";
  }

  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return String(data.non_field_errors[0]);
  }

  if (Array.isArray(data) && data.length) {
    return String(data[0]);
  }

  if (data && typeof data === "object") {
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      if (Array.isArray(val) && val.length) return String(val[0]);
      if (typeof val === "string") return val;
    }
  }

  const status = e.response?.status;
  if (status === 400) return "Invalid request. Please check your input.";
  if (status === 401) return "Session expired. Please login again.";
  if (status === 403) return "Access denied.";
  if (status === 404) return "Endpoint not found.";
  if (status === 405) return "Method not allowed.";
  if (status && status >= 500) return "Server error. Please try again later.";

  return "Request failed. Please try again.";
}

/* ============================================================
   PATH HELPERS
============================================================ */
function normalizeUrlPath(url: string) {
  return String(url || "").trim();
}

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

/**
 * Public endpoints must match your live backend routes exactly.
 * Since your backend is using:
 *   /accounts/login/
 * and not:
 *   /api/accounts/login/
 * ENDPOINTS should follow that same pattern.
 */
function isPublicEndpoint(url: string) {
  const currentUrl = normalizeUrlPath(url);

  const publicPaths = [
    ENDPOINTS.accounts.login,
    ENDPOINTS.accounts.register,
    ENDPOINTS.accounts.verifyOtp,
    ENDPOINTS.accounts.forgotPassword,
    ENDPOINTS.accounts.resetPassword,
    ENDPOINTS.accounts.resendOtp,
  ]
    .filter(Boolean)
    .map((p) => String(p).trim());

  return publicPaths.some((p) => currentUrl.includes(p));
}

/* ============================================================
   REQUEST INTERCEPTOR
============================================================ */
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const url = normalizeUrlPath(String(config.url || ""));
    config.headers = config.headers ?? {};

    const isFormData =
      typeof FormData !== "undefined" && config.data instanceof FormData;

    if (isPublicEndpoint(url)) {
      if ((config.headers as any).Authorization) {
        delete (config.headers as any).Authorization;
      }

      // IMPORTANT:
      // For FormData requests, let axios set the multipart boundary automatically.
      // For non-FormData requests, default to JSON.
      if (isFormData) {
        delete (config.headers as any)["Content-Type"];
      } else if (!(config.headers as any)["Content-Type"]) {
        (config.headers as any)["Content-Type"] = "application/json";
      }

      return config;
    }

    const token = await getAccessToken();

    if (token) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    } else if ((config.headers as any).Authorization) {
      delete (config.headers as any).Authorization;
    }

    // IMPORTANT:
    // KYC upload uses FormData. If Content-Type is forced to JSON,
    // Django will receive plain text instead of files.
    if (isFormData) {
      delete (config.headers as any)["Content-Type"];
    } else if (!(config.headers as any)["Content-Type"]) {
      (config.headers as any)["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ============================================================
   RESPONSE INTERCEPTOR
============================================================ */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await handleUnauthorizedSession();
    }
    return Promise.reject(error);
  }
);

/* ============================================================
   URL BUILDERS
============================================================ */
export function buildUrl(path: string) {
  const cleanPath = String(path || "").trim();

  if (!cleanPath) return String(api.defaults.baseURL || "");

  if (isAbsoluteUrl(cleanPath)) return cleanPath;

  const base = cleanBaseUrl(String(api.defaults.baseURL || ""));
  const normalizedPath = cleanPath.startsWith("/")
    ? cleanPath
    : `/${cleanPath}`;

  return `${base}${normalizedPath}`;
}

/* ============================================================
   REQUEST WRAPPERS
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

export async function PUT<T = any>(
  url: string,
  body?: any,
  config?: AxiosRequestConfig
) {
  const res = await api.put<T>(url, body ?? {}, config);
  return res.data;
}

export async function DEL<T = any>(url: string, config?: AxiosRequestConfig) {
  const res = await api.delete<T>(url, config);
  return res.data;
}

export default api;