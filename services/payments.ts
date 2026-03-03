import { api } from "@/services/api";

export type LedgerEntry = {
  id: number;
  user?: number;
  user_phone?: string | null;
  user_username?: string | null;
  entry_type: "CREDIT" | "DEBIT";
  category: "SAVINGS" | "LOANS" | "MERRY" | "WITHDRAWAL" | "OTHER";
  amount: string; // DRF decimal string
  narration: string;
  reference: string;
  created_at: string;
  mpesa: null | {
    id: number;
    status: string;
    receipt: string | null;
    channel: string;
    direction: string;
    phone: string;
  };
};

export type Withdrawal = {
  id: number;
  user: number;
  user_phone?: string | null;
  user_username?: string | null;
  phone: string;
  amount: string;
  source: "SAVINGS" | "MERRY" | "OTHER";
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED";
  rejection_reason?: string | null;
  approved_by?: number | null;
  approved_by_username?: string | null;
  approved_at?: string | null;
  rejected_by?: number | null;
  rejected_by_username?: string | null;
  rejected_at?: string | null;
  created_at: string;
  updated_at: string;
  mpesa?: null | {
    id: number;
    status: string;
    channel: string;
    receipt: string | null;
    result_desc?: string | null;
  };
};

export type MpesaTx = {
  id: number;
  user: number | null;
  user_phone?: string | null;
  user_username?: string | null;
  phone: string;
  amount: string;
  direction: "IN" | "OUT";
  channel: "STK" | "B2C" | "C2B";
  purpose: string;
  status: string;
  merchant_request_id?: string | null;
  checkout_request_id?: string | null;
  conversation_id?: string | null;
  originator_conversation_id?: string | null;
  result_code?: string | null;
  result_desc?: string | null;
  mpesa_receipt_number?: string | null;
  transaction_date?: string | null;
  created_at: string;
  updated_at: string;
};

const base = "/payments"; // adjust if your root is different

// ---------- Member ----------
export const myLedger = async () => {
  const res = await api.get<LedgerEntry[]>(`${base}/ledger/my/`);
  return res.data;
};

export const myWithdrawals = async () => {
  const res = await api.get<Withdrawal[]>(`${base}/withdrawals/my/`);
  return res.data;
};

export const requestWithdrawal = async (payload: {
  amount: number | string;
  phone?: string; // optional; backend will default to user phone if serializer updated
  source?: "SAVINGS" | "MERRY" | "OTHER";
  target_app_label?: string;
  target_model?: string;
  target_object_id?: number;
}) => {
  const res = await api.post(`${base}/withdrawals/request/`, payload);
  return res.data; // { message, withdrawal }
};

export const stkPush = async (payload: {
  phone: string;
  amount: number | string;
  purpose?: string; // SAVINGS_DEPOSIT / LOAN_REPAYMENT / MERRY_CONTRIBUTION...
  reference?: string;
}) => {
  const res = await api.post(`${base}/mpesa/stk-push/`, payload);
  return res.data; // { message, tx }
};

// ---------- Admin ----------
export const adminWithdrawals = async (status?: string) => {
  const res = await api.get<Withdrawal[]>(`${base}/withdrawals/admin/`, {
    params: status ? { status } : undefined,
  });
  return res.data;
};

export const approveWithdrawal = async (id: number) => {
  const res = await api.patch(`${base}/withdrawals/${id}/approve/`, { approve: true });
  return res.data;
};

export const rejectWithdrawal = async (id: number, rejection_reason?: string) => {
  const res = await api.patch(`${base}/withdrawals/${id}/reject/`, { rejection_reason });
  return res.data;
};

export const adminLedger = async (params?: { user?: number; category?: string }) => {
  const res = await api.get<LedgerEntry[]>(`${base}/ledger/admin/`, { params });
  return res.data;
};

export const adminMpesa = async (params?: { status?: string; purpose?: string }) => {
  const res = await api.get<MpesaTx[]>(`${base}/mpesa/admin/`, { params });
  return res.data;
};