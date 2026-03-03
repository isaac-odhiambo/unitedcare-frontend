// services/auth.ts
import { api, saveAuthTokens } from "@/services/api";

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

export async function registerUser(payload: RegisterPayload) {
  const res = await api.post("/api/accounts/register/", payload);
  return res.data;
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  const res = await api.post("/api/accounts/verify-otp/", payload);
  return res.data;
}

export async function loginUser(payload: LoginPayload) {
  const res = await api.post("/api/accounts/login/", payload);

  // Backend returns: access, refresh, role, status, is_admin
  if (res.data?.access) {
    await saveAuthTokens(res.data.access, res.data.refresh);
  }
  return res.data;
}

export async function forgotPassword(payload: ForgotPasswordPayload) {
  const res = await api.post("/api/accounts/forgot-password/", payload);
  return res.data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const res = await api.post("/api/accounts/reset-password/", payload);

  // Backend returns tokens too (auto login)
  if (res.data?.access) {
    await saveAuthTokens(res.data.access, res.data.refresh);
  }
  return res.data;
}
export type ResendOtpPayload = {
  phone: string;
};

export async function resendOtp(payload: ResendOtpPayload) {
  const res = await api.post("/api/accounts/resend-otp/", payload);
  return res.data;
}


// // services/auth.ts
// import { api, clearTokens, getErrorMessage, saveTokens } from "./api";

// export type LoginPayload = { phone: string; password: string };
// export type ResetPasswordPayload = {
//   phone: string;
//   otp: string;
//   new_password: string;
// };
// export type VerifyOtpPayload = { phone: string; otp: string };
// export type SendOtpPayload = { phone: string };

// async function maybeSaveTokens(data: any) {
//   // Works whether tokens are returned on login only OR also on verify/reset
//   if (data?.access && data?.refresh) {
//     await saveTokens(data.access, data.refresh);
//   }
// }

// export async function loginUser(payload: LoginPayload) {
//   try {
//     const { data } = await api.post("/accounts/login/", payload);
//     await maybeSaveTokens(data);
//     return data;
//   } catch (err) {
//     throw new Error(getErrorMessage(err));
//   }
// }

// export async function resetPassword(payload: ResetPasswordPayload) {
//   try {
//     const { data } = await api.post("/accounts/reset-password/", payload);
//     await maybeSaveTokens(data);
//     return data;
//   } catch (err) {
//     throw new Error(getErrorMessage(err));
//   }
// }

// // ✅ OTP verify endpoint (make sure your backend has this URL)
// export async function verifyOtp(payload: VerifyOtpPayload) {
//   try {
//     const { data } = await api.post("/accounts/verify-otp/", payload);
//     await maybeSaveTokens(data);
//     return data;
//   } catch (err) {
//     throw new Error(getErrorMessage(err));
//   }
// }

// // Optional: if you have these endpoints in backend, keep them.
// // If you don't, remove them or rename to match backend URLs.
// export async function sendOtp(payload: SendOtpPayload) {
//   try {
//     const { data } = await api.post("/accounts/send-otp/", payload);
//     return data;
//   } catch (err) {
//     throw new Error(getErrorMessage(err));
//   }
// }

// export async function resendOtp(payload: SendOtpPayload) {
//   try {
//     const { data } = await api.post("/accounts/resend-otp/", payload);
//     return data;
//   } catch (err) {
//     throw new Error(getErrorMessage(err));
//   }
// }

// export async function logout() {
//   await clearTokens();
// }