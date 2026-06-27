import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

/* =========================================================
   Types
========================================================= */

export type LoanStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DISBURSED"
  | "UNDER_REPAYMENT"
  | "REJECTED"
  | "DEFAULTED"
  | "COMPLETED"
  | "CANCELLED"
  | string;

export type LoanInstallmentStatus =
  | "PENDING"
  | "DUE_SOON"
  | "DUE_TODAY"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "DEFAULTED"
  | string;

export type LoanReminderType =
  | "BEFORE_DUE"
  | "DUE_TODAY"
  | "OVERDUE"
  | "DEFAULTED"
  | string;

export type LoanReminderChannel =
  | "SMS"
  | "EMAIL"
  | "PUSH"
  | "WHATSAPP"
  | "MANUAL"
  | string;

export type SimpleUser = {
  id: number;
  username?: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
};

export type LoanProduct = {
  id: number;
  name?: string;
  interest_type?: "FLAT" | "REDUCING" | string;
  annual_interest_rate?: string | number;
  repayment_frequency?: "WEEKLY" | "MONTHLY" | string;
  repayment_weekday?: number;
  max_weeks?: number;

  grace_period_days?: number;
  default_interest_rate_weekly?: string | number;

  /**
   * Kept for compatibility because old backend screens and services may still read it.
   * New default interest logic should use default_interest_rate_weekly.
   */
  late_fee_rate_weekly?: string | number;

  is_active?: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type LoanGuarantor = {
  id: number;
  loan?: number;
  guarantor?: number | SimpleUser | null;
  guarantor_detail?: SimpleUser;
  accepted?: boolean;
  accepted_at?: string | null;
  rejected_at?: string | null;
  reserved_amount?: string | number;
  request_note?: string;
  admin_note?: string;
  created_at?: string;
  updated_at?: string;
};

export type LoanSecurityAllocation = {
  id: number;
  loan?: number;
  source_type:
    | "BORROWER_SAVINGS"
    | "BORROWER_GROUP_SHARE"
    | "BORROWER_MERRY_CREDIT"
    | "GUARANTOR_SAVINGS"
    | "GUARANTOR_GROUP_SHARE"
    | "GUARANTOR_MERRY_CREDIT"
    | string;
  owner_user?: number | SimpleUser;
  owner_detail?: SimpleUser;
  guarantor_link_id?: number | null;
  savings_account?: number | null;
  merry?: number | null;
  group?: number | null;
  amount: string | number;
  is_active: boolean;
  created_at?: string;
  released_at?: string | null;
};

export type LoanInstallment = {
  id: number;
  loan?: number;
  installment_no: number;

  status?: LoanInstallmentStatus;
  due_date?: string | null;
  grace_ends_on?: string | null;
  default_interest_start_date?: string | null;

  principal_due?: string | number;
  interest_due?: string | number;
  total_due?: string | number;

  default_interest?: string | number;
  default_interest_weeks_applied?: number;
  last_default_interest_applied_at?: string | null;

  /**
   * Kept for compatibility because the model still keeps old late fee fields.
   */
  late_fee?: string | number;
  late_fee_weeks_applied?: number;

  paid_amount?: string | number;
  is_paid?: boolean;
  paid_at?: string | null;
  defaulted_at?: string | null;

  amount_due_now?: string | number;
  balance_remaining?: string | number;
  full_amount_due?: string | number;
  days_remaining?: number;
  days_overdue?: number;

  created_at?: string;
  updated_at?: string;
};

export type LoanPayment = {
  id: number;
  loan?: number;
  amount: string | number;
  paid_at?: string;
  created_at?: string;

  method?: string;
  reference?: string | null;

  applied_to_principal?: string | number;
  applied_to_interest?: string | number;
  applied_to_default_interest?: string | number;
  applied_to_late_fee?: string | number;
  excess_to_savings?: string | number;
};

export type LoanReminderLog = {
  id: number;
  loan?: number;
  installment?: number | LoanInstallment | null;
  borrower?: number | SimpleUser;
  borrower_detail?: SimpleUser;

  reminder_type: LoanReminderType;
  channel: LoanReminderChannel;

  days_remaining?: number;
  days_overdue?: number;

  message?: string;
  sent_by?: number | SimpleUser | null;
  sent_by_detail?: SimpleUser | null;
  sent_at?: string;

  was_successful?: boolean;
  failure_reason?: string;
};

export type Loan = {
  id: number;

  borrower?: number | SimpleUser;
  borrower_id?: number;
  borrower_detail?: SimpleUser;

  product?: number | LoanProduct | null;
  product_detail?: LoanProduct;
  product_name?: string;

  principal?: string | number;
  term_weeks?: number;

  status?: LoanStatus;
  is_defaulter?: boolean;

  requested_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  disbursed_at?: string | null;
  repayment_started_at?: string | null;
  defaulted_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;

  total_payable?: string | number;
  normal_interest_total?: string | number;
  default_interest_total?: string | number;
  late_fee_total?: string | number;
  total_paid?: string | number;
  outstanding_balance?: string | number;

  security_target?: string | number;
  security_reserved_total?: string | number;

  member_note?: string;
  admin_note?: string;
  rejection_reason?: string | null;

  amount_due_now?: string | number;
  days_remaining?: number;
  days_overdue?: number;
  next_unpaid_installment?: LoanInstallment | null;

  guarantors?: LoanGuarantor[];
  security_allocations?: LoanSecurityAllocation[];
  installments?: LoanInstallment[];
  payments?: LoanPayment[];
  reminder_logs?: LoanReminderLog[];
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
  max_allowed: string | number;
  available_savings: string | number;
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
  full_name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type RequestLoanPayload = {
  principal: string;
  term_weeks: number;
  guarantor_ids?: number[];
  member_note?: string;
};

export type RequestLoanResponse = {
  message: string;
  loan_id?: number;
  status?: LoanStatus;
  note?: string;
  loan: Loan;
};

export type AddGuarantorPayload = {
  loan: number;
  guarantor: number;
  request_note?: string;
};

export type AddGuarantorResponse = {
  message: string;
  note?: string;
  guarantor: LoanGuarantor;
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
  note?: string;
  loan?: Loan;
};

export type ApproveLoanResponse = {
  message: string;
  loan: Loan;
};

export type DisburseLoanResponse = {
  message: string;
  loan: Loan;
};

export type RejectLoanResponse = {
  message: string;
  note?: string;
  loan: Loan;
};

export type AdminLoansParams = {
  status?: LoanStatus | "ALL" | "";
  q?: string;
};

export type LoanReminderPreview = {
  loan_id?: number;
  borrower_id?: number;
  borrower_name?: string;
  installment?: LoanInstallment | null;
  reminder_type?: LoanReminderType;
  channel?: LoanReminderChannel;
  days_remaining?: number;
  days_overdue?: number;
  amount_due?: string | number;
  message?: string;
};

export type SendLoanReminderPayload = {
  installment_id?: number;
  channel?: LoanReminderChannel;
  message?: string;
  reminder_type?: LoanReminderType;
};

export type SendLoanReminderResponse = {
  message: string;
  reminder?: LoanReminderLog;
  preview?: LoanReminderPreview;
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
 * Backend canonical rule:
 * reference should identify the borrower user, not rely on loan pk.
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
   Endpoint helpers
========================================================= */

const loanEndpointMap = (ENDPOINTS.loans || {}) as any;

function loanEndpoint(
  name: string,
  fallback: string | ((...args: any[]) => string),
  ...args: any[]
): string {
  const candidate = loanEndpointMap?.[name];

  if (typeof candidate === "function") {
    return candidate(...args);
  }

  if (typeof candidate === "string") {
    return candidate;
  }

  if (typeof fallback === "function") {
    return fallback(...args);
  }

  return fallback;
}

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

function todayAtMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
  const d = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toNumber(value?: string | number | null): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function fmtKES(value?: string | number | null): string {
  const n = toNumber(value);
  return `KES ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getLoanBorrowerName(loan?: Loan | null): string {
  const borrower =
    typeof loan?.borrower === "object" && loan?.borrower
      ? loan.borrower
      : loan?.borrower_detail;

  if (!borrower) return "Member";

  const full =
    borrower.full_name?.trim() ||
    `${borrower.first_name || ""} ${borrower.last_name || ""}`.trim();

  return full || borrower.username || borrower.email || "Member";
}

export function getLoanProductName(loan?: Loan | null): string {
  if (!loan) return "Community Loan";

  if (loan.product_name) return loan.product_name;
  if (loan.product_detail?.name) return loan.product_detail.name;
  if (typeof loan.product === "object" && loan.product?.name) return loan.product.name;

  return "Community Loan";
}

export function getLoanBorrowerId(loan?: Loan | null): number {
  if (!loan) return 0;
  if (loan.borrower_id) return toPositiveInt(loan.borrower_id);
  if (typeof loan.borrower === "number") return toPositiveInt(loan.borrower);
  if (typeof loan.borrower === "object" && loan.borrower?.id) {
    return toPositiveInt(loan.borrower.id);
  }
  if (loan.borrower_detail?.id) return toPositiveInt(loan.borrower_detail.id);
  return 0;
}

export function buildLoanRepaymentReference(borrowerUserId: number | string): string {
  const userId = toPositiveInt(borrowerUserId);
  if (!userId) {
    throw new Error("A valid member id is required to build support reference.");
  }
  return `SUP${userId}`;
}

export function buildLoanRepaymentNarration(input: {
  borrowerUserId: number | string;
  loanId?: number | string;
}): string {
  const borrowerUserId = toPositiveInt(input.borrowerUserId);
  const loanId = toPositiveInt(input.loanId);

  if (!borrowerUserId) {
    throw new Error("A valid member id is required to build narration.");
  }

  if (loanId) {
    return `Community support contribution for member #${borrowerUserId} (Support #${loanId})`;
  }

  return `Community support contribution for member #${borrowerUserId}`;
}

/* =========================================================
   Loan calculation helpers for UI
========================================================= */

export function getInstallmentFullDue(inst?: LoanInstallment | null): number {
  if (!inst) return 0;

  const explicit =
    inst.amount_due_now ??
    inst.balance_remaining ??
    inst.full_amount_due ??
    null;

  if (explicit != null) return Math.max(0, toNumber(explicit));

  return Math.max(
    0,
    toNumber(inst.total_due) +
      toNumber(inst.default_interest) +
      toNumber(inst.late_fee) -
      toNumber(inst.paid_amount)
  );
}

export function getInstallmentBaseUnpaid(inst?: LoanInstallment | null): number {
  if (!inst) return 0;
  return Math.max(0, toNumber(inst.total_due) - toNumber(inst.paid_amount));
}

export function getInstallmentDaysRemaining(inst?: LoanInstallment | null): number {
  if (!inst || inst.is_paid) return 0;
  if (typeof inst.days_remaining === "number") return Math.max(0, inst.days_remaining);

  const due = parseDateOnly(inst.due_date);
  if (!due) return 0;

  const diff = Math.ceil((due.getTime() - todayAtMidnight().getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export function getInstallmentDaysOverdue(inst?: LoanInstallment | null): number {
  if (!inst || inst.is_paid) return 0;
  if (typeof inst.days_overdue === "number") return Math.max(0, inst.days_overdue);

  const due = parseDateOnly(inst.due_date);
  if (!due) return 0;

  const diff = Math.floor((todayAtMidnight().getTime() - due.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export function getNextUnpaidInstallment(loan?: Loan | null): LoanInstallment | null {
  if (!loan) return null;

  if (loan.next_unpaid_installment) {
    return loan.next_unpaid_installment;
  }

  const installments = Array.isArray(loan.installments) ? loan.installments : [];
  return (
    installments.find((inst) => {
      if (inst.is_paid) return false;
      return getInstallmentFullDue(inst) > 0 || toNumber(inst.total_due) > 0;
    }) || null
  );
}

export function getLoanAmountDueNow(loan?: Loan | null): number {
  if (!loan) return 0;

  if (loan.amount_due_now != null) {
    return Math.max(0, toNumber(loan.amount_due_now));
  }

  const next = getNextUnpaidInstallment(loan);
  if (next) return getInstallmentFullDue(next);

  return Math.max(0, toNumber(loan.outstanding_balance));
}

export function getLoanDaysRemaining(loan?: Loan | null): number {
  if (!loan) return 0;
  if (typeof loan.days_remaining === "number") return Math.max(0, loan.days_remaining);

  const next = getNextUnpaidInstallment(loan);
  return getInstallmentDaysRemaining(next);
}

export function getLoanDaysOverdue(loan?: Loan | null): number {
  if (!loan) return 0;
  if (typeof loan.days_overdue === "number") return Math.max(0, loan.days_overdue);

  const next = getNextUnpaidInstallment(loan);
  return getInstallmentDaysOverdue(next);
}

export function getInstallmentStatusLabel(inst?: LoanInstallment | null): string {
  if (!inst) return "Pending";

  const statusValue = String(inst.status || "").toUpperCase();
  if (statusValue === "PAID" || inst.is_paid) return "Paid";
  if (statusValue === "PARTIAL") return "Partly completed";
  if (statusValue === "DEFAULTED") return "Late";
  if (statusValue === "OVERDUE") return "Late";
  if (statusValue === "DUE_TODAY") return "Today";
  if (statusValue === "DUE_SOON") return "Soon";

  const overdue = getInstallmentDaysOverdue(inst);
  if (overdue > 0) return overdue >= 7 ? "Late" : "Late";

  const remaining = getInstallmentDaysRemaining(inst);
  if (remaining === 0 && inst.due_date) return "Today";
  if (remaining > 0 && remaining <= 3) return "Soon";

  return "Pending";
}

export function getLoanStatusLabel(loan?: Loan | null): string {
  const statusValue = String(loan?.status || "").toUpperCase();

  const map: Record<string, string> = {
    PENDING: "Pending review",
    UNDER_REVIEW: "Under review",
    APPROVED: "Approved",
    DISBURSED: "Released",
    UNDER_REPAYMENT: "In progress",
    DEFAULTED: "Late",
    COMPLETED: "Completed",
    REJECTED: "Not approved",
    CANCELLED: "Cancelled",
  };

  return map[statusValue] || "Support";
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
  const res = await api.get(loanEndpoint("myLoans", "loans/myloans/"));
  return unwrapList<Loan>(res.data);
}

export async function getLoanEligibilityPreview(): Promise<LoanEligibilityPreview> {
  const res = await api.get(loanEndpoint("eligibility", "loans/eligibility/"));
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

  const res = await api.post(
    loanEndpoint("securityPreview", "loans/security-preview/"),
    body
  );
  return res.data;
}

export async function getGuarantorCandidates(
  query?: string
): Promise<GuarantorCandidate[]> {
  const res = await api.get(
    loanEndpoint("guarantorCandidates", "loans/guarantor-candidates/"),
    {
      params: query?.trim() ? { q: query.trim() } : {},
    }
  );
  return unwrapList<GuarantorCandidate>(res.data);
}

export async function requestLoan(
  payload: RequestLoanPayload
): Promise<RequestLoanResponse> {
  const body = {
    principal: normalizeMoneyInput(payload.principal),
    term_weeks: Number(payload.term_weeks),
    guarantor_ids: Array.isArray(payload.guarantor_ids)
      ? payload.guarantor_ids
      : [],
    member_note: payload.member_note ?? "",
  };

  const res = await api.post(loanEndpoint("request", "loans/request/"), body);
  return res.data;
}

export async function getLoanDetail(loanId: number | string): Promise<Loan> {
  const res = await api.get(
    loanEndpoint("detail", (id) => `loans/loan/${id}/`, loanId)
  );
  return res.data;
}

/* =========================================================
   Admin loans
========================================================= */

export async function getAdminLoans(params?: AdminLoansParams): Promise<Loan[]> {
  const cleanedParams: Record<string, string> = {};

  if (params?.status && params.status !== "ALL") {
    cleanedParams.status = String(params.status);
  }

  if (params?.q?.trim()) {
    cleanedParams.q = params.q.trim();
  }

  const res = await api.get(loanEndpoint("adminLoans", "loans/admin/loans/"), {
    params: cleanedParams,
  });

  return unwrapList<Loan>(res.data);
}

export async function approveLoan(
  loanId: number | string
): Promise<ApproveLoanResponse> {
  const res = await api.patch(
    loanEndpoint("approve", (id) => `loans/loan/${id}/approve/`, loanId)
  );
  return res.data;
}

export async function disburseLoan(
  loanId: number | string
): Promise<DisburseLoanResponse> {
  const res = await api.patch(
    loanEndpoint("disburse", (id) => `loans/loan/${id}/disburse/`, loanId)
  );
  return res.data;
}

export async function rejectLoan(
  loanId: number | string,
  rejectionReason: string
): Promise<RejectLoanResponse> {
  const res = await api.patch(
    loanEndpoint("reject", (id) => `loans/loan/${id}/reject/`, loanId),
    {
      rejection_reason: rejectionReason,
    }
  );
  return res.data;
}

/* =========================================================
   Loan reminders
========================================================= */

export async function getLoanReminderPreview(
  loanId: number | string,
  installmentId?: number | string
): Promise<LoanReminderPreview> {
  const params =
    installmentId != null && String(installmentId).trim()
      ? { installment_id: String(installmentId) }
      : {};

  const res = await api.get(
    loanEndpoint(
      "reminderPreview",
      (id) => `loans/loan/${id}/reminder-preview/`,
      loanId
    ),
    { params }
  );

  return res.data;
}

export async function sendLoanReminder(
  loanId: number | string,
  payload: SendLoanReminderPayload = {}
): Promise<SendLoanReminderResponse> {
  const body = {
    installment_id: payload.installment_id,
    channel: payload.channel || "PUSH",
    message: payload.message ?? "",
    reminder_type: payload.reminder_type,
  };

  const res = await api.post(
    loanEndpoint(
      "sendReminder",
      (id) => `loans/loan/${id}/send-reminder/`,
      loanId
    ),
    body
  );

  return res.data;
}

export async function getLoanReminderLogs(
  loanId: number | string
): Promise<LoanReminderLog[]> {
  const res = await api.get(
    loanEndpoint("reminderLogs", (id) => `loans/loan/${id}/reminders/`, loanId)
  );
  return unwrapList<LoanReminderLog>(res.data);
}

/* =========================================================
   Guarantors
========================================================= */

export async function addGuarantor(
  payload: AddGuarantorPayload
): Promise<AddGuarantorResponse> {
  const body = {
    loan: Number(payload.loan),
    guarantor: Number(payload.guarantor),
    request_note: payload.request_note ?? "",
  };

  const res = await api.post(
    loanEndpoint("addGuarantor", "loans/loan/add-guarantor/"),
    body
  );
  return res.data;
}

export async function getMyGuaranteeRequests(): Promise<LoanGuarantor[]> {
  const res = await api.get(
    loanEndpoint("myGuaranteeRequests", "loans/guarantee/my-requests/")
  );
  return unwrapList<LoanGuarantor>(res.data);
}

export async function acceptGuarantee(
  guarantorId: number | string
): Promise<{ message: string; note?: string }> {
  const res = await api.patch(
    loanEndpoint(
      "acceptGuarantee",
      (id) => `loans/guarantee/${id}/accept/`,
      guarantorId
    )
  );
  return res.data;
}

export async function rejectGuarantee(
  guarantorId: number | string
): Promise<{ message: string }> {
  const res = await api.patch(
    loanEndpoint(
      "rejectGuarantee",
      (id) => `loans/guarantee/${id}/reject/`,
      guarantorId
    )
  );
  return res.data;
}

/* =========================================================
   Loan payments
========================================================= */

export async function payLoan(
  loanId: number | string,
  payload: PayLoanPayload
): Promise<PayLoanResponse> {
  const body = {
    amount: normalizeMoneyInput(payload.amount),
    method: payload.method ?? "MANUAL",
    reference: payload.reference ?? "",
  };

  const res = await api.post(
    loanEndpoint("pay", (id) => `loans/loan/${id}/pay/`, loanId),
    body
  );
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
    throw new Error("A valid member id is required for this contribution.");
  }

  const amount = normalizeMoneyInput(payload.amount);
  if (!amount || Number(amount) <= 0) {
    throw new Error("A valid amount is required.");
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
  const s = String(loan.status || "").toUpperCase();
  return s === "PENDING" || s === "UNDER_REVIEW";
}

export function canApproveLoan(loan?: Loan | null) {
  if (!loan) return false;
  const s = String(loan.status || "").toUpperCase();
  return s === "PENDING" || s === "UNDER_REVIEW";
}

export function canDisburseLoan(loan?: Loan | null) {
  if (!loan) return false;
  return String(loan.status || "").toUpperCase() === "APPROVED";
}

export function canRejectLoan(loan?: Loan | null) {
  if (!loan) return false;
  const s = String(loan.status || "").toUpperCase();
  return s === "PENDING" || s === "UNDER_REVIEW" || s === "APPROVED";
}

export function canSendLoanReminder(loan?: Loan | null) {
  if (!loan) return false;
  const s = String(loan.status || "").toUpperCase();
  return ["APPROVED", "DISBURSED", "UNDER_REPAYMENT", "DEFAULTED"].includes(s);
}

export function canPayLoan(loan?: Loan | null) {
  if (!loan) return false;
  return (
    ["APPROVED", "DISBURSED", "UNDER_REPAYMENT", "DEFAULTED"].includes(
      String(loan.status || "").toUpperCase()
    ) && toNumber(loan.outstanding_balance) > 0
  );
}

export function isLoanComplete(loan?: Loan | null) {
  if (!loan) return false;
  return (
    String(loan.status || "").toUpperCase() === "COMPLETED" ||
    toNumber(loan.outstanding_balance) <= 0
  );
}

export function getLoanSecuritySummary(loan?: Loan | null) {
  if (!loan) return "—";
  return loan.security_reserved_total != null
    ? `KES ${toNumber(loan.security_reserved_total).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} reserved cover`
    : "No reserved cover";
}

export function getLoanDefaultSummary(loan?: Loan | null) {
  if (!loan) return "No late addition";
  const defaultInterest = toNumber(loan.default_interest_total);
  if (defaultInterest <= 0) return "No late addition";
  return `${fmtKES(defaultInterest)} late addition`;
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
