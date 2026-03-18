import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

/* =========================================================
   Types
========================================================= */

export type UserRole = "admin" | "member" | string;
export type UserStatus = "pending" | "approved" | "blocked" | "rejected" | string;
export type KycStatus =
  | "not_submitted"
  | "submitted"
  | "approved"
  | "rejected"
  | string
  | null;

export type MeResponse = {
  id?: number;

  username?: string;
  phone?: string;

  email?: string | null;
  id_number?: string | null;

  role?: UserRole;
  status?: UserStatus;

  is_active?: boolean;
  is_admin?: boolean;

  kyc_completed?: boolean | null;
  kyc_status?: KycStatus;
  is_kyc_approved?: boolean | null;

  has_limited_access?: boolean | null;
  has_full_access?: boolean | null;

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
  file?: File | null;
};

export type KycPayload = {
  passport_photo: KycFile;
  id_front: KycFile;
  id_back: KycFile;
};

export type KycResponse = {
  message?: string;
  detail?: string;
  kyc_status?: KycStatus;
  has_full_access?: boolean | null;
  user?: MeResponse;
  [key: string]: any;
};

/* =========================================================
   Helpers
========================================================= */

function appendKycFile(
  form: FormData,
  fieldName: string,
  file: KycFile,
  fallbackName: string
) {
  if (file.file) {
    form.append(fieldName, file.file, file.name || fallbackName);
    return;
  }

  form.append(fieldName, {
    uri: file.uri,
    name: file.name || fallbackName,
    type: file.type || "image/jpeg",
  } as any);
}

export function isAdminUser(user?: Partial<MeResponse> | null): boolean {
  return !!user?.is_admin || user?.role === "admin";
}

export function isApprovedUser(user?: Partial<MeResponse> | null): boolean {
  return String(user?.status || "").toLowerCase() === "approved";
}

export function isKycComplete(user?: Partial<MeResponse> | null): boolean {
  return (
    !!user?.is_kyc_approved ||
    !!user?.kyc_completed ||
    String(user?.kyc_status || "").toLowerCase() === "approved"
  );
}

export function hasLimitedAccess(user?: Partial<MeResponse> | null): boolean {
  if (typeof user?.has_limited_access === "boolean") {
    return user.has_limited_access;
  }

  return !!user?.is_active && String(user?.status || "").toLowerCase() !== "blocked";
}

export function hasFullAccess(user?: Partial<MeResponse> | null): boolean {
  if (typeof user?.has_full_access === "boolean") {
    return user.has_full_access;
  }

  return (
    !!user?.is_active &&
    String(user?.status || "").toLowerCase() === "approved" &&
    isKycComplete(user)
  );
}

export function canRequestLoan(user?: Partial<MeResponse> | null): boolean {
  return hasFullAccess(user);
}

export function canJoinGroup(user?: Partial<MeResponse> | null): boolean {
  return hasFullAccess(user);
}

export function canJoinMerry(user?: Partial<MeResponse> | null): boolean {
  return hasLimitedAccess(user);
}

export function canWithdraw(user?: Partial<MeResponse> | null): boolean {
  return hasFullAccess(user);
}

export function getApiErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (!data) return "Something went wrong.";
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;

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

export async function getMe(): Promise<MeResponse> {
  const res = await api.get<MeResponse>(ENDPOINTS.accounts.me);
  return res.data;
}

export async function updateMe(payload: UpdateMePayload): Promise<MeResponse> {
  const res = await api.patch<MeResponse>(ENDPOINTS.accounts.me, payload);
  return res.data;
}

/* =========================================================
   KYC
========================================================= */

export async function submitKyc(payload: KycPayload): Promise<KycResponse> {
  const form = new FormData();

  appendKycFile(form, "passport_photo", payload.passport_photo, "passport.jpg");
  appendKycFile(form, "id_front", payload.id_front, "id_front.jpg");
  appendKycFile(form, "id_back", payload.id_back, "id_back.jpg");

  const res = await api.post<KycResponse>(ENDPOINTS.accounts.kycSubmit, form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}