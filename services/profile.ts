// services/profile.ts
import { api } from "@/services/api";

export type MeResponse = {
  username: string;
  phone: string;
  email?: string | null;
  role: string;
  status: string;
  is_admin?: boolean;
};

export async function getMe() {
  const res = await api.get("/api/accounts/me/");
  return res.data as MeResponse;
}

export async function updateMe(payload: Partial<Pick<MeResponse, "username" | "email">>) {
  const res = await api.patch("/api/accounts/me/", payload);
  return res.data as MeResponse;
}

export type KycPayload = {
  passport_photo: { uri: string; name?: string; type?: string };
  id_front: { uri: string; name?: string; type?: string };
  id_back: { uri: string; name?: string; type?: string };
};

function filePart(file: { uri: string; name?: string; type?: string }, fallbackName: string) {
  const name = file.name || fallbackName;
  const type = file.type || "image/jpeg";
  return { uri: file.uri, name, type } as any;
}

export async function submitKyc(payload: KycPayload) {
  const form = new FormData();
  form.append("passport_photo", filePart(payload.passport_photo, "passport.jpg"));
  form.append("id_front", filePart(payload.id_front, "id_front.jpg"));
  form.append("id_back", filePart(payload.id_back, "id_back.jpg"));

  const res = await api.post("/api/accounts/kyc/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}