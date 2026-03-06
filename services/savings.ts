// services/savings.ts (COMPLETE + UPDATED to match your services/api.ts ENDPOINTS + wrappers)
// ----------------------------------------------------------------------------------------
// ✅ Uses ENDPOINTS.savings.* exactly as defined in services/api.ts
// ✅ Uses GET/POST wrappers + getErrorMessage for friendly errors
// ✅ Keeps MPESA deposits centralized in payments (recommended)
// ✅ Matches your backend show_urls patterns (accounts list, history list, statement pdf)
//
// NOTE ABOUT HISTORY:
// Your show_urls has: /api/savings/accounts/<account_id>/history/
// In many backends this returns a LIST of entries (not {account, transactions}).
// So this file supports BOTH shapes safely:
//  - If backend returns { account, transactions } => we normalize
//  - If backend returns an array => we return as-is for historyRows helper

import { ENDPOINTS, GET, POST, buildUrl, getErrorMessage } from "@/services/api";

/* =========================================================
   Types
========================================================= */
export type SavingsAccountType = "FLEXIBLE" | "FIXED" | "TARGET" | string;

export type SavingsAccount = {
  id: number;
  name: string;
  account_type: SavingsAccountType;

  balance: string; // "1234.00"
  reserved_amount: string; // "0.00"
  available_balance: string; // "1234.00"

  locked_until?: string | null;
  target_amount?: string | null;
  target_deadline?: string | null;

  is_active: boolean;
  created_at?: string;
};

// Generic ledger-ish row (works with many implementations)
export type SavingsHistoryRow = {
  id: number;

  // some backends call it entry_type CREDIT/DEBIT; others txn_type DEPOSIT/WITHDRAWAL
  entry_type?: "CREDIT" | "DEBIT" | string;
  txn_type?: "DEPOSIT" | "WITHDRAWAL" | "ADJUSTMENT" | "AUTO_DEDUCT" | string;

  amount: string; // "200.00"
  narration?: string | null;
  reference?: string | null;
  note?: string | null;

  created_at?: string;
};

// If your backend returns { account, transactions }
export type SavingsAccountHistory = {
  account: SavingsAccount;
  transactions: SavingsHistoryRow[];
};

export type SavingsWithdrawRequest = {
  id: number;
  account_id: number;
  amount: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID" | string;
  reason?: string | null;
  created_at: string;
  reviewed_at?: string | null;
};

/* =========================================================
   Helpers
========================================================= */
function errMsg(e: any, fallback: string) {
  const msg = getErrorMessage(e);
  return msg || fallback;
}

// Normalize history into rows regardless of backend shape
function normalizeHistoryRows(data: any): SavingsHistoryRow[] {
  if (Array.isArray(data)) return data as SavingsHistoryRow[];
  if (data && typeof data === "object" && Array.isArray(data.transactions)) {
    return data.transactions as SavingsHistoryRow[];
  }
  return [];
}

/* =========================================================
   Accounts
========================================================= */
export async function listMySavingsAccounts(): Promise<SavingsAccount[]> {
  try {
    const data = await GET<SavingsAccount[]>(ENDPOINTS.savings.accounts);
    return Array.isArray(data) ? data : [];
  } catch (e: any) {
    throw new Error(errMsg(e, "Failed to load savings accounts"));
  }
}

export async function createSavingsAccount(payload: {
  name: string;
  account_type: "FLEXIBLE" | "FIXED" | "TARGET" | string;

  // optional fields used by FIXED/TARGET depending on backend
  locked_until?: string; // YYYY-MM-DD (FIXED)
  target_amount?: string | number; // TARGET
  target_deadline?: string; // YYYY-MM-DD (TARGET)
}): Promise<SavingsAccount> {
  try {
    return await POST<SavingsAccount>(ENDPOINTS.savings.createAccount, payload);
  } catch (e: any) {
    throw new Error(errMsg(e, "Failed to create savings account"));
  }
}

/* =========================================================
   History
   - Your show_urls: /api/savings/accounts/<account_id>/history/
   - We support both response shapes safely
========================================================= */

// If your UI expects an ARRAY (most common)
export async function getSavingsHistoryRows(account_id: number): Promise<SavingsHistoryRow[]> {
  try {
    const data = await GET<any>(ENDPOINTS.savings.history(account_id));
    return normalizeHistoryRows(data);
  } catch (e: any) {
    throw new Error(errMsg(e, "Failed to load savings history"));
  }
}

// If your UI expects {account, transactions} (optional)
export async function getSavingsAccountHistory(
  account_id: number
): Promise<SavingsAccountHistory | null> {
  try {
    const data = await GET<any>(ENDPOINTS.savings.history(account_id));

    // If backend already returns { account, transactions }
    if (data && typeof data === "object" && data.account && Array.isArray(data.transactions)) {
      return data as SavingsAccountHistory;
    }

    // If backend returns a list only, return a normalized wrapper with minimal account
    // (account can be fetched separately if you later add an endpoint)
    if (Array.isArray(data)) {
      return {
        // minimal placeholder; keep your UI from crashing if it expects object shape
        account: {
          id: account_id,
          name: `Account #${account_id}`,
          account_type: "UNKNOWN",
          balance: "0.00",
          reserved_amount: "0.00",
          available_balance: "0.00",
          is_active: true,
        },
        transactions: data as SavingsHistoryRow[],
      };
    }

    return null;
  } catch (e: any) {
    throw new Error(errMsg(e, "Failed to load savings history"));
  }
}

/* =========================================================
   Statement PDF
   - use buildUrl so it works on mobile/web consistently
========================================================= */
export function savingsStatementPdfUrl(account_id: number) {
  return buildUrl(ENDPOINTS.savings.statementPdf(account_id));
}

/* =========================================================
   Deposits
   IMPORTANT:
   - Recommended: deposits go through PAYMENTS (STK Push) with purpose=SAVINGS_DEPOSIT
   - This endpoint exists for manual/internal deposit flows only
========================================================= */
export async function manualDepositToSavings(payload: {
  account_id: number;
  amount: string | number;
  reference?: string;
  note?: string;
}): Promise<any> {
  try {
    return await POST<any>(ENDPOINTS.savings.deposit, payload);
  } catch (e: any) {
    throw new Error(errMsg(e, "Deposit failed"));
  }
}

/* =========================================================
   Withdraw requests (Savings app endpoints)
   NOTE:
   - Your current payments screens already centralize withdrawals.
   - Keep these only if you want savings module to have its own withdraw flow.
========================================================= */
export async function createSavingsWithdrawRequest(payload: {
  account_id: number;
  amount: string | number;
  reason?: string;
}): Promise<SavingsWithdrawRequest> {
  try {
    return await POST<SavingsWithdrawRequest>(ENDPOINTS.savings.withdrawRequest, payload);
  } catch (e: any) {
    throw new Error(errMsg(e, "Withdraw request failed"));
  }
}

export async function listMySavingsWithdrawRequests(): Promise<SavingsWithdrawRequest[]> {
  try {
    const data = await GET<SavingsWithdrawRequest[]>(ENDPOINTS.savings.myWithdrawRequests);
    return Array.isArray(data) ? data : [];
  } catch (e: any) {
    throw new Error(errMsg(e, "Failed to load withdraw requests"));
  }
}

/* =========================================================
   Admin (Savings app endpoints)
========================================================= */
export async function adminApproveSavingsWithdraw(withdraw_id: number): Promise<any> {
  try {
    return await POST<any>(ENDPOINTS.savings.adminApproveWithdraw(withdraw_id), {});
  } catch (e: any) {
    throw new Error(errMsg(e, "Approve failed"));
  }
}

export async function adminRejectSavingsWithdraw(
  withdraw_id: number,
  payload?: { reason?: string }
): Promise<any> {
  try {
    return await POST<any>(ENDPOINTS.savings.adminRejectWithdraw(withdraw_id), payload ?? {});
  } catch (e: any) {
    throw new Error(errMsg(e, "Reject failed"));
  }
}

export async function adminPaySavingsWithdraw(withdraw_id: number): Promise<any> {
  try {
    return await POST<any>(ENDPOINTS.savings.adminPayWithdraw(withdraw_id), {});
  } catch (e: any) {
    throw new Error(errMsg(e, "Pay withdraw failed"));
  }
}

/* =========================================================
   Convenience for centralized payments flow (recommended)
   - Savings screens can trigger STK via payments
========================================================= */
export async function startSavingsDepositStk(payload: {
  phone: string;
  amount: string | number;
  narration?: string;
}): Promise<any> {
  try {
    return await POST<any>(ENDPOINTS.payments.stkPush, {
      phone: payload.phone,
      amount: payload.amount,
      purpose: "SAVINGS_DEPOSIT",
      reference: "", // optional
      narration: payload.narration || "Savings deposit",
    });
  } catch (e: any) {
    throw new Error(errMsg(e, "Failed to initiate STK deposit"));
  }
}