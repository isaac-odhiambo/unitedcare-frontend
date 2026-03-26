// services/auth.ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api, saveAuthTokens } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";
import { clearSessionUser, type SessionUser } from "@/services/session";

export type RegisterPayload = {
  username: string;
  phone: string;
  email: string;
  id_number?: string;
  password: string;
};

export type VerifyOtpPayload = {
  phone: string;
  otp: string;
};

export type LoginPayload = {
  phone: string;
  password: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  email: string;
  code: string;
  new_password: string;
};

export type ResendOtpPayload = {
  phone: string;
};

export type AuthResponse = {
  access?: string;
  refresh?: string;
  user?: SessionUser;
  detail?: string;
  message?: string;
  [key: string]: any;
};

function normalizeAuthPhone(phone: string): string {
  return String(phone || "").replace(/\s+/g, "").trim();
}

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

async function persistTokensFromResponse(data?: AuthResponse) {
  const access = data?.access;
  const refresh = data?.refresh;

  if (typeof access === "string" && access.split(".").length === 3) {
    await saveAuthTokens(access, refresh);
  }
}

async function removeStorageItem(key: string) {
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  } catch {
    // silent on purpose
  }
}

export async function logoutUser(): Promise<void> {
  const tokenKeys = [
    "access",
    "refresh",
    "access_token",
    "refresh_token",
    "ACCESS_TOKEN",
    "REFRESH_TOKEN",
  ];

  await Promise.all(tokenKeys.map(removeStorageItem));
  await clearSessionUser();
}

export async function registerUser(
  payload: RegisterPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(ENDPOINTS.accounts.register, {
    ...payload,
    phone: normalizeAuthPhone(payload.phone),
    email: normalizeEmail(payload.email),
  });

  return res.data;
}

export async function verifyOtp(
  payload: VerifyOtpPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(ENDPOINTS.accounts.verifyOtp, {
    ...payload,
    phone: normalizeAuthPhone(payload.phone),
    otp: String(payload.otp || "").trim(),
  });

  return res.data;
}

export async function loginUser(
  payload: LoginPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(ENDPOINTS.accounts.login, {
    ...payload,
    phone: normalizeAuthPhone(payload.phone),
  });

  await persistTokensFromResponse(res.data);

  return res.data;
}

export async function forgotPassword(
  payload: ForgotPasswordPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(
    ENDPOINTS.accounts.forgotPassword,
    {
      email: normalizeEmail(payload.email),
    }
  );

  return res.data;
}

export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(
    ENDPOINTS.accounts.resetPassword,
    {
      email: normalizeEmail(payload.email),
      code: String(payload.code || "").trim(),
      new_password: payload.new_password,
    }
  );

  await persistTokensFromResponse(res.data);

  return res.data;
}

export async function resendOtp(
  payload: ResendOtpPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(ENDPOINTS.accounts.resendOtp, {
    ...payload,
    phone: normalizeAuthPhone(payload.phone),
  });

  return res.data;
}

// // services/auth.ts
// import { api, saveAuthTokens } from "@/services/api";
// import { ENDPOINTS } from "@/services/endpoints";
// import type { SessionUser } from "@/services/session";

// export type RegisterPayload = {
//   username: string;
//   phone: string;
//   id_number?: string;
//   password: string;
// };

// export type VerifyOtpPayload = {
//   phone: string;
//   otp: string;
// };

// export type LoginPayload = {
//   phone: string;
//   password: string;
// };

// export type ForgotPasswordPayload = {
//   phone: string;
// };

// export type ResetPasswordPayload = {
//   phone: string;
//   otp: string;
//   new_password: string;
// };

// export type ResendOtpPayload = {
//   phone: string;
// };

// export type AuthResponse = {
//   access?: string;
//   refresh?: string;
//   user?: SessionUser;
//   detail?: string;
//   message?: string;
//   [key: string]: any;
// };

// function normalizeAuthPhone(phone: string): string {
//   return String(phone || "").replace(/\s+/g, "").trim();
// }

// async function persistTokensFromResponse(data?: AuthResponse) {
//   const access = data?.access;
//   const refresh = data?.refresh;

//   if (typeof access === "string" && access.split(".").length === 3) {
//     await saveAuthTokens(access, refresh);
//   }
// }

// export async function registerUser(
//   payload: RegisterPayload
// ): Promise<AuthResponse> {
//   const res = await api.post<AuthResponse>(ENDPOINTS.accounts.register, {
//     ...payload,
//     phone: normalizeAuthPhone(payload.phone),
//   });

//   return res.data;
// }

// export async function verifyOtp(
//   payload: VerifyOtpPayload
// ): Promise<AuthResponse> {
//   const res = await api.post<AuthResponse>(ENDPOINTS.accounts.verifyOtp, {
//     ...payload,
//     phone: normalizeAuthPhone(payload.phone),
//     otp: String(payload.otp || "").trim(),
//   });

//   return res.data;
// }

// export async function loginUser(
//   payload: LoginPayload
// ): Promise<AuthResponse> {
//   const res = await api.post<AuthResponse>(ENDPOINTS.accounts.login, {
//     ...payload,
//     phone: normalizeAuthPhone(payload.phone),
//   });

//   await persistTokensFromResponse(res.data);

//   return res.data;
// }

// export async function forgotPassword(
//   payload: ForgotPasswordPayload
// ): Promise<AuthResponse> {
//   const res = await api.post<AuthResponse>(
//     ENDPOINTS.accounts.forgotPassword,
//     {
//       ...payload,
//       phone: normalizeAuthPhone(payload.phone),
//     }
//   );

//   return res.data;
// }

// export async function resetPassword(
//   payload: ResetPasswordPayload
// ): Promise<AuthResponse> {
//   const res = await api.post<AuthResponse>(
//     ENDPOINTS.accounts.resetPassword,
//     {
//       ...payload,
//       phone: normalizeAuthPhone(payload.phone),
//       otp: String(payload.otp || "").trim(),
//     }
//   );

//   await persistTokensFromResponse(res.data);

//   return res.data;
// }

// export async function resendOtp(
//   payload: ResendOtpPayload
// ): Promise<AuthResponse> {
//   const res = await api.post<AuthResponse>(ENDPOINTS.accounts.resendOtp, {
//     ...payload,
//     phone: normalizeAuthPhone(payload.phone),
//   });

//   return res.data;
// }