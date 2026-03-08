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
   Accounts
========================================================= */

export async function listMySavingsAccounts(): Promise<SavingsAccount[]> {
  const res = await api.get(ENDPOINTS.savings.accounts);
  return Array.isArray(res.data) ? res.data : [];
}

export async function createSavingsAccount(
  payload: CreateSavingsAccountPayload
): Promise<SavingsAccount> {
  const res = await api.post(ENDPOINTS.savings.createAccount, payload);
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
  const res = await api.post(ENDPOINTS.savings.deposit, payload);
  return res.data;
}