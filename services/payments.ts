// services/payments.ts
// ------------------------------------------------------
// Payments, STK push, ledger, withdrawals
// Centralized around ENDPOINTS from services/endpoints.ts
//
// FEE LOGIC (important):
// - Deposit / STK contribution screens should send BASE amount.
// - Backend may add a transaction fee on top for STK charges.
// - Withdrawal screens should send REQUESTED amount.
// - Backend may deduct withdrawal fee before final Mpesa payout.
// - Frontend should NOT hardcode fee calculations.
// - Ledger/history from backend is the source of truth.
// ------------------------------------------------------

import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

/* =========================================================
   Types
========================================================= */

export type MpesaTxStatus =
  | "INITIATED"
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT"
  | string;

export type MpesaPurpose =
  | "SAVINGS_DEPOSIT"
  | "MERRY_CONTRIBUTION"
  | "GROUP_CONTRIBUTION"
  | "LOAN_REPAYMENT"
  | "OTHER";

export type MpesaTransaction = {
  id: number;
  phone: string;

  /**
   * Backend stored transaction amount.
   * For STK this may be the TOTAL charged amount (base + fee),
   * depending on backend implementation.
   * For B2C this may be the NET payout amount.
   */
  amount: string;

  direction: "IN" | "OUT" | string;
  channel: "STK" | "B2C" | string;
  purpose: MpesaPurpose | string;
  status: MpesaTxStatus;

  reference?: string;

  merchant_request_id?: string | null;
  checkout_request_id?: string | null;

  conversation_id?: string | null;
  originator_conversation_id?: string | null;

  result_code?: string | null;
  result_desc?: string | null;

  mpesa_receipt_number?: string | null;
  transaction_date?: string | null;

  ledger_posted?: boolean;
  created_at?: string;
  updated_at?: string;

  /**
   * Optional future-proof fields.
   * If backend starts returning them, frontend can display them directly.
   */
  base_amount?: string | null;
  transaction_fee?: string | null;
  payout_amount?: string | null;
  requested_amount?: string | null;
};

export type LedgerEntryType = "CREDIT" | "DEBIT" | string;

export type LedgerCategory =
  | "SAVINGS"
  | "LOANS"
  | "MERRY"
  | "GROUP"
  | "WITHDRAWAL"
  | "WITHDRAWAL_FEE"
  | "TRANSACTION_FEE"
  | "OTHER"
  | string;

export type PaymentLedgerEntry = {
  id: number;
  entry_type: LedgerEntryType;
  category: LedgerCategory;
  amount: string;

  narration?: string;
  reference?: string;

  mpesa_tx?: MpesaTransaction | number | null;
  created_at?: string;
};

export type WithdrawalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | string;

export type WithdrawalSource =
  | "SAVINGS"
  | "MERRY"
  | "GROUP"
  | "OTHER"
  | string;

export type WithdrawalRequest = {
  id: number;
  phone: string;

  /**
   * Requested source amount.
   * Example: if user requests 5000 and fee is deducted from it,
   * payout may be less than this amount.
   */
  amount: string;

  source: WithdrawalSource;
  status: WithdrawalStatus;

  created_at?: string;
  updated_at?: string;

  mpesa_tx?: MpesaTransaction | number | null;

  /**
   * Optional future-proof fields for richer backend responses.
   */
  withdrawal_fee?: string | null;
  payout_amount?: string | null;
};

/* =========================================================
   Payloads
========================================================= */

export type StkPushPayload = {
  /**
   * BASE amount entered by user.
   * Backend may add transaction fee on top depending on fee config.
   */
  phone: string;
  amount: string;
  purpose: MpesaPurpose;
  reference?: string;
  narration?: string;
};

export type StkPushResponse = {
  message: string;
  tx: MpesaTransaction;
};

export type RequestWithdrawalPayload = {
  /**
   * REQUESTED source amount.
   * Backend may deduct withdrawal fee before actual Mpesa payout.
   */
  phone: string;
  amount: string;
  source?: WithdrawalSource;
};

export type ApproveWithdrawalResponse = {
  message: string;
  withdrawal?: WithdrawalRequest;
  mpesa_tx?: MpesaTransaction;
};

export type RejectWithdrawalResponse = {
  message: string;
  withdrawal?: WithdrawalRequest;
};

/* =========================================================
   Helpers
========================================================= */

export function money(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * For STK/deposit-like flows:
 * - user enters base amount
 * - backend may charge more than base because of fee
 */
export function getChargedAmount(tx?: MpesaTransaction | null): number {
  return Number(tx?.amount ?? 0) || 0;
}

export function getBaseAmount(tx?: MpesaTransaction | null): number {
  return Number(tx?.base_amount ?? tx?.requested_amount ?? tx?.amount ?? 0) || 0;
}

export function getTransactionFee(tx?: MpesaTransaction | null): number {
  if (tx?.transaction_fee != null) return Number(tx.transaction_fee) || 0;

  const total = Number(tx?.amount ?? 0) || 0;
  const base = Number(tx?.base_amount ?? tx?.requested_amount ?? 0) || 0;

  if (base > 0 && total >= base) return total - base;
  return 0;
}

/**
 * For withdrawals:
 * - amount may be the requested source amount
 * - payout_amount may be returned later by backend
 */
export function getRequestedWithdrawalAmount(
  withdrawal?: WithdrawalRequest | null
): number {
  return Number(withdrawal?.amount ?? 0) || 0;
}

export function getWithdrawalFee(withdrawal?: WithdrawalRequest | null): number {
  if (withdrawal?.withdrawal_fee != null) {
    return Number(withdrawal.withdrawal_fee) || 0;
  }
  return 0;
}

export function getNetWithdrawalPayout(
  withdrawal?: WithdrawalRequest | null
): number {
  if (withdrawal?.payout_amount != null) {
    return Number(withdrawal.payout_amount) || 0;
  }

  const requested = Number(withdrawal?.amount ?? 0) || 0;
  const fee = getWithdrawalFee(withdrawal);
  const net = requested - fee;
  return net > 0 ? net : 0;
}

export function isSuccessfulTxStatus(status?: string | null) {
  return ["SUCCESS", "PAID", "CONFIRMED"].includes(
    String(status || "").toUpperCase()
  );
}

export function isPendingTxStatus(status?: string | null) {
  return ["INITIATED", "PENDING", "PROCESSING"].includes(
    String(status || "").toUpperCase()
  );
}

export function isFailedTxStatus(status?: string | null) {
  return ["FAILED", "CANCELLED", "TIMEOUT", "REJECTED"].includes(
    String(status || "").toUpperCase()
  );
}

/* =========================================================
   Base API Functions
========================================================= */

export async function mpesaStkPush(
  payload: StkPushPayload
): Promise<StkPushResponse> {
  const res = await api.post(ENDPOINTS.payments.stkPush, {
    phone: payload.phone,
    amount: payload.amount, // BASE amount only
    purpose: payload.purpose,
    reference: payload.reference ?? "",
    narration: payload.narration ?? "",
  });
  return res.data;
}

export async function getMyLedger(): Promise<PaymentLedgerEntry[]> {
  const res = await api.get(ENDPOINTS.payments.myLedger);
  return Array.isArray(res.data) ? res.data : [];
}

export async function getAdminLedger(): Promise<PaymentLedgerEntry[]> {
  const res = await api.get(ENDPOINTS.payments.adminLedger);
  return Array.isArray(res.data) ? res.data : [];
}

export async function getMyWithdrawals(): Promise<WithdrawalRequest[]> {
  const res = await api.get(ENDPOINTS.payments.myWithdrawals);
  return Array.isArray(res.data) ? res.data : [];
}

export async function getAdminWithdrawals(): Promise<WithdrawalRequest[]> {
  const res = await api.get(ENDPOINTS.payments.adminWithdrawals);
  return Array.isArray(res.data) ? res.data : [];
}

export async function requestWithdrawal(
  payload: RequestWithdrawalPayload
): Promise<{ message: string; withdrawal: WithdrawalRequest }> {
  const res = await api.post(ENDPOINTS.payments.requestWithdrawal, payload);
  return res.data;
}

export async function approveWithdrawal(
  withdrawalId: number
): Promise<ApproveWithdrawalResponse> {
  const res = await api.patch(ENDPOINTS.payments.approveWithdrawal(withdrawalId), {});
  return res.data;
}

export async function rejectWithdrawal(
  withdrawalId: number,
  payload?: { rejection_reason?: string }
): Promise<RejectWithdrawalResponse> {
  const res = await api.patch(
    ENDPOINTS.payments.rejectWithdrawal(withdrawalId),
    payload ?? {}
  );
  return res.data;
}

export async function getAdminMpesaTransactions(): Promise<MpesaTransaction[]> {
  const res = await api.get(ENDPOINTS.payments.adminMpesa);
  return Array.isArray(res.data) ? res.data : [];
}

/* =========================================================
   Convenience Wrappers
========================================================= */

/**
 * Savings deposit STK
 * User enters desired credited amount.
 * Backend may add deposit transaction fee on top of the STK charge.
 */
export function stkDepositSavings(
  phone: string,
  amount: string,
  reference: string = ""
) {
  return mpesaStkPush({
    phone,
    amount,
    purpose: "SAVINGS_DEPOSIT",
    reference,
    narration: "Savings deposit",
  });
}

/**
 * Loan repayment STK
 * Backend expects reference like LOAN-<loan_id>.
 * Fee, if configured in backend later, should remain backend-controlled.
 */
export function stkRepayLoan(
  phone: string,
  amount: string,
  loanId: number
) {
  return mpesaStkPush({
    phone,
    amount,
    purpose: "LOAN_REPAYMENT",
    reference: `LOAN-${loanId}`,
    narration: `Loan repayment (Loan#${loanId})`,
  });
}

/**
 * Group contribution STK
 * Backend expects reference like GROUP-<group_id>.
 */
export function stkContributeGroup(
  phone: string,
  amount: string,
  groupId: number
) {
  return mpesaStkPush({
    phone,
    amount,
    purpose: "GROUP_CONTRIBUTION",
    reference: `GROUP-${groupId}`,
    narration: `Group contribution (Group#${groupId})`,
  });
}

/**
 * Merry contribution STK
 * Backend expects reference like MERRY-PAYMENT-<payment_id>.
 */
export function stkContributeMerryByPaymentId(
  phone: string,
  amount: string,
  merryPaymentId: number
) {
  return mpesaStkPush({
    phone,
    amount,
    purpose: "MERRY_CONTRIBUTION",
    reference: `MERRY-PAYMENT-${merryPaymentId}`,
    narration: `Merry contribution (Payment#${merryPaymentId})`,
  });
}

/* =========================================================
   Friendly Error Message
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