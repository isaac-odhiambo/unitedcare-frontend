// services/payments.ts
// ------------------------------------------------------
// Payments, STK push, ledger, withdrawals
// Centralized around ENDPOINTS from services/endpoints.ts
//
// BACKEND CONTRACT (confirmed):
// - STK endpoint expects: phone, amount, purpose, reference, narration
// - JWT Bearer token is required via api client
// - Frontend sends BASE amount for STK
// - Backend is source of truth for fee calculation
// - Manual paybill/C2B callback returns TOTAL amount paid
// - Frontend confirms paybill by polling member transaction endpoints
// - Backend transaction statuses include:
//   INITIATED, PENDING, SUCCESS, FAILED, CANCELLED, TIMEOUT, PROCESSING, PAID
// - Backend allocation statuses include:
//   UNALLOCATED, AUTO_ALLOCATED, PARTIALLY_ALLOCATED,
//   MANUAL_REVIEW, MANUALLY_ALLOCATED, INVALID_REFERENCE
//
// REFERENCE STANDARD:
// - saving19 => savings deposit for USER id 19
// - sav19    => savings deposit for USER id 19
// - loan19   => loan repayment for USER id 19
// - mus19    => merry contribution for USER id 19
// - grp9     => group contribution for GROUP id 9
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
  | "PROCESSING"
  | "PAID"
  | string;

export type MpesaAllocationStatus =
  | "UNALLOCATED"
  | "AUTO_ALLOCATED"
  | "PARTIALLY_ALLOCATED"
  | "MANUAL_REVIEW"
  | "MANUALLY_ALLOCATED"
  | "INVALID_REFERENCE"
  | string;

export type MpesaPurpose =
  | "SAVINGS_DEPOSIT"
  | "MERRY_CONTRIBUTION"
  | "GROUP_CONTRIBUTION"
  | "LOAN_REPAYMENT"
  | "OTHER";

export type MpesaConfig = {
  id: number;
  name: string;
  paybill_number?: string;
  business_number?: string;
  till_number?: string;
  is_active?: boolean;
  is_paybill_enabled?: boolean;
  is_till_enabled?: boolean;
  notes?: string;
  updated_at?: string;
};

export type MpesaTransaction = {
  id: number;
  user_id?: number;
  phone: string;
  matched_user_phone?: string;

  amount: string;
  base_amount?: string | null;
  transaction_fee?: string | null;
  payout_amount?: string | null;
  requested_amount?: string | null;

  direction: "IN" | "OUT" | string;
  channel: "STK" | "C2B" | "B2C" | string;
  payment_method?: string;
  origin?: string;
  purpose: MpesaPurpose | string;
  status: MpesaTxStatus;

  reference?: string;
  external_reference_raw?: string;
  matched_reference_type?: string;

  merchant_request_id?: string | null;
  checkout_request_id?: string | null;
  conversation_id?: string | null;
  originator_conversation_id?: string | null;

  result_code?: string | number | null;
  result_desc?: string | null;

  mpesa_receipt_number?: string | null;
  transaction_date?: string | null;
  callback_received_at?: string | null;

  request_payload?: Record<string, any> | null;
  callback_payload?: Record<string, any> | null;

  ledger_posted?: boolean;

  allocation_status?: MpesaAllocationStatus;
  allocation_notes?: string | null;
  allocated_by_id?: number | null;
  allocated_at?: string | null;

  created_at?: string;
  updated_at?: string;
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
  withdrawal_fee?: string | null;
  payout_amount?: string | null;
};

/* =========================================================
   Payloads / Queries
========================================================= */

export type StkPushPayload = {
  phone: string;
  amount: string | number; // BASE amount
  purpose?: MpesaPurpose;
  reference?: string;
  narration?: string;
};

export type StkPushResponse = {
  message: string;
  tx: MpesaTransaction;
};

export type RequestWithdrawalPayload = {
  phone: string;
  amount: string | number;
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

export type MyMpesaTxQuery = {
  status?: string;
  purpose?: string;
  reference?: string;
  allocation_status?: string;
  payment_method?: string;
  channel?: string;
  origin?: string;
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

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeKenyaPhone(phone: string): string {
  const clean = String(phone || "").replace(/\D/g, "");

  if (clean.startsWith("254") && clean.length === 12) return clean;
  if (clean.startsWith("0") && clean.length === 10) return `254${clean.slice(1)}`;

  return clean;
}

export function displayKenyaPhone(phone: string): string {
  const normalized = normalizeKenyaPhone(phone);
  if (/^254\d{9}$/.test(normalized)) return `0${normalized.slice(3)}`;
  return String(phone || "");
}

export function isLikelyKenyaMobile(phone: string): boolean {
  const normalized = normalizeKenyaPhone(phone);
  return /^254(7|1)\d{8}$/.test(normalized);
}

export function normalizeAmount(amount: string | number): string {
  const n = Number(amount);

  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Enter a valid amount.");
  }

  return n.toFixed(2);
}

export function cleanText(value?: string | null): string {
  return String(value || "").trim();
}

export function normalizePurpose(value?: string | null): MpesaPurpose {
  const raw = String(value || "")
    .trim()
    .toUpperCase();

  if (
    raw === "SAVINGS_DEPOSIT" ||
    raw === "MERRY_CONTRIBUTION" ||
    raw === "GROUP_CONTRIBUTION" ||
    raw === "LOAN_REPAYMENT" ||
    raw === "OTHER"
  ) {
    return raw;
  }

  return "SAVINGS_DEPOSIT";
}

export function getMpesaBusinessNumber(config?: MpesaConfig | null): string {
  return String(
    config?.business_number ||
      config?.paybill_number ||
      config?.till_number ||
      ""
  ).trim();
}

export function getMpesaPaybillNumber(config?: MpesaConfig | null): string {
  return String(config?.paybill_number || config?.business_number || "").trim();
}

export function getMpesaTillNumber(config?: MpesaConfig | null): string {
  return String(config?.till_number || "").trim();
}

export function isPaybillEnabled(config?: MpesaConfig | null): boolean {
  if (!config) return false;
  return (
    !!config.is_active &&
    !!config.is_paybill_enabled &&
    !!getMpesaPaybillNumber(config)
  );
}

export function isTillEnabled(config?: MpesaConfig | null): boolean {
  if (!config) return false;
  return !!config.is_active && !!config.is_till_enabled && !!getMpesaTillNumber(config);
}

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

export function getAllocationStatus(tx?: MpesaTransaction | null): string {
  return String(tx?.allocation_status ?? "");
}

export function isAllocationPending(tx?: MpesaTransaction | null): boolean {
  return ["UNALLOCATED", "MANUAL_REVIEW", "INVALID_REFERENCE"].includes(
    String(tx?.allocation_status || "").toUpperCase()
  );
}

export function isAllocationDone(tx?: MpesaTransaction | null): boolean {
  return ["AUTO_ALLOCATED", "MANUALLY_ALLOCATED", "PARTIALLY_ALLOCATED"].includes(
    String(tx?.allocation_status || "").toUpperCase()
  );
}

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
   Reference Builders
========================================================= */

export function buildSavingsReference(userId: number | string) {
  return `saving${Number(userId)}`;
}

export function buildSavingsShortReference(userId: number | string) {
  return `sav${Number(userId)}`;
}

export function buildLoanReference(userId: number | string) {
  return `loan${Number(userId)}`;
}

export function buildMerryReference(userId: number | string) {
  return `mus${Number(userId)}`;
}

export function buildGroupReference(groupId: number | string) {
  return `grp${Number(groupId)}`;
}

/* =========================================================
   Base API Functions
========================================================= */

export async function getActiveMpesaConfig(): Promise<MpesaConfig> {
  const res = await api.get<MpesaConfig>(ENDPOINTS.payments.mpesaConfig);
  return res.data;
}

export async function mpesaStkPush(
  payload: StkPushPayload
): Promise<StkPushResponse> {
  const normalizedPhone = normalizeKenyaPhone(payload.phone);

  if (!isLikelyKenyaMobile(normalizedPhone)) {
    throw new Error("Enter a valid Safaricom phone number.");
  }

  const body = {
    phone: normalizedPhone,
    amount: normalizeAmount(payload.amount), // base amount
    purpose: normalizePurpose(payload.purpose),
    reference: cleanText(payload.reference),
    narration: cleanText(payload.narration),
  };

  const res = await api.post<StkPushResponse>(ENDPOINTS.payments.stkPush, body);
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
  const res = await api.post(ENDPOINTS.payments.requestWithdrawal, {
    phone: normalizeKenyaPhone(payload.phone),
    amount: normalizeAmount(payload.amount),
    source: payload.source ?? "SAVINGS",
  });
  return res.data;
}

export async function approveWithdrawal(
  withdrawalId: number
): Promise<ApproveWithdrawalResponse> {
  const res = await api.patch(
    ENDPOINTS.payments.approveWithdrawal(withdrawalId),
    {}
  );
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
   Member Mpesa Transactions / Polling
========================================================= */

export async function getMyMpesaTransactions(
  query?: MyMpesaTxQuery
): Promise<MpesaTransaction[]> {
  const res = await api.get(ENDPOINTS.payments.myMpesaTransactions, {
    params: query ?? {},
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function getMyMpesaTransactionById(
  id: number
): Promise<MpesaTransaction> {
  const res = await api.get(ENDPOINTS.payments.myMpesaTransactionDetail(id));
  return res.data;
}

export async function findLatestMatchingMyMpesaTransaction(params: {
  purpose?: string;
  reference?: string;
  allocation_status?: string;
  payment_method?: string;
  channel?: string;
  origin?: string;
  amount?: string | number;
  phone?: string;
}): Promise<MpesaTransaction | null> {
  const items = await getMyMpesaTransactions({
    purpose: params.purpose,
    reference: params.reference,
    allocation_status: params.allocation_status,
    payment_method: params.payment_method,
    channel: params.channel,
    origin: params.origin,
  });

  const normalizedPhone = params.phone ? normalizeKenyaPhone(params.phone) : "";
  const normalizedAmount =
    params.amount != null ? Number(normalizeAmount(params.amount)) : null;

  const match = items.find((tx) => {
    const samePhone = normalizedPhone
      ? normalizeKenyaPhone(tx.phone || "") === normalizedPhone
      : true;

    // For paybill/C2B the backend stores amount as TOTAL paid amount.
    const txAmount = Number(tx.amount ?? 0) || 0;
    const sameAmount =
      normalizedAmount != null ? txAmount === normalizedAmount : true;

    return samePhone && sameAmount;
  });

  return match ?? null;
}

export async function pollMyMpesaTransactionById(
  id: number,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
    stopOnAllocated?: boolean;
  }
): Promise<MpesaTransaction> {
  const intervalMs = options?.intervalMs ?? 3000;
  const timeoutMs = options?.timeoutMs ?? 120000;
  const stopOnAllocated = options?.stopOnAllocated ?? false;

  const start = Date.now();
  let lastTx: MpesaTransaction | null = null;

  while (Date.now() - start < timeoutMs) {
    const tx = await getMyMpesaTransactionById(id);
    lastTx = tx;

    if (isFailedTxStatus(tx.status)) return tx;

    if (isSuccessfulTxStatus(tx.status)) {
      if (!stopOnAllocated) return tx;
      if (isAllocationDone(tx)) return tx;
    }

    await sleep(intervalMs);
  }

  if (lastTx) return lastTx;
  throw new Error("Timed out while checking payment status.");
}

export async function pollForMatchingManualPaybill(params: {
  purpose: string;
  reference: string;
  totalAmountPaid: string | number;
  phone?: string;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<MpesaTransaction | null> {
  const intervalMs = params.intervalMs ?? 5000;
  const timeoutMs = params.timeoutMs ?? 300000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const tx = await findLatestMatchingMyMpesaTransaction({
      purpose: params.purpose,
      reference: params.reference,
      payment_method: "PAYBILL",
      channel: "C2B",
      amount: params.totalAmountPaid,
      phone: params.phone,
    });

    if (tx && isSuccessfulTxStatus(tx.status)) {
      return tx;
    }

    await sleep(intervalMs);
  }

  return null;
}

/* =========================================================
   Convenience Wrappers
========================================================= */

export function stkPlainPayment(phone: string, amount: string | number) {
  return mpesaStkPush({
    phone,
    amount,
    purpose: "SAVINGS_DEPOSIT",
    reference: "",
    narration: "",
  });
}

export function stkDepositSavings(
  phone: string,
  amount: string | number,
  userId: number
) {
  return mpesaStkPush({
    phone,
    amount,
    purpose: "SAVINGS_DEPOSIT",
    reference: buildSavingsReference(userId),
    narration: "Savings deposit",
  });
}

export function stkRepayLoan(
  phone: string,
  amount: string | number,
  userId: number
) {
  return mpesaStkPush({
    phone,
    amount,
    purpose: "LOAN_REPAYMENT",
    reference: buildLoanReference(userId),
    narration: "Loan repayment",
  });
}

export function stkContributeGroup(
  phone: string,
  amount: string | number,
  groupId: number
) {
  return mpesaStkPush({
    phone,
    amount,
    purpose: "GROUP_CONTRIBUTION",
    reference: buildGroupReference(groupId),
    narration: `Group contribution (Group#${groupId})`,
  });
}

export function stkContributeMerryByUserId(
  phone: string,
  amount: string | number,
  userId: number
) {
  return mpesaStkPush({
    phone,
    amount,
    purpose: "MERRY_CONTRIBUTION",
    reference: buildMerryReference(userId),
    narration: "Merry contribution",
  });
}

export function stkContributeMerryByMerryId(
  phone: string,
  amount: string | number,
  userId: number
) {
  return stkContributeMerryByUserId(phone, amount, userId);
}

export function stkContributeMerryByPaymentId(
  phone: string,
  amount: string | number,
  merryPaymentId: number
) {
  return mpesaStkPush({
    phone,
    amount,
    purpose: "MERRY_CONTRIBUTION",
    reference: `MERRY-PAYMENT-${merryPaymentId}`,
    narration: "Merry contribution",
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