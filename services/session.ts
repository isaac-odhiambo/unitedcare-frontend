// services/session.ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "session_user";

export type SessionUser = {
  role?: "admin" | "member" | string;
  status?: "pending" | "approved" | "blocked" | string;
  is_admin?: boolean;

  // optional extra fields
  username?: string;
  phone?: string;
  email?: string | null;
};

export async function saveSessionUser(user: SessionUser) {
  const value = JSON.stringify(user);

  if (Platform.OS === "web") {
    localStorage.setItem(KEY, value);
    return;
  }

  await SecureStore.setItemAsync(KEY, value);
}

/**
 * ✅ NEW: merge session safely instead of overwriting
 */
export async function mergeSessionUser(
  patch: Partial<SessionUser>
): Promise<SessionUser> {
  const current = await getSessionUser();
  const next = { ...(current || {}), ...(patch || {}) };
  await saveSessionUser(next);
  return next;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? localStorage.getItem(KEY)
        : await SecureStore.getItemAsync(KEY);

    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function clearSessionUser() {
  if (Platform.OS === "web") {
    localStorage.removeItem(KEY);
    return;
  }

  await SecureStore.deleteItemAsync(KEY);
}

// // services/session.ts
// import * as SecureStore from "expo-secure-store";
// import { Platform } from "react-native";

// const KEY = "session_user";

// export type SessionUser = {
//   role?: "admin" | "member" | string;
//   status?: "pending" | "approved" | "blocked" | string;
//   is_admin?: boolean;
// };

// export async function saveSessionUser(user: SessionUser) {
//   const value = JSON.stringify(user);
//   if (Platform.OS === "web") {
//     localStorage.setItem(KEY, value);
//     return;
//   }
//   await SecureStore.setItemAsync(KEY, value);
// }

// export async function getSessionUser(): Promise<SessionUser | null> {
//   try {
//     const raw =
//       Platform.OS === "web"
//         ? localStorage.getItem(KEY)
//         : await SecureStore.getItemAsync(KEY);

//     if (!raw) return null;
//     return JSON.parse(raw) as SessionUser;
//   } catch {
//     return null;
//   }
// }

// export async function clearSessionUser() {
//   if (Platform.OS === "web") {
//     localStorage.removeItem(KEY);
//     return;
//   }
//   await SecureStore.deleteItemAsync(KEY);
// }