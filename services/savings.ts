// services/savings.ts
// ------------------------------------------------------
// Savings accounts + history + manual deposit
// Aligned to confirmed backend routes/views
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
  entry_type?: "CREDIT" | "DEBIT" | string;
  txn_type?: "DEPOSIT" | "WITHDRAWAL" | "ADJUSTMENT" | "AUTO_DEDUCT" | string;
  amount: string;
  narration?: string | null;
  reference?: string | null;
  note?: string | null;
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

export type ManualDepositPayload = {
  account_id: number;
  amount: string | number;
  reference?: string;
  note?: string;
};

export type ManualDepositResponse = {
  message: string;
  account: SavingsAccount;
};

/* =========================================================
   Helpers
========================================================= */

function normalizeMoneyInput(value: string | number): string {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  const n = Number(raw);

  if (!raw || !Number.isFinite(n) || n <= 0) {
    throw new Error("Enter a valid amount.");
  }

  return n.toFixed(2);
}

function cleanText(value?: string | null): string {
  return String(value || "").trim();
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

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return String(data.non_field_errors[0]);
  }

  if (Array.isArray(data) && data.length) {
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
  if (status === 401) return "Unauthorized. Please login again.";
  if (status === 403) return "Access denied.";
  if (status === 404) return "Endpoint not found.";
  if (status === 405) return "Method not allowed.";
  if (status >= 500) return "Server error. Please try again later.";

  return "Request failed.";
}

/* =========================================================
   Accounts
========================================================= */

export async function listMySavingsAccounts(): Promise<SavingsAccount[]> {
  const res = await api.get(ENDPOINTS.savings.accounts);
  return Array.isArray(res.data) ? res.data : [];
}

export async function createSavingsAccount(
  payload: CreateSavingsAccountPayload
): Promise<SavingsAccount> {
  const body = {
    name: cleanText(payload.name),
    account_type: payload.account_type,
    locked_until: cleanText(payload.locked_until),
    target_amount:
      payload.target_amount !== undefined &&
      payload.target_amount !== null &&
      String(payload.target_amount).trim() !== ""
        ? normalizeMoneyInput(payload.target_amount)
        : undefined,
    target_deadline: cleanText(payload.target_deadline),
  };

  const res = await api.post(ENDPOINTS.savings.createAccount, body);
  return res.data;
}

/* =========================================================
   History
========================================================= */

export async function getSavingsAccountHistory(
  accountId: number
): Promise<SavingsAccountHistory> {
  const res = await api.get(ENDPOINTS.savings.history(accountId));
  return res.data;
}

export async function getSavingsHistoryRows(
  accountId: number
): Promise<SavingsHistoryRow[]> {
  const data = await getSavingsAccountHistory(accountId);
  return Array.isArray(data.transactions) ? data.transactions : [];
}

/* =========================================================
   Manual Deposit
   Note:
   - This endpoint is for manual/internal deposits only
   - MPESA STK savings deposit should use services/payments.ts
========================================================= */

export async function manualDepositToSavings(
  payload: ManualDepositPayload
): Promise<ManualDepositResponse> {
  const body = {
    account_id: Number(payload.account_id),
    amount: normalizeMoneyInput(payload.amount),
    reference: cleanText(payload.reference),
    note: cleanText(payload.note),
  };

  const res = await api.post(ENDPOINTS.savings.deposit, body);
  return res.data;
}