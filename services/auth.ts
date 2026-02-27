// services/auth.ts
import { api, saveTokens } from "./api";

export async function loginUser(payload: { phone: string; password: string }) {
  const { data } = await api.post("/accounts/login/", payload);
  await saveTokens(data.access, data.refresh);
  return data;
}

export async function resetPassword(payload: { phone: string; otp: string; new_password: string }) {
  const { data } = await api.post("/accounts/reset-password/", payload);
  await saveTokens(data.access, data.refresh);
  return data;
}