// services/savings.ts
// ------------------------------------------------------
// Savings service
// App policy:
// - User has only ONE savings account in the frontend experience
// - Savings wallet is auto-created for simplicity
// - STK deposit / withdrawal are centralized in payments flow
// - This file handles savings account fetch/create/history helpers
// ------------------------------------------------------

import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

/* =========================================================
   Types
========================================================= */

export type SavingsAccountType = "FLEXIBLE" | "FIXED" | "TARGET" | string;

export type SavingsAccount = {
  id: number;
  name: string;
  account_type: SavingsAccountType;
  balance: string;
  reserved_amount: string;
  available_balance: string;
  locked_until?: string | null;
  target_amount?: string | null;
  target_deadline?: string | null;
  is_active: boolean;
  created_at?: string;
};

export type SavingsHistoryRow = {
  id: number;
  txn_type?: "DEPOSIT" | "WITHDRAWAL" | "ADJUSTMENT" | "AUTO_DEDUCT" | string;
  amount: string;
  reference?: string | null;
  note?: string | null;
  narration?: string | null;
  created_at?: string;
};

export type SavingsAccountHistory = {
  account: SavingsAccount;
  transactions: SavingsHistoryRow[];
};

export type CreateSavingsAccountPayload = {
  name: string;
  account_type: SavingsAccountType;
  locked_until?: string;
  target_amount?: string | number;
  target_deadline?: string;
};

/* =========================================================
   Helpers
========================================================= */

function cleanText(value?: string | null): string {
  return String(value || "").trim();
}

function normalizeMoneyInput(value: string | number): string {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  const n = Number(raw);

  if (!raw || !Number.isFinite(n) || n <= 0) {
    throw new Error("Enter a valid amount.");
  }

  return n.toFixed(2);
}

function safeArray<T>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

export function getApiErrorMessage(error: any): string {
  const data = error?.response?.data;
  const status = error?.response?.status;

  if (!error?.response) {
    if (error?.code === "ECONNABORTED") {
      return "Request timed out. Please try again.";
    }
    return error?.message || "Network error. Check your internet and API URL.";
  }

  if (!data) return "Something went wrong.";
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;

  if (
    Array.isArray(data?.non_field_errors) &&
    data.non_field_errors.length > 0
  ) {
    return String(data.non_field_errors[0]);
  }

  if (Array.isArray(data) && data.length > 0) {
    return String(data[0]);
  }

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

  if (status === 400) return "Invalid request. Please check your input.";
  if (status === 401) return "Unauthorized. Please log in again.";
  if (status === 403) return "Access denied.";
  if (status === 404) return "Savings resource not found.";
  if (status === 405) return "Method not allowed.";
  if (status >= 500) return "Server error. Please try again later.";

  return "Request failed.";
}

/* =========================================================
   Savings account helpers
   Frontend policy = one main savings account
========================================================= */

export function getSingleSavingsAccount(
  accounts: SavingsAccount[]
): SavingsAccount | null {
  const list = safeArray<SavingsAccount>(accounts);

  if (!list.length) return null;

  const activeFlexible = list.find(
    (item) =>
      item?.is_active &&
      String(item?.account_type).toUpperCase() === "FLEXIBLE"
  );
  if (activeFlexible) return activeFlexible;

  const activeAny = list.find((item) => item?.is_active);
  if (activeAny) return activeAny;

  return list[0] || null;
}

export function hasSavingsAccount(accounts: SavingsAccount[]): boolean {
  return !!getSingleSavingsAccount(accounts);
}

export function isSavingsLocked(account?: SavingsAccount | null): boolean {
  if (!account) return false;

  if (String(account.account_type).toUpperCase() !== "FIXED") {
    return false;
  }

  if (!account.locked_until) return false;

  const today = new Date();
  const lockDate = new Date(account.locked_until);

  today.setHours(0, 0, 0, 0);
  lockDate.setHours(0, 0, 0, 0);

  return lockDate.getTime() > today.getTime();
}

export function getSavingsLockMessage(
  account?: SavingsAccount | null
): string {
  if (!account) return "";
  if (!isSavingsLocked(account)) return "";

  return account.locked_until
    ? `Locked until ${account.locked_until}`
    : "This savings account is currently locked.";
}

export function getSavingsProgress(
  account?: SavingsAccount | null
): number | null {
  if (!account) return null;
  if (String(account.account_type).toUpperCase() !== "TARGET") return null;
  if (!account.target_amount) return null;

  const balance = Number(account.balance || 0);
  const target = Number(account.target_amount || 0);

  if (!Number.isFinite(target) || target <= 0) return null;

  const progress = balance / target;
  return Math.max(0, Math.min(progress, 1));
}

/**
 * Payments backend currently accepts savings references like:
 * - saving23
 * - sav23
 * - or blank
 *
 * Frontend standard here is: saving<accountId>
 */
export function buildSavingsReference(accountId: number | string): string {
  const id = String(accountId ?? "").trim();
  if (!id) return "";
  return `saving${id}`;
}

/* =========================================================
   Accounts
========================================================= */

export async function listMySavingsAccounts(): Promise<SavingsAccount[]> {
  const res = await api.get(ENDPOINTS.savings.accounts);
  return safeArray<SavingsAccount>(res.data);
}

export async function getMySavingsAccount(): Promise<SavingsAccount | null> {
  const accounts = await listMySavingsAccounts();
  return getSingleSavingsAccount(accounts);
}

export async function createSavingsAccount(
  payload: CreateSavingsAccountPayload
): Promise<SavingsAccount> {
  const body = {
    name: cleanText(payload.name),
    account_type: cleanText(payload.account_type),
    locked_until: cleanText(payload.locked_until) || undefined,
    target_amount:
      payload.target_amount !== undefined &&
      payload.target_amount !== null &&
      String(payload.target_amount).trim() !== ""
        ? normalizeMoneyInput(payload.target_amount)
        : undefined,
    target_deadline: cleanText(payload.target_deadline) || undefined,
  };

  const res = await api.post(ENDPOINTS.savings.createAccount, body);
  return res.data;
}

export async function getOrCreateDefaultSavingsAccount(): Promise<SavingsAccount> {
  const existing = await getMySavingsAccount();
  if (existing) return existing;

  return await createSavingsAccount({
    name: "My Savings",
    account_type: "FLEXIBLE",
  });
}

/* =========================================================
   History
========================================================= */

export async function getSavingsAccountHistory(
  accountId: number
): Promise<SavingsAccountHistory> {
  const res = await api.get(ENDPOINTS.savings.history(accountId));

  return {
    account: res?.data?.account,
    transactions: safeArray<SavingsHistoryRow>(res?.data?.transactions),
  };
}

export async function getMySavingsHistory(): Promise<SavingsAccountHistory | null> {
  const account = await getMySavingsAccount();
  if (!account?.id) return null;

  return await getSavingsAccountHistory(account.id);
}

export async function getMySavingsHistoryRows(): Promise<SavingsHistoryRow[]> {
  const data = await getMySavingsHistory();
  return safeArray<SavingsHistoryRow>(data?.transactions);
}

/* =========================================================
   Centralized payments integration helpers
========================================================= */

export type SavingsPaymentContext = {
  accountId: number;
  reference: string;
  title: string;
  subtitle?: string;
};

export async function getSavingsPaymentContext(): Promise<SavingsPaymentContext | null> {
  const account = await getMySavingsAccount();
  if (!account) return null;

  return {
    accountId: account.id,
    reference: buildSavingsReference(account.id),
    title: account.name || "Savings",
    subtitle: "Personal savings",
  };
}

/* =========================================================
   Optional display helpers
========================================================= */

export function getSavingsTypeLabel(type?: SavingsAccountType): string {
  const value = String(type || "").toUpperCase();

  if (value === "FLEXIBLE") return "Flexible Savings";
  if (value === "FIXED") return "Fixed Savings";
  if (value === "TARGET") return "Target Savings";

  return "Savings";
}

export function canShowWithdrawAction(
  account?: SavingsAccount | null
): boolean {
  if (!account) return false;
  if (!account.is_active) return false;
  if (isSavingsLocked(account)) return false;

  const available = Number(account.available_balance || 0);
  return Number.isFinite(available) && available > 0;
}