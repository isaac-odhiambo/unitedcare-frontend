import { API } from "./api";
import * as SecureStore from "expo-secure-store";

/* =========================
   TYPES (NEW)
========================= */

export interface RegisterPayload {
  phone: string;
  username: string;
  id_number: string;
  password: string;
}

export interface OTPPayload {
  phone: string;
  code: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  role: string;
}

/* =========================
   🔴 REGISTER (UPDATED)
   - removed email
   - uses phone + id_number
========================= */
export const registerUser = async (data: RegisterPayload) => {
  const response = await API.post("/register/", data);
  return response.data;
};

/* =========================
   🔴 VERIFY OTP (NEW)
========================= */
export const verifyOtp = async (data: OTPPayload) => {
  const response = await API.post("/verify-otp/", data);
  return response.data;
};

/* =========================
   🔴 RESEND OTP (NEW)
========================= */
export const resendOtp = async (phone: string) => {
  const response = await API.post("/resend-otp/", { phone });
  return response.data;
};

/* =========================
   🔴 LOGIN (UPDATED)
   - username → phone
   - saves JWT securely
========================= */
export const loginUser = async (phone: string, password: string) => {
  const response = await API.post<LoginResponse>("/login/", {
    phone,
    password,
  });

  // 🔐 SAVE TOKENS (NEW)
  await SecureStore.setItemAsync("access", response.data.access);
  await SecureStore.setItemAsync("refresh", response.data.refresh);

  return response.data;
};

/* =========================
   🔴 LOGOUT (OPTIONAL, NEW)
========================= */
export const logoutUser = async () => {
  await SecureStore.deleteItemAsync("access");
  await SecureStore.deleteItemAsync("refresh");
};
