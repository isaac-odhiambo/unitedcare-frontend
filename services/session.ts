// services/session.ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "session_user";
const KEEP_SIGNED_IN_KEY = "keep_signed_in";
const REMEMBERED_PHONE_KEY = "remembered_phone";
const AUTH_TOKEN_KEY = "auth_token";

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

  has_limited_access?: boolean | null;
  has_full_access?: boolean | null;
};

function getStorageItem(key: string): string | null | Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

function setStorageItem(key: string, value: string): void | Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }

  return SecureStore.setItemAsync(key, value);
}

function removeStorageItem(key: string): void | Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }

  return SecureStore.deleteItemAsync(key);
}

/**
 * Save entire session user
 */
export async function saveSessionUser(user: SessionUser) {
  const value = JSON.stringify(user ?? {});
  await setStorageItem(KEY, value);
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
    const raw = await getStorageItem(KEY);

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
  await removeStorageItem(KEY);
}

/**
 * Keep me signed in helpers
 */
export async function setKeepSignedIn(value: boolean) {
  await setStorageItem(KEEP_SIGNED_IN_KEY, value ? "true" : "false");
}

export async function getKeepSignedIn(): Promise<boolean> {
  try {
    const raw = await getStorageItem(KEEP_SIGNED_IN_KEY);
    return raw === "true";
  } catch {
    return false;
  }
}

export async function saveRememberedPhone(phone: string) {
  await setStorageItem(REMEMBERED_PHONE_KEY, phone);
}

export async function getRememberedPhone(): Promise<string | null> {
  try {
    const raw = await getStorageItem(REMEMBERED_PHONE_KEY);
    return raw || null;
  } catch {
    return null;
  }
}

export async function clearRememberedPhone() {
  await removeStorageItem(REMEMBERED_PHONE_KEY);
}

export async function saveAuthToken(token: string) {
  await setStorageItem(AUTH_TOKEN_KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const raw = await getStorageItem(AUTH_TOKEN_KEY);
    return raw || null;
  } catch {
    return null;
  }
}

export async function clearAuthToken() {
  await removeStorageItem(AUTH_TOKEN_KEY);
}

export async function saveLoginPersistence(params: {
  keepSignedIn: boolean;
  phone?: string;
  token?: string | null;
}) {
  const { keepSignedIn, phone, token } = params;

  await setKeepSignedIn(keepSignedIn);

  if (keepSignedIn) {
    if (phone) {
      await saveRememberedPhone(phone);
    }

    if (token) {
      await saveAuthToken(token);
    }
  } else {
    await clearRememberedPhone();
    await clearAuthToken();
  }
}

export async function clearSavedLoginPersistence() {
  await setKeepSignedIn(false);
  await clearRememberedPhone();
  await clearAuthToken();
}

export async function hasPersistedLogin(): Promise<boolean> {
  const keepSignedIn = await getKeepSignedIn();
  const token = await getAuthToken();

  return keepSignedIn && !!token;
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

export async function hasLimitedAccess(): Promise<boolean> {
  const u = await getSessionUser();
  return !!u?.has_limited_access;
}

export async function hasFullAccess(): Promise<boolean> {
  const u = await getSessionUser();
  return !!u?.has_full_access;
}

// // services/session.ts
// import * as SecureStore from "expo-secure-store";
// import { Platform } from "react-native";

// const KEY = "session_user";

// /**
//  * Stored user session info
//  * Used across dashboard, groups, loans, payments etc.
//  * Should mirror backend "user" payload as closely as possible.
//  */
// export type SessionUser = {
//   id?: number;

//   username?: string;
//   phone?: string;
//   email?: string | null;
//   id_number?: string | null;

//   role?: "admin" | "member" | string;
//   status?: "pending" | "approved" | "blocked" | string;

//   is_active?: boolean;
//   is_phone_verified?: boolean;
//   is_admin?: boolean;

//   has_limited_access?: boolean | null;
//   has_full_access?: boolean | null;
// };

// /**
//  * Save entire session user
//  */
// export async function saveSessionUser(user: SessionUser) {
//   const value = JSON.stringify(user ?? {});

//   if (Platform.OS === "web") {
//     localStorage.setItem(KEY, value);
//     return;
//   }

//   await SecureStore.setItemAsync(KEY, value);
// }

// /**
//  * Merge session safely instead of overwriting
//  */
// export async function mergeSessionUser(
//   patch: Partial<SessionUser>
// ): Promise<SessionUser> {
//   const current = await getSessionUser();
//   const next: SessionUser = { ...(current || {}), ...(patch || {}) };

//   await saveSessionUser(next);
//   return next;
// }

// /**
//  * Read current logged-in session user
//  */
// export async function getSessionUser(): Promise<SessionUser | null> {
//   try {
//     const raw =
//       Platform.OS === "web"
//         ? localStorage.getItem(KEY)
//         : await SecureStore.getItemAsync(KEY);

//     if (!raw) return null;

//     const parsed = JSON.parse(raw) as SessionUser;

//     if (!parsed || typeof parsed !== "object") return null;

//     return parsed;
//   } catch {
//     return null;
//   }
// }

// /**
//  * Clear session on logout
//  */
// export async function clearSessionUser() {
//   if (Platform.OS === "web") {
//     localStorage.removeItem(KEY);
//     return;
//   }

//   await SecureStore.deleteItemAsync(KEY);
// }

// /**
//  * Optional helpers for quick checks
//  */
// export async function isAdmin(): Promise<boolean> {
//   const u = await getSessionUser();
//   return !!u?.is_admin || u?.role === "admin";
// }

// export async function isPhoneVerified(): Promise<boolean> {
//   const u = await getSessionUser();
//   return !!u?.is_phone_verified;
// }

// export async function hasLimitedAccess(): Promise<boolean> {
//   const u = await getSessionUser();
//   return !!u?.has_limited_access;
// }

// export async function hasFullAccess(): Promise<boolean> {
//   const u = await getSessionUser();
//   return !!u?.has_full_access;
// }