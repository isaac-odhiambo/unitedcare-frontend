// services/auth.ts
import { api, saveAuthTokens } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

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
  role?: string;
  status?: string;
  is_admin?: boolean;
  detail?: string;
  [key: string]: any;
};

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await api.post(ENDPOINTS.accounts.register, payload);
  return res.data;
}

export async function verifyOtp(payload: VerifyOtpPayload): Promise<AuthResponse> {
  const res = await api.post(ENDPOINTS.accounts.verifyOtp, payload);
  return res.data;
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const res = await api.post(ENDPOINTS.accounts.login, payload);

  if (res.data?.access) {
    await saveAuthTokens(res.data.access, res.data.refresh);
  }

  return res.data;
}

export async function forgotPassword(
  payload: ForgotPasswordPayload
): Promise<AuthResponse> {
  const res = await api.post(ENDPOINTS.accounts.forgotPassword, payload);
  return res.data;
}

export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<AuthResponse> {
  const res = await api.post(ENDPOINTS.accounts.resetPassword, payload);

  if (res.data?.access) {
    await saveAuthTokens(res.data.access, res.data.refresh);
  }

  return res.data;
}

export async function resendOtp(payload: ResendOtpPayload): Promise<AuthResponse> {
  const res = await api.post(ENDPOINTS.accounts.resendOtp, payload);
  return res.data;
}