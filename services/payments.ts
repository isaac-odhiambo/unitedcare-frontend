// services/payments.ts
// ------------------------------------------------------
// Payments, STK push, ledger, withdrawals
// Centralized around ENDPOINTS from services/endpoints.ts
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
  amount: string;
  source: WithdrawalSource;
  status: WithdrawalStatus;

  created_at?: string;
  updated_at?: string;

  mpesa_tx?: MpesaTransaction | number | null;
};

/* =========================================================
   Payloads
========================================================= */

export type StkPushPayload = {
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
  phone: string;
  amount: string;
  source?: WithdrawalSource;
};

/* =========================================================
   Base API Functions
========================================================= */

export async function mpesaStkPush(
  payload: StkPushPayload
): Promise<StkPushResponse> {
  const res = await api.post(ENDPOINTS.payments.stkPush, {
    phone: payload.phone,
    amount: payload.amount,
    purpose: payload.purpose,
    reference: payload.reference ?? "",
    narration: payload.narration ?? "",
  });
  return res.data;
}

export async function getMyLedger(): Promise<PaymentLedgerEntry[]> {
  const res = await api.get(ENDPOINTS.payments.myLedger);
  return res.data;
}

export async function getAdminLedger(): Promise<PaymentLedgerEntry[]> {
  const res = await api.get(ENDPOINTS.payments.adminLedger);
  return res.data;
}

export async function getMyWithdrawals(): Promise<WithdrawalRequest[]> {
  const res = await api.get(ENDPOINTS.payments.myWithdrawals);
  return res.data;
}

export async function getAdminWithdrawals(): Promise<WithdrawalRequest[]> {
  const res = await api.get(ENDPOINTS.payments.adminWithdrawals);
  return res.data;
}

export async function requestWithdrawal(
  payload: RequestWithdrawalPayload
): Promise<{ message: string; withdrawal: WithdrawalRequest }> {
  const res = await api.post(ENDPOINTS.payments.requestWithdrawal, payload);
  return res.data;
}

export async function approveWithdrawal(
  withdrawalId: number
): Promise<{ message: string }> {
  const res = await api.post(ENDPOINTS.payments.approveWithdrawal(withdrawalId));
  return res.data;
}

export async function rejectWithdrawal(
  withdrawalId: number
): Promise<{ message: string }> {
  const res = await api.post(ENDPOINTS.payments.rejectWithdrawal(withdrawalId));
  return res.data;
}

export async function getAdminMpesaTransactions(): Promise<MpesaTransaction[]> {
  const res = await api.get(ENDPOINTS.payments.adminMpesa);
  return res.data;
}

/* =========================================================
   Convenience Wrappers
========================================================= */

/**
 * Savings deposit STK
 * reference is usually optional/blank for savings
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
 * backend expects reference like LOAN-<loan_id>
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
 * backend expects reference like GROUP-<group_id>
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
 * backend expects reference like MERRY-PAYMENT-<payment_id>
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