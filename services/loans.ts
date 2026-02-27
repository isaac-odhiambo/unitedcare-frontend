import { api } from "./api";

export type Loan = {
  id: number;
  borrower: number;
  status: string;
  principal: string;
  term_weeks: number;
  total_payable: string;
  total_paid: string;
  outstanding_balance: string;

  merry?: number | null;
  group?: number | null;
  product?: number;

  approved_at?: string | null;
  created_at?: string;
};

export type GuaranteeRequest = {
  id: number;
  loan: number;
  guarantor: number;
  accepted: boolean;
  accepted_at?: string | null;
};

export async function fetchMyLoans(): Promise<Loan[]> {
  const { data } = await api.get("/loans/myloans/");
  return data;
}

export async function requestLoan(payload: {
  product: number;
  principal: string | number;
  term_weeks: number;
  merry?: number | null;
  group?: number | null;
}) {
  const { data } = await api.post("/loans/request/", payload);
  return data;
}

export async function fetchLoanDetail(loanId: number): Promise<Loan> {
  const { data } = await api.get(`/loans/loan/${loanId}/`);
  return data;
}

export async function addGuarantor(payload: { loan: number; guarantor: number }) {
  const { data } = await api.post("/loans/loan/add-guarantor/", payload);
  return data;
}

export async function fetchMyGuaranteeRequests(): Promise<GuaranteeRequest[]> {
  const { data } = await api.get("/loans/guarantee/my-requests/");
  return data;
}

export async function acceptGuarantee(guarantorId: number) {
  const { data } = await api.patch(`/loans/guarantee/${guarantorId}/accept/`);
  return data;
}

export async function rejectGuarantee(guarantorId: number) {
  const { data } = await api.patch(`/loans/guarantee/${guarantorId}/reject/`);
  return data;
}

export async function approveLoan(loanId: number) {
  const { data } = await api.patch(`/loans/loan/${loanId}/approve/`);
  return data;
}

export async function payLoan(loanId: number, payload: { amount: string | number; method?: string; reference?: string }) {
  const { data } = await api.post(`/loans/loan/${loanId}/pay/`, payload);
  return data;
}