// services/auth.ts
import { api, saveAuthTokens } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";
import type { SessionUser } from "@/services/session";

export type RegisterPayload = {
  username: string;
  phone: string;
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
  phone: string;
};

export type ResetPasswordPayload = {
  phone: string;
  otp: string;
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

export async function registerUser(
  payload: RegisterPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(ENDPOINTS.accounts.register, payload);
  return res.data;
}

export async function verifyOtp(
  payload: VerifyOtpPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(ENDPOINTS.accounts.verifyOtp, payload);
  return res.data;
}

export async function loginUser(
  payload: LoginPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(ENDPOINTS.accounts.login, payload);

  const access = res.data?.access;
  const refresh = res.data?.refresh;

  if (typeof access === "string" && access.split(".").length === 3) {
    await saveAuthTokens(access, refresh);
  }

  return res.data;
}

export async function forgotPassword(
  payload: ForgotPasswordPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(
    ENDPOINTS.accounts.forgotPassword,
    payload
  );
  return res.data;
}

export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(
    ENDPOINTS.accounts.resetPassword,
    payload
  );

  const access = res.data?.access;
  const refresh = res.data?.refresh;

  if (typeof access === "string" && access.split(".").length === 3) {
    await saveAuthTokens(access, refresh);
  }

  return res.data;
}

export async function resendOtp(
  payload: ResendOtpPayload
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(ENDPOINTS.accounts.resendOtp, payload);
  return res.data;
}