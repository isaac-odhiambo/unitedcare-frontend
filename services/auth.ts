import { api, saveTokens } from "./api";

export async function registerUser(payload: {
  username: string;
  phone: string;
  password: string;
  id_number?: string;
}) {
  const { data } = await api.post("/accounts/register/", payload);
  return data;
}

export async function verifyOtp(payload: {
  phone: string;
  otp: string;
}) {
  const { data } = await api.post("/accounts/verify-otp/", payload);
  return data;
}

export async function loginUser(payload: {
  phone: string;
  password: string;
}) {
  const { data } = await api.post("/accounts/login/", payload);

  await saveTokens(data.access, data.refresh);

  return data;
}

export async function forgotPassword(payload: { phone: string }) {
  const { data } = await api.post("/accounts/forgot-password/", payload);
  return data;
}

export async function resetPassword(payload: {
  phone: string;
  otp: string;
  new_password: string;
}) {
  const { data } = await api.post("/accounts/reset-password/", payload);
  await saveTokens(data.access, data.refresh);
  return data;
}

// import { API } from "./api";
// import { storage } from "./storage";

// /* =========================
//    TYPES
// ========================= */

// export interface RegisterPayload {
//   phone: string;
//   username: string;
//   id_number?: string;
//   password: string;
// }

// export interface VerifyOTPPayload {
//   phone: string;
//   otp: string;
// }

// export interface LoginResponse {
//   access: string;
//   refresh: string;
//   role: string;
//   status: string;
// }

// /* =========================
//    REGISTER (SEND OTP)
// ========================= */
// export const registerUser = async (data: RegisterPayload) => {
//   const response = await API.post("/register/", data);
//   return response.data;
// };

// /* =========================
//    VERIFY OTP (ACTIVATE ACCOUNT)
// ========================= */
// export const verifyOtp = async (data: VerifyOTPPayload) => {
//   const response = await API.post("/verify-otp/", data);
//   return response.data;
// };

// /* =========================
//    LOGIN
// ========================= */
// export const loginUser = async (phone: string, password: string) => {
//   const response = await API.post<LoginResponse>("/login/", {
//     phone,
//     password,
//   });

//   // 🔐 Store JWT
//   await storage.set("access", response.data.access);
//   await storage.set("refresh", response.data.refresh);

//   return response.data;
// };

// /* =========================
//    FORGOT PASSWORD (SEND OTP)
// ========================= */
// export const forgotPassword = async (phone: string) => {
//   const response = await API.post("/forgot-password/", { phone });
//   return response.data;
// };

// /* =========================
//    RESET PASSWORD (AUTO LOGIN)
// ========================= */
// export const resetPassword = async (
//   phone: string,
//   otp: string,
//   newPassword: string
// ) => {
//   const response = await API.post<LoginResponse>("/reset-password/", {
//     phone,
//     otp,
//     new_password: newPassword,
//   });

//   // 🔑 Auto-login after reset
//   await storage.set("access", response.data.access);
//   await storage.set("refresh", response.data.refresh);

//   return response.data;
// };

// /* =========================
//    LOGOUT
// ========================= */
// export const logoutUser = async () => {
//   await storage.remove("access");
//   await storage.remove("refresh");
// };
// /* =========================
//    RESEND OTP
// ========================= */
// export const resendOtp = async (phone: string) => {
//   const response = await API.post("/resend-otp/", { phone });
//   return response.data;
// };
