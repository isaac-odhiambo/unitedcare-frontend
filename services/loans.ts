import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

/* =========================================================
   Types (DRF-friendly)
========================================================= */

export type LoanStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "DEFAULTED"
  | "COMPLETED"
  | string;

export type Loan = {
  id: number;
  borrower: number;
  merry: number | null;
  group: number | null;
  product: number;

  principal: string;
  term_weeks: number;

  status: LoanStatus;

  created_at?: string;
  approved_at?: string | null;

  total_payable?: string;
  total_paid?: string;
  outstanding_balance?: string;

  is_defaulter?: boolean;

  borrower_reserved_savings?: string;
  borrower_reserved_merry_credit?: string;
  security_target?: string;
};

export type LoanGuarantor = {
  id: number;
  loan: number;
  guarantor: number;

  accepted: boolean;
  accepted_at?: string | null;

  reserved_amount?: string;
};

export type PayLoanResponse = {
  message: string;
  loan_status: LoanStatus;
  total_paid: string;
  outstanding_balance: string;
};

export type StkPushResponse = {
  message?: string;
  detail?: string;

  checkout_request_id?: string;
  merchant_request_id?: string;

  mpesa_tx_id?: number;
  status?: string;
};

/* =========================================================
   Payloads
========================================================= */

export type RequestLoanPayload = {
  merry?: number;
  group?: number;
  product: number;
  principal: string;
  term_weeks: number;
};

export type AddGuarantorPayload = {
  loan: number;
  guarantor: number;
};

export type PayLoanPayload = {
  amount: string;
  method?: string;
  reference?: string;
};

export type StkLoanRepaymentPayload = {
  phone: string;
  amount: string;
  loan_id: number;
  reference?: string;
};

/* =========================================================
   Loans API
========================================================= */

export async function getMyLoans(): Promise<Loan[]> {
  const res = await api.get(ENDPOINTS.loans.myLoans);
  return res.data;
}

export async function requestLoan(
  payload: RequestLoanPayload
): Promise<{ message: string; loan: Loan }> {
  const res = await api.post(ENDPOINTS.loans.request, payload);
  return res.data;
}

export async function getLoanDetail(loanId: number): Promise<Loan> {
  const res = await api.get(ENDPOINTS.loans.detail(loanId));
  return res.data;
}

export async function addGuarantor(
  payload: AddGuarantorPayload
): Promise<{ message: string; guarantor: LoanGuarantor }> {
  const res = await api.post(ENDPOINTS.loans.addGuarantor, payload);
  return res.data;
}

export async function getMyGuaranteeRequests(): Promise<LoanGuarantor[]> {
  const res = await api.get(ENDPOINTS.loans.myGuaranteeRequests);
  return res.data;
}

export async function acceptGuarantee(
  guarantorId: number
): Promise<{ message: string }> {
  const res = await api.post(ENDPOINTS.loans.acceptGuarantee(guarantorId));
  return res.data;
}

export async function rejectGuarantee(
  guarantorId: number
): Promise<{ message: string }> {
  const res = await api.post(ENDPOINTS.loans.rejectGuarantee(guarantorId));
  return res.data;
}

export async function approveLoan(
  loanId: number
): Promise<{ message: string; loan: Loan }> {
  const res = await api.post(ENDPOINTS.loans.approve(loanId));
  return res.data;
}

export async function payLoan(
  loanId: number,
  payload: PayLoanPayload
): Promise<PayLoanResponse> {
  const res = await api.post(ENDPOINTS.loans.pay(loanId), payload);
  return res.data;
}

/* =========================================================
   STK Repayment
========================================================= */

export async function stkRepayLoan(
  payload: StkLoanRepaymentPayload
): Promise<StkPushResponse> {
  const body = {
    phone: payload.phone,
    amount: payload.amount,
    purpose: "LOAN_REPAYMENT",
    reference: payload.reference ?? `LOAN-${payload.loan_id}`,
    loan_id: payload.loan_id,
  };

  const res = await api.post(ENDPOINTS.payments.stkPush, body);
  return res.data;
}

/* =========================================================
   Error helper
========================================================= */

export function getApiErrorMessage(e: any) {
  const data = e?.response?.data;

  if (!data) return "Something went wrong.";
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;

  if (typeof data === "object") {
    const k = Object.keys(data)[0];
    const v = (data as any)[k];
    if (Array.isArray(v) && v.length) return `${k}: ${v[0]}`;
    if (typeof v === "string") return `${k}: ${v}`;
  }

  return "Request failed.";
}
