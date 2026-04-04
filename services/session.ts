// services/session.ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "session_user";

/**
 * Stored user session info
 * Used across dashboard, groups, loans, payments etc.
 * Should mirror backend "user" payload as closely as possible.
 */
export type SessionUser = {
  id?: number;

  username?: string;
  phone?: string;
  email?: string | null;
  id_number?: string | null;

  role?: "admin" | "member" | string;
  status?: "pending" | "approved" | "blocked" | string;

  is_active?: boolean;
  is_phone_verified?: boolean;
  is_admin?: boolean;

  kyc_completed?: boolean | null;
  kyc_status?:
    | "not_submitted"
    | "submitted"
    | "approved"
    | "rejected"
    | string
    | null;
  is_kyc_approved?: boolean | null;

  has_limited_access?: boolean | null;
  has_full_access?: boolean | null;
};

/**
 * Save entire session user
 */
export async function saveSessionUser(user: SessionUser) {
  const value = JSON.stringify(user ?? {});

  if (Platform.OS === "web") {
    localStorage.setItem(KEY, value);
    return;
  }

  await SecureStore.setItemAsync(KEY, value);
}

/**
 * Merge session safely instead of overwriting
 */
export async function mergeSessionUser(
  patch: Partial<SessionUser>
): Promise<SessionUser> {
  const current = await getSessionUser();
  const next: SessionUser = { ...(current || {}), ...(patch || {}) };

  await saveSessionUser(next);
  return next;
}

/**
 * Read current logged-in session user
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? localStorage.getItem(KEY)
        : await SecureStore.getItemAsync(KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as SessionUser;

    if (!parsed || typeof parsed !== "object") return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clear session on logout
 */
export async function clearSessionUser() {
  if (Platform.OS === "web") {
    localStorage.removeItem(KEY);
    return;
  }

  await SecureStore.deleteItemAsync(KEY);
}

/**
 * Optional helpers for quick checks
 */
export async function isAdmin(): Promise<boolean> {
  const u = await getSessionUser();
  return !!u?.is_admin || u?.role === "admin";
}

export async function isPhoneVerified(): Promise<boolean> {
  const u = await getSessionUser();
  return !!u?.is_phone_verified;
}

export async function isKycApproved(): Promise<boolean> {
  const u = await getSessionUser();
  return (
    u?.kyc_status === "approved" ||
    !!u?.is_kyc_approved ||
    !!u?.kyc_completed
  );
}

export async function hasLimitedAccess(): Promise<boolean> {
  const u = await getSessionUser();
  return !!u?.has_limited_access;
}

export async function hasFullAccess(): Promise<boolean> {
  const u = await getSessionUser();
  return !!u?.has_full_access;
}