// services/loans.ts
import { api } from "@/services/api";

/* =========================================================
   Types (DRF friendly)
========================================================= */

export type LoanStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
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

/* =========================================================
   Payloads
========================================================= */

export type RequestLoanPayload = {
  merry?: number;
  group?: number;
  product: number;
  principal: string; // decimal as string
  term_weeks: number;
};

export type AddGuarantorPayload = {
  loan: number;
  guarantor: number;
};

export type PayLoanPayload = {
  amount: string; // decimal as string
  method?: string; // "MANUAL" | "MPESA" | ...
  reference?: string;
};

/* =========================================================
   API (matches loans/urls.py exactly)
========================================================= */

// ✅ GET /loans/myloans/
export async function getMyLoans(): Promise<Loan[]> {
  const res = await api.get("/loans/myloans/");
  return res.data;
}

// ✅ POST /loans/request/
export async function requestLoan(payload: RequestLoanPayload): Promise<{
  message: string;
  loan: Loan;
}> {
  const res = await api.post("/loans/request/", payload);
  return res.data;
}

// ✅ GET /loans/loan/<pk>/
export async function getLoanDetail(loanId: number): Promise<Loan> {
  const res = await api.get(`/loans/loan/${loanId}/`);
  return res.data;
}

// ✅ POST /loans/loan/add-guarantor/
export async function addGuarantor(payload: AddGuarantorPayload): Promise<{
  message: string;
  guarantor: LoanGuarantor;
}> {
  const res = await api.post("/loans/loan/add-guarantor/", payload);
  return res.data;
}

// ✅ GET /loans/guarantee/my-requests/
export async function getMyGuaranteeRequests(): Promise<LoanGuarantor[]> {
  const res = await api.get("/loans/guarantee/my-requests/");
  return res.data;
}

// ✅ PATCH /loans/guarantee/<guarantor_id>/accept/
export async function acceptGuarantee(guarantorId: number): Promise<{
  message: string;
}> {
  const res = await api.patch(`/loans/guarantee/${guarantorId}/accept/`);
  return res.data;
}

// ✅ PATCH /loans/guarantee/<guarantor_id>/reject/
export async function rejectGuarantee(guarantorId: number): Promise<{
  message: string;
}> {
  const res = await api.patch(`/loans/guarantee/${guarantorId}/reject/`);
  return res.data;
}

// ✅ PATCH /loans/loan/<loan_id>/approve/
export async function approveLoan(loanId: number): Promise<{
  message: string;
  loan: Loan;
}> {
  const res = await api.patch(`/loans/loan/${loanId}/approve/`);
  return res.data;
}

// ✅ POST /loans/loan/<loan_id>/pay/
export async function payLoan(
  loanId: number,
  payload: PayLoanPayload
): Promise<PayLoanResponse> {
  const res = await api.post(`/loans/loan/${loanId}/pay/`, payload);
  return res.data;
}

/* =========================================================
   Error helper (optional)
========================================================= */

export function getApiErrorMessage(e: any) {
  const data = e?.response?.data;

  if (!data) return "Something went wrong.";
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;

  if (typeof data === "object") {
    const k = Object.keys(data)[0];
    const v = data[k];
    if (Array.isArray(v) && v.length) return `${k}: ${v[0]}`;
    if (typeof v === "string") return `${k}: ${v}`;
  }

  return "Request failed.";
}