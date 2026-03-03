// services/api.ts
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
  console.warn("⚠️ EXPO_PUBLIC_API_URL is missing. Add it to your .env and restart Expo.");
}

/* ============================================================
   TOKEN STORAGE KEYS
============================================================ */
const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

/* ============================================================
   ENDPOINTS (ALL BACKEND ROUTES)
============================================================ */
export const ENDPOINTS = {
  // -----------------------------
  // ACCOUNTS
  // -----------------------------
  accounts: {
    register: "/api/accounts/register/",
    verifyOtp: "/api/accounts/verify-otp/",
    login: "/api/accounts/login/",
    forgotPassword: "/api/accounts/forgot-password/",
    resetPassword: "/api/accounts/reset-password/",
    resendOtp: "/api/accounts/resend-otp/",
    me: "/api/accounts/me/",
    kyc: "/api/accounts/kyc/",
  },

  // -----------------------------
  // LOANS
  // -----------------------------
  loans: {
    myLoans: "/api/loans/myloans/",
    requestLoan: "/api/loans/request/",
    loanDetail: (pk: number) => `/api/loans/loan/${pk}/`,
    addGuarantor: "/api/loans/loan/add-guarantor/",

    myGuaranteeRequests: "/api/loans/guarantee/my-requests/",
    acceptGuarantee: (guarantor_id: number) =>
      `/api/loans/guarantee/${guarantor_id}/accept/`,
    rejectGuarantee: (guarantor_id: number) =>
      `/api/loans/guarantee/${guarantor_id}/reject/`,

    approveLoan: (loan_id: number) => `/api/loans/loan/${loan_id}/approve/`,
    payLoan: (loan_id: number) => `/api/loans/loan/${loan_id}/pay/`,
  },

  // -----------------------------
  // MERRY
  // -----------------------------
  merry: {
    listMine: "/api/merry/",
    create: "/api/merry/create/",
    detail: (merry_id: number) => `/api/merry/${merry_id}/`,
    members: (merry_id: number) => `/api/merry/${merry_id}/members/`,

    joinRequest: (merry_id: number) => `/api/merry/${merry_id}/join/request/`,
    myJoinRequests: "/api/merry/join/requests/",
    cancelJoinRequest: (request_id: number) =>
      `/api/merry/join/requests/${request_id}/cancel/`,

    adminListJoinRequests: (merry_id: number) =>
      `/api/merry/${merry_id}/join/requests/`,
    adminApproveJoin: (request_id: number) =>
      `/api/merry/join/requests/${request_id}/approve/`,
    adminRejectJoin: (request_id: number) =>
      `/api/merry/join/requests/${request_id}/reject/`,

    myContributions: "/api/merry/contributions/",
    contribute: (merry_id: number) => `/api/merry/${merry_id}/contribute/`,
    markContributionPaid: (contribution_id: number) =>
      `/api/merry/contributions/${contribution_id}/mark-paid/`,

    payoutSchedule: (merry_id: number) =>
      `/api/merry/${merry_id}/payouts/schedule/`,
    createPayout: (merry_id: number) => `/api/merry/${merry_id}/payouts/create/`,
    markPayoutPaid: (payout_id: number) =>
      `/api/merry/payouts/${payout_id}/mark-paid/`,
  },

  // -----------------------------
  // SAVINGS (EXACT FROM YOUR BACKEND)
  // -----------------------------
  savings: {
    accounts: "/api/savings/accounts/",
    createAccount: "/api/savings/accounts/create/",
    deposit: "/api/savings/deposit/",
    history: (account_id: number) => `/api/savings/accounts/${account_id}/history/`,
    statementPdf: (account_id: number) => `/api/savings/accounts/${account_id}/statement.pdf`,

    withdrawRequest: "/api/savings/withdraw/request/",
    myWithdrawRequests: "/api/savings/withdraw/requests/",

    adminApproveWithdraw: (withdraw_id: number) =>
      `/api/savings/admin/withdraw/${withdraw_id}/approve/`,
    adminRejectWithdraw: (withdraw_id: number) =>
      `/api/savings/admin/withdraw/${withdraw_id}/reject/`,
    adminPayWithdraw: (withdraw_id: number) =>
      `/api/savings/admin/withdraw/${withdraw_id}/pay/`,
  },

  // -----------------------------
  // GROUPS (requires backend include: path("api/groups/", include("groups.urls")))
  // DRF router gives: /groups/ and /memberships/ under that prefix
  // -----------------------------
  groups: {
    groups: "/api/groups/groups/",
    memberships: "/api/groups/memberships/",
  },

  // -----------------------------
  // PAYMENTS (NOT UNDER /api/)
  // -----------------------------
  payments: {
    myWithdrawals: "/payments/withdrawals/my/",
    requestWithdrawal: "/payments/withdrawals/request/",
    adminWithdrawals: "/payments/withdrawals/admin/",
    approveWithdrawal: (pk: number) => `/payments/withdrawals/${pk}/approve/`,
    rejectWithdrawal: (pk: number) => `/payments/withdrawals/${pk}/reject/`,

    myLedger: "/payments/ledger/my/",
    adminLedger: "/payments/ledger/admin/",

    mpesaAdmin: "/payments/mpesa/admin/",

    stkPush: "/payments/mpesa/stk-push/",
    stkCallback: "/payments/mpesa/stk/callback/",
    b2cResult: "/payments/mpesa/b2c/result/",
    b2cTimeout: "/payments/mpesa/b2c/timeout/",
  },
} as const;

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
   - Mobile → SecureStore
   - Web → localStorage
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

  // Network / timeout
  if (!e?.response) {
    if ((e as any)?.code === "ECONNABORTED") return "Request timed out. Please try again.";
    return e?.message || "Network error. Check your internet and API URL.";
  }

  // DRF: { detail: "..." }
  if (typeof data?.detail === "string") return data.detail;

  // DRF: { non_field_errors: ["..."] }
  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return data.non_field_errors[0];
  }

  // DRF field errors
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
   ATTACH JWT ACCESS TOKEN AUTOMATICALLY (SAFE + SKIP AUTH ROUTES)
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

    // ✅ Public endpoints should NOT carry Authorization header
    if (isPublicEndpoint(url)) {
      if (config.headers?.Authorization) delete (config.headers as any).Authorization;
      return config;
    }

    const token = await getAccessToken();

    // ✅ attach ONLY if token looks like JWT
    if (typeof token === "string" && token.split(".").length === 3) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      if (config.headers?.Authorization) delete (config.headers as any).Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ============================================================
   SMALL REQUEST WRAPPERS (OPTIONAL BUT CLEAN)
============================================================ */
export async function GET<T = any>(url: string, config?: AxiosRequestConfig) {
  const res = await api.get<T>(url, config);
  return res.data;
}

export async function POST<T = any>(url: string, body?: any, config?: AxiosRequestConfig) {
  const res = await api.post<T>(url, body ?? {}, config);
  return res.data;
}

export async function PATCH<T = any>(url: string, body?: any, config?: AxiosRequestConfig) {
  const res = await api.patch<T>(url, body ?? {}, config);
  return res.data;
}

export async function DEL<T = any>(url: string, config?: AxiosRequestConfig) {
  const res = await api.delete<T>(url, config);
  return res.data;
}

/* ============================================================
   URL HELPERS (PDF, images, etc.)
============================================================ */
export function buildUrl(path: string) {
  const base = String(api.defaults.baseURL || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${base}/${p}`;
}

// Useful for opening statement PDF in web, or passing to downloader on mobile
export function savingsStatementPdfFullUrl(account_id: number) {
  return buildUrl(ENDPOINTS.savings.statementPdf(account_id));
}

export default api;