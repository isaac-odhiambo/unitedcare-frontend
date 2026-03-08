// services/profile.ts
import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

/* =========================================================
   Types
========================================================= */

export type UserRole = "admin" | "member" | string;
export type UserStatus = "pending" | "approved" | "blocked" | "rejected" | string;

export type MeResponse = {
  id?: number;
  username: string;
  phone: string;

  email?: string | null;
  id_number?: string | null;

  role: UserRole;
  status: UserStatus;

  is_admin?: boolean;

  // optional KYC fields depending on your serializer
  kyc_completed?: boolean;
  kyc_status?: string | null;

  [key: string]: any;
};

export type UpdateMePayload = {
  username?: string;
  email?: string | null;
};

export type KycFile = {
  uri: string;
  name?: string;
  type?: string;
};

export type KycPayload = {
  passport_photo: KycFile;
  id_front: KycFile;
  id_back: KycFile;
};

export type KycResponse = {
  message?: string;
  detail?: string;
  user?: MeResponse;
  [key: string]: any;
};

/* =========================================================
   Helpers
========================================================= */

function filePart(file: KycFile, fallbackName: string) {
  return {
    uri: file.uri,
    name: file.name || fallbackName,
    type: file.type || "image/jpeg",
  } as any;
}

export function isAdminUser(user?: Partial<MeResponse> | null): boolean {
  return !!user?.is_admin || user?.role === "admin";
}

export function isApprovedUser(user?: Partial<MeResponse> | null): boolean {
  return (user?.status || "").toLowerCase() === "approved";
}

export function isKycComplete(user?: Partial<MeResponse> | null): boolean {
  return (
    !!user?.kyc_completed ||
    (user?.kyc_status || "").toLowerCase() === "approved"
  );
}

export function canRequestLoan(user?: Partial<MeResponse> | null): boolean {
  return isApprovedUser(user) && isKycComplete(user);
}

export function canJoinGroup(user?: Partial<MeResponse> | null): boolean {
  return isApprovedUser(user) && isKycComplete(user);
}

export function canJoinMerry(user?: Partial<MeResponse> | null): boolean {
  return isApprovedUser(user);
}

export function canWithdraw(user?: Partial<MeResponse> | null): boolean {
  return isApprovedUser(user) && isKycComplete(user);
}

export function getApiErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (!data) return "Something went wrong.";
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;

  if (typeof data === "object") {
    const firstKey = Object.keys(data)[0];
    const firstValue = data?.[firstKey];

    if (Array.isArray(firstValue) && firstValue.length > 0) {
      return `${firstKey}: ${firstValue[0]}`;
    }

    if (typeof firstValue === "string") {
      return `${firstKey}: ${firstValue}`;
    }
  }

  return "Request failed.";
}

/* =========================================================
   Profile API
========================================================= */

// GET /api/accounts/me/
export async function getMe(): Promise<MeResponse> {
  const res = await api.get(ENDPOINTS.accounts.me);
  return res.data;
}

// PATCH /api/accounts/me/
export async function updateMe(payload: UpdateMePayload): Promise<MeResponse> {
  const res = await api.patch(ENDPOINTS.accounts.me, payload);
  return res.data;
}

/* =========================================================
   KYC
========================================================= */

// POST /api/accounts/kyc/
export async function submitKyc(payload: KycPayload): Promise<KycResponse> {
  const form = new FormData();

  form.append(
    "passport_photo",
    filePart(payload.passport_photo, "passport.jpg")
  );
  form.append("id_front", filePart(payload.id_front, "id_front.jpg"));
  form.append("id_back", filePart(payload.id_back, "id_back.jpg"));

  const res = await api.post(ENDPOINTS.accounts.kycSubmit, form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}