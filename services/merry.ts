// services/merry.ts
// ------------------------------------------------------
// Matches merry endpoints, seats, slots, dues, payments,
// join requests, payouts, dashboard summary,
// payment breakdown, wallet, and STK merry contribution flow
// ------------------------------------------------------

import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

/* =========================================================
   Types
========================================================= */

export type PayoutOrderType = "manual" | "random" | string;
export type PayoutFrequency = "WEEKLY" | "MONTHLY" | string;

export type MerrySummaryCreated = {
  id: number;
  name: string;
  contribution_amount: string;
  cycle_duration_weeks: number;
  payout_order_type: PayoutOrderType;
  next_payout_date: string | null;
  payout_frequency: PayoutFrequency;
  payouts_per_period: number;
  is_open?: boolean;
  max_seats?: number;
  available_seats?: number | null;
  members_count: number;
  seats_count: number;
  created_at: string;
};

export type MerrySummaryMembership = {
  merry_id: number;
  name: string;
  contribution_amount: string;
  cycle_duration_weeks: number;
  payout_order_type: PayoutOrderType;
  next_payout_date: string | null;
  payout_frequency: PayoutFrequency;
  payouts_per_period: number;
  is_open?: boolean;
  max_seats?: number;
  available_seats?: number | null;
  joined_at: string;
  seats_count: number;
};

export type MyMerriesResponse = {
  created: MerrySummaryCreated[];
  memberships: MerrySummaryMembership[];
};

export type JoinRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | string;

export type JoinRequestSummary = {
  id: number;
  status: JoinRequestStatus;
  requested_seats: number;
  created_at?: string;
  reviewed_at?: string | null;
} | null;

export type AvailableMerryRow = {
  id: number;
  name: string;
  contribution_amount: string;
  cycle_duration_weeks: number;
  payout_order_type: PayoutOrderType;
  next_payout_date: string | null;
  payout_frequency: PayoutFrequency;
  payouts_per_period: number;
  is_open: boolean;
  max_seats: number;
  available_seats: number | null;
  available_seat_numbers?: number[] | null;
  can_request_join?: boolean;
  is_member?: boolean;
  my_member_id?: number | null;
  members_count: number;
  seats_count: number;
  my_join_request?: JoinRequestSummary;
  created_at: string;
};

export type MerryCreateResponse = {
  id: number;
  name: string;
  contribution_amount: string;
  cycle_duration_weeks: number;
  payout_order_type: PayoutOrderType;
  next_payout_date: string | null;
  payout_frequency: PayoutFrequency;
  payouts_per_period: number;
  is_open?: boolean;
  max_seats?: number;
  available_seats?: number | null;
  created_at?: string;
};

export type MerryDetail = {
  id: number;
  name: string;
  contribution_amount: string;
  cycle_duration_weeks: number;
  payout_order_type: PayoutOrderType;
  next_payout_date: string | null;
  payout_frequency: PayoutFrequency;
  payouts_per_period: number;
  is_open?: boolean;
  max_seats?: number;
  available_seats?: number | null;
  available_seat_numbers?: number[] | null;
  members_count?: number;
  seats_count?: number;
  total_pool_per_slot?: string;
  total_pool_per_period?: string;
  created_by?: number;
  created_at?: string;
  is_member?: boolean;
  my_member_id?: number | null;
  my_join_request?: JoinRequestSummary;
  can_request_join?: boolean;
};

export type MerryMemberRow = {
  member_id: number;
  user_id: number;
  username?: string | null;
  phone?: string | null;
  joined_at: string;
  seats_count: number;
};

export type MerrySeatRow = {
  seat_id: number;
  member_id: number;
  user_id: number;
  username?: string | null;
  phone?: string | null;
  seat_no: number;
  payout_position: number | null;
  created_at?: string;
};

export type SlotConfigRow = {
  slot_no: number;
  weekday: number;
  weekday_name?: string;
};

export type JoinRequestRow = {
  id: number;
  merry_id: number;
  merry_name?: string;
  user_id?: number;
  username?: string | null;
  phone?: string | null;
  status: JoinRequestStatus;
  note?: string;
  requested_seats: number;
  created_at: string;
  reviewed_at?: string | null;
};

export type RequestJoinPayload = {
  note?: string;
  requested_seats?: number;
};

export type RequestJoinResponse = {
  message: string;
  request_id: number;
  status: JoinRequestStatus;
  requested_seats: number;
};

export type AdminApproveJoinPayload = {
  assigned_seat_numbers?: number[];
};

export type AdminApproveJoinResponse = {
  message: string;
  member_id: number;
  merry_id: number;
  user_id: number;
  seats_created: Array<{
    seat_id: number;
    seat_no: number;
    payout_position: number | null;
  }>;
};

export type DueStatus =
  | "PENDING"
  | "PARTIAL"
  | "OVERDUE"
  | "PAID"
  | "CANCELLED"
  | string;

export type MyDuesRow = {
  due_id: number;
  period_key: string;
  slot_no: number;
  seat_id: number;
  seat_no: number;
  due_amount: string;
  paid_amount: string;
  status: DueStatus;
  outstanding: string;
  due_date?: string | null;
  is_advance_payable?: boolean;
  updated_at: string;
};

export type MyDuesResponse = {
  merry_id: number;
  period_key: string;
  payouts_per_period: number;
  data: MyDuesRow[];
};

export type AdminDuesRow = {
  due_id: number;
  period_key: string;
  slot_no: number;
  seat_id: number;
  seat_no: number;
  member_id: number;
  user_id: number;
  username?: string | null;
  phone?: string | null;
  due_amount: string;
  paid_amount: string;
  status: DueStatus;
  outstanding: string;
  due_date?: string | null;
  is_advance_payable?: boolean;
  updated_at: string;
};

export type AdminDuesResponse = {
  merry_id: number;
  period_key: string;
  slot_no: number | null;
  total_due: string;
  total_paid_allocated: string;
  rows: AdminDuesRow[];
};

export type EnsureDuesResponse = {
  message: string;
  period_key: string;
  created: number;
};

export type PaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED"
  | string;

export type MerryPaymentRow = {
  id: number;
  merry_id: number;
  merry_name?: string;
  beneficiary_member_id: number;
  amount: string;
  status: PaymentStatus;
  paid_at?: string | null;
  payer_phone: string;
  mpesa_receipt_number?: string | null;
  period_key: string;
  created_at: string;
};

export type PaymentIntentPayload = {
  amount: string;
  payer_phone?: string;
};

export type PaymentIntentResponse = {
  message: string;
  payment_id: number;
  merry_id: number;
  beneficiary_member_id: number;
  amount: string;
  payer_phone: string;
  period_key: string;
  status: PaymentStatus;
};

export type ConfirmPaymentPayload = {
  mpesa_receipt_number?: string;
};

export type MpesaTx = {
  id: number;
  phone: string;
  amount: string;
  direction: "IN" | "OUT" | string;
  channel: "STK" | "B2C" | string;
  purpose: string;
  status: string;
  reference: string;
  merchant_request_id?: string | null;
  checkout_request_id?: string | null;
  mpesa_receipt_number?: string | null;
  transaction_date?: string | null;
  ledger_posted?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type StkPushResponse = {
  message: string;
  tx: MpesaTx;
};

export type PayoutStatus =
  | "SCHEDULED"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | string;

export type PayoutSeatRow = {
  seat_id: number;
  member_id: number;
  user_id: number;
  username?: string | null;
  phone?: string | null;
  seat_no: number;
  payout_position: number | null;
};

export type PayoutScheduleResponse = {
  merry: {
    id: number;
    name: string;
    payout_order_type: PayoutOrderType;
    contribution_amount: string;
    members_count: number;
    seats_count: number;
    payout_frequency: PayoutFrequency;
    payouts_per_period: number;
    is_open?: boolean;
    max_seats?: number;
    available_seats?: number | null;
  };
  current_period_key: string;
  used_slots_in_period: number[];
  seats: PayoutSeatRow[];
};

export type CreatePayoutPayload = {
  seat_id: number;
  period_key?: string;
  slot_no?: number;
  amount?: string;
  compute_amount?: boolean;
  notes?: string;
};

export type CreatePayoutResponse = {
  message: string;
  payout_id: number;
  status: PayoutStatus;
  merry_id: number;
  seat_id: number;
  member_id: number;
  user_id: number;
  amount: string;
  period_key: string;
  slot_no: number;
};

/* =========================================================
   Dashboard / payment breakdown / wallet types
========================================================= */

export type MerryDueSummaryItem = {
  merry_id: number;
  merry_name: string;
  seat_count: number;
  seat_numbers: number[];
  amount_per_seat: string;
  overdue: string;
  current_due: string;
  next_due: string;
  next_due_date?: string | null;
  required_now: string;
  pay_with_next: string;
};

export type MyAllMerryDueSummaryResponse = {
  active_merries: number;
  total_seats: number;
  total_overdue: string;
  total_current_due: string;
  total_next_due: string;
  total_required_now: string;
  total_pay_with_next: string;
  total_wallet_balance: string;
  items: MerryDueSummaryItem[];
};

export type MerryPaymentBreakdownItem = {
  due_id: number;
  seat_id: number;
  seat_no: number;
  period_key: string;
  slot_no: number;
  due_date?: string | null;
  status: DueStatus;
  due_amount: string;
  paid_amount: string;
  outstanding: string;
  bucket: "overdue" | "current" | "future" | "closed" | string;
};

export type MerryPaymentBreakdownResponse = {
  merry_id: number;
  merry_name: string;
  seat_count: number;
  seat_numbers: number[];
  amount_per_seat: string;
  include_next: boolean;
  overdue: string;
  current_due: string;
  next_due: string;
  next_due_date?: string | null;
  required_now: string;
  pay_with_next: string;
  wallet_balance: string;
  net_required_now_after_wallet: string;
  selected_total: string;
  items: MerryPaymentBreakdownItem[];
};

export type MerryWalletResponse = {
  user_id: number;
  wallet_balance: string;
  updated_at?: string | null;
};

export type MerryWalletTransactionRow = {
  id: number;
  tx_type: "CREDIT" | "DEBIT" | string;
  amount: string;
  balance_before: string;
  balance_after: string;
  reference?: string;
  narration?: string;
  mpesa_receipt_number?: string | null;
  created_at: string;
};

export type MerryWalletTransactionsResponse = {
  user_id: number;
  count: number;
  results: MerryWalletTransactionRow[];
};

export type AdminUserMerryWalletResponse = {
  user_id: number;
  wallet_balance: string;
  updated_at?: string | null;
  transactions: MerryWalletTransactionRow[];
};

/* =========================================================
   Friendly helpers
========================================================= */

export function fmtKES(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";

  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function sumMoney(
  values: Array<string | number | null | undefined>
): string {
  const total = values.reduce<number>((acc, value) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? acc + n : acc;
  }, 0);

  return total.toFixed(2);
}

export function hasAmount(value?: string | number | null): boolean {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0;
}

function listFrom<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

/* =========================================================
   API Calls
========================================================= */

export async function getMyMerries(): Promise<MyMerriesResponse> {
  const res = await api.get(ENDPOINTS.merry.my);
  return res.data;
}

export async function getAvailableMerries(): Promise<AvailableMerryRow[]> {
  const res = await api.get(ENDPOINTS.merry.available);
  return listFrom<AvailableMerryRow>(res.data);
}

export async function createMerry(payload: {
  name: string;
  contribution_amount: string;
  cycle_duration_weeks?: number;
  payout_order_type?: PayoutOrderType;
  next_payout_date?: string | null;
  payout_frequency?: PayoutFrequency;
  payouts_per_period?: number;
  is_open?: boolean;
  max_seats?: number;
}): Promise<MerryCreateResponse> {
  const res = await api.post(ENDPOINTS.merry.create, payload);
  return res.data;
}

export async function getMerryDetail(merryId: number): Promise<MerryDetail> {
  const res = await api.get(ENDPOINTS.merry.detail(merryId));
  return res.data;
}

export async function getMerryMembers(
  merryId: number
): Promise<MerryMemberRow[]> {
  const res = await api.get(ENDPOINTS.merry.members(merryId));
  return listFrom<MerryMemberRow>(res.data);
}

export async function getMerrySeats(
  merryId: number
): Promise<MerrySeatRow[]> {
  const res = await api.get(ENDPOINTS.merry.seats(merryId));
  return listFrom<MerrySeatRow>(res.data);
}

export async function getSlotConfig(
  merryId: number
): Promise<SlotConfigRow[]> {
  const res = await api.get(ENDPOINTS.merry.slots(merryId));
  return listFrom<SlotConfigRow>(res.data);
}

export async function saveSlotConfig(
  merryId: number,
  items: Array<{ slot_no: number; weekday: number }>
): Promise<{ message: string }> {
  const res = await api.post(ENDPOINTS.merry.slots(merryId), items);
  return res.data;
}

export async function requestToJoinMerry(
  merryId: number,
  payload: RequestJoinPayload = {}
): Promise<RequestJoinResponse> {
  const res = await api.post(ENDPOINTS.merry.joinRequest(merryId), payload);
  return res.data;
}

export async function cancelJoinRequest(
  requestId: number
): Promise<{ message: string }> {
  const res = await api.post(ENDPOINTS.merry.cancelJoinRequest(requestId));
  return res.data;
}

export async function getMyJoinRequests(): Promise<JoinRequestRow[]> {
  const res = await api.get(ENDPOINTS.merry.myJoinRequests);
  return listFrom<JoinRequestRow>(res.data);
}

export async function adminListJoinRequests(
  merryId: number,
  statusFilter?: string
): Promise<JoinRequestRow[]> {
  const res = await api.get(ENDPOINTS.merry.adminJoinRequests(merryId), {
    params: statusFilter ? { status: statusFilter } : undefined,
  });
  return listFrom<JoinRequestRow>(res.data);
}

export async function adminApproveJoinRequest(
  requestId: number,
  payload: AdminApproveJoinPayload = {}
): Promise<AdminApproveJoinResponse> {
  const res = await api.post(
    ENDPOINTS.merry.approveJoinRequest(requestId),
    payload
  );
  return res.data;
}

export async function adminRejectJoinRequest(
  requestId: number,
  payload: { note?: string } = {}
): Promise<{ message: string }> {
  const res = await api.post(
    ENDPOINTS.merry.rejectJoinRequest(requestId),
    payload
  );
  return res.data;
}

export async function ensureDuesForCurrentPeriod(
  merryId: number,
  payload: { period_key?: string } = {}
): Promise<EnsureDuesResponse> {
  const res = await api.post(ENDPOINTS.merry.ensureDues(merryId), payload);
  return res.data;
}

export async function getMyMerryDues(
  merryId: number,
  period_key?: string
): Promise<MyDuesResponse> {
  const res = await api.get(ENDPOINTS.merry.duesMy(merryId), {
    params: period_key ? { period_key } : undefined,
  });
  return res.data;
}

export async function adminGetDues(
  merryId: number,
  params?: { period_key?: string; slot_no?: number }
): Promise<AdminDuesResponse> {
  const res = await api.get(ENDPOINTS.merry.duesAdmin(merryId), {
    params: params ?? undefined,
  });
  return res.data;
}

/* =========================================================
   Summary / breakdown / wallet calls
========================================================= */

export async function getMyAllMerryDueSummary(): Promise<MyAllMerryDueSummaryResponse> {
  const res = await api.get(ENDPOINTS.merry.duesSummary);
  return res.data;
}

export async function getMerryPaymentBreakdown(
  merryId: number,
  includeNext = false
): Promise<MerryPaymentBreakdownResponse> {
  const res = await api.get(ENDPOINTS.merry.paymentBreakdown(merryId), {
    params: { include_next: includeNext },
  });
  return res.data;
}

export async function getMyMerryWallet(): Promise<MerryWalletResponse> {
  const res = await api.get(ENDPOINTS.merry.myWallet);
  return res.data;
}

export async function getMyMerryWalletTransactions(): Promise<MerryWalletTransactionsResponse> {
  const res = await api.get(ENDPOINTS.merry.myWalletTransactions);
  return res.data;
}

export async function adminGetUserMerryWallet(
  userId: number
): Promise<AdminUserMerryWalletResponse> {
  const res = await api.get(ENDPOINTS.merry.adminUserWallet(userId));
  return res.data;
}

export async function createMerryPaymentIntent(
  merryId: number,
  payload: PaymentIntentPayload
): Promise<PaymentIntentResponse> {
  const res = await api.post(ENDPOINTS.merry.paymentIntent(merryId), payload);
  return res.data;
}

export async function getMyMerryPayments(): Promise<MerryPaymentRow[]> {
  const res = await api.get(ENDPOINTS.merry.myPayments);
  return listFrom<MerryPaymentRow>(res.data);
}

export async function adminConfirmMerryPayment(
  paymentId: number,
  payload: ConfirmPaymentPayload = {}
): Promise<{ message: string }> {
  const res = await api.post(ENDPOINTS.merry.confirmPayment(paymentId), payload);
  return res.data;
}

export async function getMerryPayoutSchedule(
  merryId: number
): Promise<PayoutScheduleResponse> {
  const res = await api.get(ENDPOINTS.merry.payoutSchedule(merryId));
  return res.data;
}

export async function createMerryPayout(
  merryId: number,
  payload: CreatePayoutPayload
): Promise<CreatePayoutResponse> {
  const res = await api.post(ENDPOINTS.merry.createPayout(merryId), payload);
  return res.data;
}

export async function markMerryPayoutPaid(
  payoutId: number
): Promise<{ message: string }> {
  const res = await api.post(ENDPOINTS.merry.markPayoutPaid(payoutId));
  return res.data;
}

/* =========================================================
   Merry contribution STK flow
========================================================= */

export async function stkPayMerryContribution(params: {
  merry_id: number;
  amount: string;
  phone: string;
  narration?: string;
}): Promise<{
  payment_intent: PaymentIntentResponse;
  stk: StkPushResponse;
  reference: string;
}> {
  const intent = await createMerryPaymentIntent(params.merry_id, {
    amount: params.amount,
    payer_phone: params.phone,
  });

  const reference = `MERRY-PAYMENT-${intent.payment_id}`;

  const stkRes = await api.post(ENDPOINTS.payments.stkPush, {
    phone: params.phone,
    amount: params.amount,
    purpose: "MERRY_CONTRIBUTION",
    reference,
    narration:
      params.narration ?? `Merry contribution (merry=${params.merry_id})`,
  });

  return {
    payment_intent: intent,
    stk: stkRes.data,
    reference,
  };
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
  if (typeof data?.error === "string") return data.error;

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