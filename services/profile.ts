import { api } from "@/services/api";

/* =========================================================
   Types
========================================================= */

export type UserRole = "admin" | "member" | string;
export type UserStatus =
  | "pending"
  | "approved"
  | "blocked"
  | "rejected"
  | string;

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
  has_limited_access?: boolean | null;
  has_full_access?: boolean | null;
  [key: string]: any;
};

export type UpdateMePayload = {
  username?: string;
  email?: string | null;
};

/* =========================================================
   Access Helpers
========================================================= */

export function isAdminUser(user?: Partial<MeResponse> | null): boolean {
  return !!user?.is_admin || user?.role === "admin";
}

export function isApprovedUser(user?: Partial<MeResponse> | null): boolean {
  return String(user?.status || "").toLowerCase() === "approved";
}

export function hasLimitedAccess(user?: Partial<MeResponse> | null): boolean {
  if (typeof user?.has_limited_access === "boolean") {
    return user.has_limited_access;
  }

  return (
    !!user?.is_active &&
    String(user?.status || "").toLowerCase() !== "blocked"
  );
}

export function hasFullAccess(user?: Partial<MeResponse> | null): boolean {
  if (typeof user?.has_full_access === "boolean") {
    return user.has_full_access;
  }

  return (
    !!user?.is_active &&
    String(user?.status || "").toLowerCase() === "approved"
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

/* =========================================================
   Error helper
========================================================= */

export function getApiErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (!data) {
    return error?.message || "Something went wrong.";
  }

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
  const res = await api.get<MeResponse>("/api/accounts/me/");
  return res.data;
}

export async function updateMe(
  payload: UpdateMePayload
): Promise<MeResponse> {
  const res = await api.patch<MeResponse>("/api/accounts/me/", payload);
  return res.data;
}