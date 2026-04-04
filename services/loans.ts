import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

/* =========================================================
   Types
========================================================= */

export type LoanStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "DEFAULTED"
  | "COMPLETED"
  | "CANCELLED"
  | "UNDER_REPAYMENT"
  | "DISBURSED"
  | string;

export type SimpleUser = {
  id: number;
  full_name: string;
};

export type LoanProduct = {
  id: number;
  name: string;
  interest_type: "FLAT" | "REDUCING" | string;
  annual_interest_rate: string;
  repayment_frequency: "WEEKLY" | "MONTHLY" | string;
  repayment_weekday: number;
  max_weeks: number;
  late_fee_rate_weekly: string;
  is_active: boolean;
  is_default?: boolean;
};

export type LoanGuarantor = {
  id: number;
  loan: number;
  guarantor: number;
  guarantor_detail?: SimpleUser;
  accepted: boolean;
  accepted_at?: string | null;
  reserved_amount?: string;
  request_note?: string;
  admin_note?: string;
  created_at?: string;
};

export type LoanSecurityAllocation = {
  id: number;
  loan: number;
  source_type:
    | "BORROWER_SAVINGS"
    | "BORROWER_GROUP_SHARE"
    | "BORROWER_MERRY_CREDIT"
    | "GUARANTOR_SAVINGS"
    | "GUARANTOR_GROUP_SHARE"
    | "GUARANTOR_MERRY_CREDIT"
    | string;
  owner_user: number;
  owner_detail?: SimpleUser;
  guarantor_link_id?: number | null;
  savings_account?: number | null;
  merry?: number | null;
  group?: number | null;
  amount: string;
  is_active: boolean;
  created_at?: string;
  released_at?: string | null;
};

export type LoanInstallment = {
  id: number;
  loan: number;
  installment_no: number;
  due_date: string;
  principal_due: string;
  interest_due: string;
  total_due: string;
  late_fee: string;
  paid_amount: string;
  is_paid: boolean;
};

export type LoanPayment = {
  id: number;
  loan: number;
  amount: string;
  paid_at: string;
  method: string;
  reference?: string | null;
};

export type Loan = {
  id: number;
  borrower: number;
  borrower_detail?: SimpleUser;

  product: number;
  product_detail?: LoanProduct;
  product_name?: string;

  principal: string;
  term_weeks: number;

  status: LoanStatus;
  is_defaulter?: boolean;

  approved_at?: string | null;
  rejected_at?: string | null;
  completed_at?: string | null;
  created_at?: string;

  total_payable?: string;
  total_paid?: string;
  outstanding_balance?: string;

  security_target?: string;
  security_reserved_total?: string;

  member_note?: string;
  admin_note?: string;

  guarantors?: LoanGuarantor[];
  security_allocations?: LoanSecurityAllocation[];
  installments?: LoanInstallment[];
  payments?: LoanPayment[];
};

export type LoanApiListResponse<T> =
  | T[]
  | {
      results?: T[];
      count?: number;
      next?: string | null;
      previous?: string | null;
    };

export type LoanEligibilityPreview = {
  eligible: boolean;
  max_allowed: string;
  available_savings: string;
  has_active_loan: boolean;
  missing_deposit_months: string[];
  reason: string;
};

export type LoanSecurityPreviewGuarantor = {
  guarantor_id: number;
  guarantor_name: string;
  available_security: string | number;
  used_security: string | number;
};

export type LoanSecurityPreview = {
  eligible: boolean;
  principal: string | number;

  borrower_savings: string | number;
  borrower_merry: string | number;
  borrower_group: string | number;
  borrower_total: string | number;

  guarantor_total: string | number;
  secured_total: string | number;
  shortfall: string | number;

  fully_secured: boolean;
  message: string;

  guarantors: LoanSecurityPreviewGuarantor[];
};

export type GuarantorCandidate = {
  id: number;
  full_name: string;
};

export type RequestLoanPayload = {
  principal: string;
  term_weeks: number;
  guarantor_ids?: number[];
  member_note?: string;
};

export type AddGuarantorPayload = {
  loan: number;
  guarantor: number;
  request_note?: string;
};

export type PayLoanPayload = {
  amount: string;
  method?: string;
  reference?: string;
};

export type PayLoanResponse = {
  message: string;
  loan_status: LoanStatus;
  total_paid: string;
  outstanding_balance: string;
};

/* =========================================================
   STK Repayment Types
========================================================= */

export type LoanRepaymentTx = {
  id: number;
  user_id?: number;
  phone: string;
  matched_user_phone?: string;

  amount: string;
  base_amount?: string | null;
  transaction_fee?: string | null;

  direction?: "IN" | "OUT" | string;
  channel?: "STK" | "C2B" | "B2C" | string;
  payment_method?: string;
  origin?: string;

  purpose?: string;
  status?: string;

  reference?: string;
  merchant_request_id?: string | null;
  checkout_request_id?: string | null;

  result_code?: string | number | null;
  result_desc?: string | null;

  mpesa_receipt_number?: string | null;
  transaction_date?: string | null;
  callback_received_at?: string | null;

  request_payload?: Record<string, any> | null;
  callback_payload?: Record<string, any> | null;

  allocation_status?: string;
  created_at?: string;
  updated_at?: string;
};

export type StkPushResponse = {
  message: string;
  tx: LoanRepaymentTx;
};

/**
 * IMPORTANT:
 * Backend canonical rule is:
 *   loan2 => loan repayment for borrower USER id 2
 *
 * So this payload uses borrower_user_id explicitly.
 * loan_id remains optional only for UI/display context.
 */
export type StkLoanRepaymentPayload = {
  phone: string;
  amount: string | number;
  borrower_user_id: number;
  loan_id?: number;
  reference?: string;
  narration?: string;
};

/* =========================================================
   Helpers
========================================================= */

function unwrapList<T>(data: LoanApiListResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function normalizeMoneyInput(value: string | number): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.replace(/,/g, "");
}

function normalizeKenyaPhone(phone: string): string {
  const clean = String(phone || "").replace(/\D/g, "");

  if (clean.startsWith("254") && clean.length === 12) return clean;
  if (clean.startsWith("0") && clean.length === 10) return `254${clean.slice(1)}`;

  return clean;
}

function cleanText(value?: string | null): string {
  return String(value || "").trim();
}

function toPositiveInt(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function buildLoanRepaymentReference(borrowerUserId: number | string): string {
  const userId = toPositiveInt(borrowerUserId);
  if (!userId) {
    throw new Error("A valid borrower user id is required to build loan reference.");
  }
  return `loan${userId}`;
}

export function buildLoanRepaymentNarration(input: {
  borrowerUserId: number | string;
  loanId?: number | string;
}): string {
  const borrowerUserId = toPositiveInt(input.borrowerUserId);
  const loanId = toPositiveInt(input.loanId);

  if (!borrowerUserId) {
    throw new Error("A valid borrower user id is required to build narration.");
  }

  if (loanId) {
    return `Loan repayment for borrower #${borrowerUserId} (Loan #${loanId})`;
  }

  return `Loan repayment for borrower #${borrowerUserId}`;
}

/* =========================================================
   Request builder
========================================================= */

export function buildLoanRequestPayload(input: {
  principal: string | number;
  term_weeks: number;
  guarantor_ids?: number[];
  member_note?: string;
}) {
  const principal = normalizeMoneyInput(input.principal);

  if (!principal || Number(principal) <= 0) {
    return {
      canSubmit: false,
      payload: null as RequestLoanPayload | null,
      error: "Enter a valid amount.",
    };
  }

  if (!input.term_weeks || Number(input.term_weeks) <= 0) {
    return {
      canSubmit: false,
      payload: null as RequestLoanPayload | null,
      error: "Enter a valid repayment period.",
    };
  }

  const payload: RequestLoanPayload = {
    principal,
    term_weeks: Number(input.term_weeks),
    guarantor_ids: Array.isArray(input.guarantor_ids)
      ? input.guarantor_ids
      : [],
    member_note: input.member_note ?? "",
  };

  return {
    canSubmit: true,
    payload,
    error: "",
  };
}

/* =========================================================
   Loans API
========================================================= */

export async function getMyLoans(): Promise<Loan[]> {
  const res = await api.get(ENDPOINTS.loans.myLoans);
  return unwrapList<Loan>(res.data);
}

export async function getLoanEligibilityPreview(): Promise<LoanEligibilityPreview> {
  const res = await api.get(ENDPOINTS.loans.eligibility);
  return res.data;
}

export async function getLoanSecurityPreview(payload: {
  principal: number;
  guarantor_ids?: number[];
}): Promise<LoanSecurityPreview> {
  const body = {
    principal: Number(payload.principal),
    guarantor_ids: Array.isArray(payload.guarantor_ids)
      ? payload.guarantor_ids
      : [],
  };

  const res = await api.post(ENDPOINTS.loans.securityPreview, body);
  return res.data;
}

export async function getGuarantorCandidates(
  query?: string
): Promise<GuarantorCandidate[]> {
  const res = await api.get(ENDPOINTS.loans.guarantorCandidates, {
    params: query?.trim() ? { q: query.trim() } : {},
  });
  return unwrapList<GuarantorCandidate>(res.data);
}

export async function requestLoan(
  payload: RequestLoanPayload
): Promise<{
  message: string;
  loan_id?: number;
  status?: LoanStatus;
  note?: string;
  loan: Loan;
}> {
  const body = {
    principal: normalizeMoneyInput(payload.principal),
    term_weeks: Number(payload.term_weeks),
    guarantor_ids: Array.isArray(payload.guarantor_ids)
      ? payload.guarantor_ids
      : [],
    member_note: payload.member_note ?? "",
  };

  const res = await api.post(ENDPOINTS.loans.request, body);
  return res.data;
}

export async function getLoanDetail(loanId: number | string): Promise<Loan> {
  const res = await api.get(ENDPOINTS.loans.detail(loanId));
  return res.data;
}

/* =========================================================
   Guarantors
========================================================= */

export async function addGuarantor(
  payload: AddGuarantorPayload
): Promise<{ message: string; guarantor: LoanGuarantor }> {
  const body = {
    loan: Number(payload.loan),
    guarantor: Number(payload.guarantor),
    request_note: payload.request_note ?? "",
  };

  const res = await api.post(ENDPOINTS.loans.addGuarantor, body);
  return res.data;
}

export async function getMyGuaranteeRequests(): Promise<LoanGuarantor[]> {
  const res = await api.get(ENDPOINTS.loans.myGuaranteeRequests);
  return unwrapList<LoanGuarantor>(res.data);
}

export async function acceptGuarantee(
  guarantorId: number | string
): Promise<{ message: string; note?: string }> {
  const res = await api.patch(ENDPOINTS.loans.acceptGuarantee(guarantorId));
  return res.data;
}

export async function rejectGuarantee(
  guarantorId: number | string
): Promise<{ message: string }> {
  const res = await api.patch(ENDPOINTS.loans.rejectGuarantee(guarantorId));
  return res.data;
}

/* =========================================================
   Admin approval
========================================================= */

export async function approveLoan(
  loanId: number | string
): Promise<{ message: string; loan: Loan }> {
  const res = await api.patch(ENDPOINTS.loans.approve(loanId));
  return res.data;
}

/* =========================================================
   Loan payments
========================================================= */

export async function payLoan(
  loanId: number | string,
  payload: PayLoanPayload
): Promise<PayLoanResponse & { note?: string }> {
  const body = {
    amount: normalizeMoneyInput(payload.amount),
    method: payload.method ?? "MANUAL",
    reference: payload.reference ?? "",
  };

  const res = await api.post(ENDPOINTS.loans.pay(loanId), body);
  return res.data;
}

/* =========================================================
   STK repayment
========================================================= */

export async function stkRepayLoan(
  payload: StkLoanRepaymentPayload
): Promise<StkPushResponse> {
  const borrowerUserId = toPositiveInt(payload.borrower_user_id);
  if (!borrowerUserId) {
    throw new Error("A valid borrower user id is required for STK loan repayment.");
  }

  const amount = normalizeMoneyInput(payload.amount);
  if (!amount || Number(amount) <= 0) {
    throw new Error("A valid repayment amount is required.");
  }

  const body = {
    phone: normalizeKenyaPhone(payload.phone),
    amount,
    purpose: "LOAN_REPAYMENT",
    reference:
      cleanText(payload.reference) ||
      buildLoanRepaymentReference(borrowerUserId),
    narration:
      cleanText(payload.narration) ||
      buildLoanRepaymentNarration({
        borrowerUserId,
        loanId: payload.loan_id,
      }),
  };

  const res = await api.post<StkPushResponse>(ENDPOINTS.payments.stkPush, body);
  return res.data;
}

/* =========================================================
   UI helpers
========================================================= */

export function canAddGuarantor(loan?: Loan | null) {
  if (!loan) return false;
  return loan.status === "PENDING" || loan.status === "UNDER_REVIEW";
}

export function canPayLoan(loan?: Loan | null) {
  if (!loan) return false;
  return (
    [
      "APPROVED",
      "ACTIVE",
      "DISBURSED",
      "UNDER_REPAYMENT",
      "DEFAULTED",
    ].includes(String(loan.status || "").toUpperCase()) &&
    Number(loan.outstanding_balance ?? "0") > 0
  );
}

export function isLoanComplete(loan?: Loan | null) {
  if (!loan) return false;
  return (
    String(loan.status || "").toUpperCase() === "COMPLETED" ||
    Number(loan.outstanding_balance ?? "0") <= 0
  );
}

export function getLoanSecuritySummary(loan?: Loan | null) {
  if (!loan) return "—";
  return loan.security_reserved_total
    ? `KES ${Number(loan.security_reserved_total).toLocaleString()} reserved`
    : "No reserved security";
}

/* =========================================================
   Error helper
========================================================= */

export function getApiErrorMessage(e: any) {
  const data = e?.response?.data;
  const status = e?.response?.status;

  if (!e?.response) {
    if (e?.code === "ECONNABORTED") {
      return "Request timed out. Please try again.";
    }
    return e?.message || "Network error. Check your internet and API URL.";
  }

  if (!data) return "Something went wrong.";

  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (Array.isArray(data) && data.length) return String(data[0]);

  if (typeof data === "object") {
    const firstKey = Object.keys(data)[0];
    const value = data[firstKey];

    if (Array.isArray(value) && value.length) return `${firstKey}: ${value[0]}`;
    if (typeof value === "string") return `${firstKey}: ${value}`;
  }

  if (status === 400) return "Invalid request. Please check your input.";
  if (status === 401) return "Unauthorized. Please login again.";
  if (status === 403) return "Access denied.";
  if (status === 404) return "Endpoint not found.";
  if (status === 405) return "Method not allowed.";
  if (status >= 500) return "Server error. Please try again later.";

  return e?.message || "Request failed.";
}