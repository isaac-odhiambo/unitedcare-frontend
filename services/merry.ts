// services/merry.ts
// ------------------------------------------------------
// ROSCA compatibility version
// - aligned to queue-based merry flow
// - one current payout at a time
// - DAILY / WEEKLY / MONTHLY support
// - penalty-aware merry structure
// - turn-linked payouts and dues
// ------------------------------------------------------

import { api } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";

export function getApiErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;

  if (data && typeof data === "object") {
    const firstValue = Object.values(data).find(Boolean);

    if (Array.isArray(firstValue)) {
      return String(firstValue[0] ?? "");
    }

    if (firstValue) return String(firstValue);
  }

  if (typeof error?.message === "string") return error.message;

  return "";
}


/* =========================================================
   Types
========================================================= */

export type PayoutOrderType = "manual" | "random" | string;
export type PayoutFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | string;
export type PenaltyMode = "NONE" | "FLAT" | "DAILY" | string;

export type MerryPenaltyPolicy = {
  penalty_mode?: PenaltyMode;
  flat_penalty_amount?: string;
  daily_penalty_amount?: string;
  penalty_grace_days?: number;
  penalty_cap_amount?: string | null;
};

export type MerrySummaryCreated = MerryPenaltyPolicy & {
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

export type MerrySummaryMembership = MerryPenaltyPolicy & {
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

export type AvailableMerryRow = MerryPenaltyPolicy & {
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

export type MerryCreatePayload = MerryPenaltyPolicy & {
  name: string;
  contribution_amount: string;
  cycle_duration_weeks?: number;
  payout_order_type?: PayoutOrderType;
  next_payout_date?: string | null;
  payout_frequency?: PayoutFrequency;
  payouts_per_period?: number;
  is_open?: boolean;
  max_seats?: number;
};

export type MerryCreateResponse = MerryPenaltyPolicy & {
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

export type NextPayoutTurnResponse = {
  merry_id: number;
  merry_name: string;
  payout_id?: number;
  turn_no?: number;
  cycle_no?: number;
  seat_id: number;
  seat_no: number;
  member_id: number;
  user_id: number;
  username?: string | null;
  phone?: string | null;
  payout_position: number | null;
  current_turn?: number;
  next_turn?: number;
  next_seat_id?: number | null;
  next_seat_no?: number | null;
  next_member_id?: number | null;
  next_user_id?: number | null;
  next_username?: string | null;
  next_scheduled_date?: string | null;
  next_slot_no?: number | null;
  period_key: string;
  period_label: string;
  period_start_date?: string;
  period_end_date?: string;
  slot_no: number;
  due_date?: string | null;
  scheduled_date?: string | null;
  cycle_number?: number;
  cycle_complete: boolean;
  expected_amount: string;
};

export type MerryDetail = MerryPenaltyPolicy & {
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
  next_turn?: NextPayoutTurnResponse | null;
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
  payout_id?: number | null;
  turn_no?: number | null;
  cycle_no?: number | null;
  scheduled_date?: string | null;
  period_key: string;
  slot_no: number;
  seat_id: number;
  seat_no: number;
  base_amount?: string;
  penalty_amount?: string;
  due_amount: string;
  paid_amount: string;
  status: DueStatus;
  outstanding: string;
  due_date?: string | null;
  days_overdue?: number;
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
  payout_id?: number | null;
  turn_no?: number | null;
  cycle_no?: number | null;
  scheduled_date?: string | null;
  period_key: string;
  slot_no: number;
  seat_id: number;
  seat_no: number;
  member_id: number;
  user_id: number;
  username?: string | null;
  phone?: string | null;
  base_amount?: string;
  penalty_amount?: string;
  due_amount: string;
  paid_amount: string;
  status: DueStatus;
  outstanding: string;
  due_date?: string | null;
  days_overdue?: number;
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
  payout_id?: number | null;
  turn_no?: number | null;
  cycle_no?: number | null;
  scheduled_date?: string | null;
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
  merry: MerryPenaltyPolicy & {
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
    next_payout_date?: string | null;
  };
  current_period_key: string;
  used_slots_in_period: number[];
  next_turn?: NextPayoutTurnResponse | null;
  readiness?: PayoutReadinessResponse | null;
  seats: PayoutSeatRow[];
};

export type CreatePayoutPayload = {
  seat_id?: number;
  period_key?: string;
  slot_no?: number;
  amount?: string;
  compute_amount?: boolean;
  notes?: string;
  auto_select_next_turn?: boolean;
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
  turn_no?: number | null;
  cycle_no?: number | null;
  scheduled_date?: string | null;
  next_turn?: NextPayoutTurnResponse | null;
};

export type PayoutReadinessMemberRow = {
  due_id: number;
  payout_id?: number | null;
  turn_no?: number | null;
  cycle_no?: number | null;
  seat_id: number;
  seat_no: number;
  member_id: number;
  user_id: number;
  username?: string | null;
  phone?: string | null;
  base_amount?: string;
  penalty_amount?: string;
  due_amount: string;
  paid_amount: string;
  outstanding: string;
  status: DueStatus;
  due_date?: string | null;
  days_overdue?: number;
};

export type PayoutReadinessResponse = {
  merry_id: number;
  merry_name: string;
  payout_id?: number;
  turn_no?: number;
  cycle_no?: number;
  period_key: string;
  period_label: string;
  period_start_date?: string | null;
  period_end_date?: string | null;
  scheduled_date?: string | null;
  slot_no: number;
  due_total: string;
  paid_total: string;
  outstanding_total: string;
  ready_for_payout: boolean;
  payout_already_exists: boolean;
  can_admin_create_payout: boolean;
  next_turn?: {
    seat_id: number;
    seat_no: number;
    member_id: number;
    user_id: number;
    username?: string | null;
    payout_position: number | null;
    cycle_number?: number;
    cycle_no?: number;
    cycle_complete: boolean;
    turn_no?: number;
    scheduled_date?: string | null;
  } | null;
  rows: PayoutReadinessMemberRow[];
};


export type MerryMobileReceiver = {
  seat_id?: number | null;
  seat_no?: number | null;
  member_id?: number | null;
  user_id?: number | null;
  username?: string | null;
  phone?: string | null;
};

export type MerryMobileCurrentTurn = {
  payout_id?: number | null;
  turn_no?: number | null;
  cycle_no?: number | null;
  period_key?: string | null;
  scheduled_date?: string | null;
  slot_no?: number | null;
  expected_amount?: string | number | null;
  receiver?: MerryMobileReceiver | null;
};

export type MerryMobileNextTurn = {
  turn_no?: number | null;
  cycle_no?: number | null;
  seat_id?: number | null;
  seat_no?: number | null;
  member_id?: number | null;
  user_id?: number | null;
  username?: string | null;
  phone?: string | null;
  scheduled_date?: string | null;
  slot_no?: number | null;
};

export type MerryMobileViewer = {
  user_id?: number | null;
  username?: string | null;
  is_admin?: boolean;
  is_member?: boolean;
  member_id?: number | null;
  seat_numbers?: number[];
  seat_count?: number;
  wallet_balance?: string | number | null;
  due_now?: string | number | null;
  pay_now?: string | number | null;
  my_join_request?: JoinRequestSummary;
  can_request_join?: boolean;
};

export type MerryMobileAdminReadiness = {
  payout_id?: number | null;
  turn_no?: number | null;
  cycle_no?: number | null;
  period_key?: string | null;
  scheduled_date?: string | null;
  slot_no?: number | null;
  expected?: string | number | null;
  paid?: string | number | null;
  outstanding?: string | number | null;
  ready_for_payout?: boolean;
  payout_already_exists?: boolean;
  can_admin_create_payout?: boolean;
  rows_count?: number;
};

export type MerryMobileDetailResponse = {
  merry: MerryPenaltyPolicy & {
    id: number;
    name: string;
    contribution_amount?: string | number | null;
    cycle_duration_weeks?: number;
    payout_order_type?: PayoutOrderType;
    next_payout_date?: string | null;
    payout_frequency?: PayoutFrequency;
    payouts_per_period?: number;
    is_open?: boolean;
    max_seats?: number | null;
    active_seats?: number | null;
    available_seats?: number | null;
    available_seat_numbers?: number[] | null;
    members_count?: number;
    seats_count?: number;
  };
  viewer?: MerryMobileViewer;
  current_turn?: MerryMobileCurrentTurn | null;
  next_turn?: MerryMobileNextTurn | null;
  admin_readiness?: MerryMobileAdminReadiness | null;
};

export type MerryMobileReadinessMemberRow = {
  member_id: number;
  user_id: number;
  username?: string | null;
  phone?: string | null;
  seat_id: number;
  seat_no: number;
  expected_amount: string | number;
  paid_amount: string | number;
  outstanding_amount: string | number;
  status: "PAID" | "PARTIAL" | "NOT_PAID" | DueStatus | string;
};

export type MerryMobileReadinessRowsResponse = {
  merry_id?: number;
  merry_name?: string;
  turn_no?: number | null;
  current_turn_no?: number | null;
  next_turn_no?: number | null;
  scheduled_date?: string | null;

  pool_amount?: string | number | null;
  total_paid?: string | number | null;
  total_unpaid?: string | number | null;
  paid_count?: number;
  not_paid_count?: number;

  members_paid?: MerryMobileReadinessMemberRow[];
  members_not_paid?: MerryMobileReadinessMemberRow[];

  // Legacy optional fields kept so older deployed responses do not crash the app.
  payout_id?: number | null;
  cycle_no?: number | null;
  period_key?: string;
  period_label?: string;
  period_start_date?: string | null;
  period_end_date?: string | null;
  slot_no?: number | null;
  due_total?: string | number | null;
  paid_total?: string | number | null;
  outstanding_total?: string | number | null;
  ready_for_payout?: boolean;
  payout_already_exists?: boolean;
  can_admin_create_payout?: boolean;
  paid_rows?: PayoutReadinessMemberRow[];
  partial_rows?: PayoutReadinessMemberRow[];
  unpaid_rows?: PayoutReadinessMemberRow[];
  rows?: PayoutReadinessMemberRow[];
};

/* =========================================================
   Summary / breakdown / wallet / dashboard types
========================================================= */

export type MerryDueItemBreakdown = {
  due_id: number;
  payout_id?: number | null;
  turn_no?: number | null;
  cycle_no?: number | null;
  seat_no: number;
  period_key: string;
  due_date?: string | null;
  status: DueStatus;
  base_amount?: string;
  penalty_amount?: string;
  due_amount: string;
  paid_amount: string;
  outstanding: string;
  days_overdue?: number;
  bucket?: "overdue" | "current" | "future" | "closed" | string;
};

export type MerryDueSummaryItem = {
  merry_id: number;
  merry_name: string;
  seat_count: number;
  seat_numbers: number[];
  amount_per_seat: string;
  current_turn?: {
    payout_id?: number;
    turn_no?: number;
    cycle_no?: number;
    seat_no?: number;
    scheduled_date?: string | null;
    expected_amount?: string;
    period_key?: string;
  };
  overdue_total: string;
  current_total: string;
  next_total: string;
  total_due_now: string;
  next_due_date?: string | null;
  next_due_rows_count?: number;
  wallet_balance: string;
  breakdown?: MerryDueItemBreakdown[];
};

export type MyAllMerryDueSummaryResponse = {
  active_merries: number;
  total_seats: number;
  overdue_total: string;
  current_total: string;
  next_total: string;
  total_due_now: string;
  wallet_balance: string;
  items: MerryDueSummaryItem[];
};

export type MerryPaymentBreakdownResponse = {
  merry_id: number;
  merry_name: string;
  seat_count: number;
  seat_numbers: number[];
  amount_per_seat: string;
  include_next: boolean;
  overdue_total: string;
  current_total: string;
  next_total: string;
  next_due_date?: string | null;
  total_due_now: string;
  wallet_balance: string;
  net_required_now_after_wallet?: string;
  selected_total?: string;
  items: MerryDueItemBreakdown[];
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
   Detailed member dashboard types
========================================================= */

export type MerryDashboardCurrentTurn = {
  payout_id?: number;
  turn_no?: number;
  cycle_no?: number;
  seat_no?: number;
  scheduled_date?: string | null;
  expected_amount?: string;
  period_key?: string;
};

export type MerryDashboardTotals = {
  overdue_total: string;
  current_total: string;
  future_total: string;
};

export type MerryMemberDashboardResponse = {
  merry_id: number;
  merry_name: string;
  member_id: number;
  seat_numbers: number[];
  wallet_balance: string;
  current_turn: MerryDashboardCurrentTurn;
  totals: MerryDashboardTotals;
  overdue_rows: MerryDueItemBreakdown[];
  current_rows: MerryDueItemBreakdown[];
  future_rows: MerryDueItemBreakdown[];
};

export type MerryMobileDetailBundle = {
  raw: MerryMobileDetailResponse;
  detail: MerryDetail;
  dashboard: MerryMemberDashboardResponse | null;
  nextTurn: NextPayoutTurnResponse | null;
  readiness: PayoutReadinessResponse | null;
  viewer: MerryMobileViewer | null;
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

function unwrapApiData<T = any>(value: T): T {
  const anyValue = value as any;

  if (!anyValue || typeof anyValue !== "object") return value;
  if (anyValue.data && typeof anyValue.data === "object") return anyValue.data;
  if (anyValue.result && typeof anyValue.result === "object") return anyValue.result;
  if (anyValue.payload && typeof anyValue.payload === "object") {
    return anyValue.payload;
  }

  return value;
}

function toMoneyString(value?: string | number | null): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function toNumber(value?: string | number | null, fallback = 0): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function toNumberOrNull(value?: string | number | null): number | null {
  if (value === undefined || value === null || value === "") return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(v)) return true;
    if (["0", "false", "no", "off"].includes(v)) return false;
  }

  return fallback;
}

function toStringOrNull(value?: string | number | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function normalizeMobilePayload(
  value: MerryMobileDetailResponse | any
): MerryMobileDetailResponse {
  const payload = unwrapApiData(value) as MerryMobileDetailResponse;

  return {
    merry: payload?.merry || ({} as MerryMobileDetailResponse["merry"]),
    viewer: payload?.viewer || undefined,
    current_turn: payload?.current_turn || null,
    next_turn: payload?.next_turn || null,
    admin_readiness: payload?.admin_readiness || null,
  };
}

export function mobileDetailToMerryDetail(
  value: MerryMobileDetailResponse | any
): MerryDetail {
  const data = normalizeMobilePayload(value);
  const merry = data.merry || ({} as MerryMobileDetailResponse["merry"]);
  const viewer = data.viewer || {};

  return {
    ...merry,
    id: toNumber(merry.id),
    name: String(merry.name || "Merry"),
    contribution_amount: toMoneyString(merry.contribution_amount),
    cycle_duration_weeks: toNumber(merry.cycle_duration_weeks),
    payout_order_type: merry.payout_order_type ?? "manual",
    next_payout_date: merry.next_payout_date ?? null,
    payout_frequency: merry.payout_frequency ?? "WEEKLY",
    payouts_per_period: toNumber(merry.payouts_per_period, 1),
    is_open: merry.is_open,
    max_seats: merry.max_seats ?? undefined,
    available_seats: merry.available_seats ?? null,
    available_seat_numbers: merry.available_seat_numbers ?? null,
    members_count: merry.members_count ?? merry.active_seats ?? 0,
    seats_count: merry.seats_count ?? merry.active_seats ?? 0,
    total_pool_per_slot: undefined,
    total_pool_per_period: undefined,
    is_member: toBool(viewer.is_member),
    my_member_id: viewer.member_id ?? null,
    my_join_request: viewer.my_join_request ?? null,
    can_request_join: toBool(viewer.can_request_join),
    next_turn: mobileDetailToNextPayoutTurn(data),
    penalty_mode: merry.penalty_mode,
    flat_penalty_amount: toMoneyString(merry.flat_penalty_amount),
    daily_penalty_amount: toMoneyString(merry.daily_penalty_amount),
    penalty_grace_days: toNumber(merry.penalty_grace_days),
    penalty_cap_amount:
      merry.penalty_cap_amount === undefined || merry.penalty_cap_amount === null
        ? null
        : toMoneyString(merry.penalty_cap_amount),
  };
}

export function mobileDetailToMemberDashboard(
  value: MerryMobileDetailResponse | any
): MerryMemberDashboardResponse | null {
  const data = normalizeMobilePayload(value);
  const merry = data.merry;
  const viewer = data.viewer;

  if (!merry || !viewer || !toBool(viewer.is_member)) return null;

  const current = data.current_turn;
  const receiver = current?.receiver;

  return {
    merry_id: toNumber(merry.id),
    merry_name: String(merry.name || "Merry"),
    member_id: toNumber(viewer.member_id),
    seat_numbers: Array.isArray(viewer.seat_numbers)
      ? viewer.seat_numbers.map((seat) => toNumber(seat)).filter(Boolean)
      : [],
    wallet_balance: toMoneyString(viewer.wallet_balance),
    current_turn: {
      payout_id: toNumberOrNull(current?.payout_id) ?? undefined,
      turn_no: toNumberOrNull(current?.turn_no) ?? undefined,
      cycle_no: toNumberOrNull(current?.cycle_no) ?? undefined,
      seat_no: toNumberOrNull(receiver?.seat_no) ?? undefined,
      scheduled_date: current?.scheduled_date ?? null,
      expected_amount:
        current?.expected_amount === undefined || current?.expected_amount === null
          ? undefined
          : toMoneyString(current.expected_amount),
      period_key: current?.period_key ?? undefined,
    },
    totals: {
      overdue_total: "0.00",
      current_total: toMoneyString(viewer.due_now),
      future_total: "0.00",
    },
    overdue_rows: [],
    current_rows: [],
    future_rows: [],
  };
}

export function mobileDetailToNextPayoutTurn(
  value: MerryMobileDetailResponse | any
): NextPayoutTurnResponse | null {
  const data = normalizeMobilePayload(value);
  const merry = data.merry;
  const current = data.current_turn;
  const receiver = current?.receiver;
  const upcoming = data.next_turn;

  if (!merry || !current) return null;

  const periodKey = String(current.period_key ?? "");
  const scheduledDate = current.scheduled_date ?? null;

  return {
    merry_id: toNumber(merry.id),
    merry_name: String(merry.name || "Merry"),
    payout_id: toNumberOrNull(current.payout_id) ?? undefined,
    turn_no: toNumberOrNull(current.turn_no) ?? undefined,
    cycle_no: toNumberOrNull(current.cycle_no) ?? undefined,
    seat_id: toNumber(receiver?.seat_id),
    seat_no: toNumber(receiver?.seat_no),
    member_id: toNumber(receiver?.member_id),
    user_id: toNumber(receiver?.user_id),
    username: receiver?.username ?? null,
    payout_position: null,
    period_key: periodKey,
    period_label: periodKey,
    period_start_date: scheduledDate ?? undefined,
    period_end_date: scheduledDate ?? undefined,
    slot_no: toNumber(current.slot_no, 1),
    due_date: scheduledDate,
    scheduled_date: scheduledDate,
    cycle_number: toNumberOrNull(current.cycle_no) ?? undefined,
    cycle_complete: false,
    expected_amount: toMoneyString(current.expected_amount),
    next_seat_id: toNumberOrNull(upcoming?.seat_id) ?? undefined,
    next_seat_no: toNumberOrNull(upcoming?.seat_no) ?? undefined,
    next_member_id: toNumberOrNull(upcoming?.member_id) ?? undefined,
    next_user_id: toNumberOrNull(upcoming?.user_id) ?? undefined,
    next_username: upcoming?.username ?? null,
    next_scheduled_date: upcoming?.scheduled_date ?? null,
    next_slot_no: toNumberOrNull(upcoming?.slot_no) ?? undefined,
  } as NextPayoutTurnResponse & {
    next_seat_id?: number;
    next_seat_no?: number;
    next_member_id?: number;
    next_user_id?: number;
    next_username?: string | null;
    next_scheduled_date?: string | null;
    next_slot_no?: number;
  };
}

export function mobileDetailToPayoutReadiness(
  value: MerryMobileDetailResponse | any
): PayoutReadinessResponse | null {
  const data = normalizeMobilePayload(value);
  const merry = data.merry;
  const current = data.current_turn;
  const admin = data.admin_readiness;

  if (!merry || !admin) return null;

  const periodKey = String(admin.period_key ?? current?.period_key ?? "");
  const scheduledDate = admin.scheduled_date ?? current?.scheduled_date ?? null;

  return {
    merry_id: toNumber(merry.id),
    merry_name: String(merry.name || "Merry"),
    payout_id: toNumberOrNull(admin.payout_id ?? current?.payout_id) ?? undefined,
    turn_no: toNumberOrNull(admin.turn_no ?? current?.turn_no) ?? undefined,
    cycle_no: toNumberOrNull(admin.cycle_no ?? current?.cycle_no) ?? undefined,
    period_key: periodKey,
    period_label: periodKey,
    period_start_date: scheduledDate,
    period_end_date: scheduledDate,
    scheduled_date: scheduledDate,
    slot_no: toNumber(admin.slot_no ?? current?.slot_no, 1),
    due_total: toMoneyString(admin.expected),
    paid_total: toMoneyString(admin.paid),
    outstanding_total: toMoneyString(admin.outstanding),
    ready_for_payout: toBool(admin.ready_for_payout),
    payout_already_exists: toBool(admin.payout_already_exists),
    can_admin_create_payout: toBool(admin.can_admin_create_payout),
    next_turn: mobileDetailToNextPayoutTurn(data) as any,
    rows: [],
  };
}

export function mobileReadinessRowsToPayoutReadiness(
  value: MerryMobileReadinessRowsResponse | any
): PayoutReadinessResponse {
  const data = unwrapApiData(value) as MerryMobileReadinessRowsResponse;

  const hasNewMobileRows =
    Array.isArray(data.members_paid) || Array.isArray(data.members_not_paid);

  const mobileRows: PayoutReadinessMemberRow[] = hasNewMobileRows
    ? [
        ...(Array.isArray(data.members_paid) ? data.members_paid : []),
        ...(Array.isArray(data.members_not_paid) ? data.members_not_paid : []),
      ].map((row, index) => {
        const normalizedStatus =
          row.status === "NOT_PAID" ? "OVERDUE" : row.status;

        return {
          due_id: index + 1,
          payout_id: toNumberOrNull(data.payout_id) ?? undefined,
          turn_no:
            toNumberOrNull(data.turn_no ?? data.current_turn_no) ?? undefined,
          cycle_no: toNumberOrNull(data.cycle_no) ?? undefined,
          seat_id: toNumber(row.seat_id),
          seat_no: toNumber(row.seat_no),
          member_id: toNumber(row.member_id),
          user_id: toNumber(row.user_id),
          username: row.username ?? null,
          phone: row.phone ?? null,
          base_amount: toMoneyString(row.expected_amount),
          penalty_amount: "0.00",
          due_amount: toMoneyString(row.expected_amount),
          paid_amount: toMoneyString(row.paid_amount),
          outstanding: toMoneyString(row.outstanding_amount),
          status: normalizedStatus,
          due_date: data.scheduled_date ?? null,
          days_overdue: 0,
        };
      })
    : [];

  const legacyRows = Array.isArray(data.rows)
    ? data.rows
    : [
        ...(Array.isArray(data.paid_rows) ? data.paid_rows : []),
        ...(Array.isArray(data.partial_rows) ? data.partial_rows : []),
        ...(Array.isArray(data.unpaid_rows) ? data.unpaid_rows : []),
      ];

  const rows = hasNewMobileRows ? mobileRows : legacyRows;

  const dueTotal =
    data.pool_amount ??
    data.due_total ??
    sumMoney(rows.map((row) => row.due_amount));

  const paidTotal =
    data.total_paid ??
    data.paid_total ??
    sumMoney(rows.map((row) => row.paid_amount));

  const outstandingTotal =
    data.total_unpaid ??
    data.outstanding_total ??
    sumMoney(rows.map((row) => row.outstanding));

  const isReady =
    data.ready_for_payout ??
    (toNumber(dueTotal) > 0 && toNumber(outstandingTotal) <= 0);

  const periodKey = String(
    data.period_key ?? data.scheduled_date ?? data.turn_no ?? ""
  );

  const response = {
    merry_id: toNumber(data.merry_id),
    merry_name: String(data.merry_name || "Merry"),
    payout_id: toNumberOrNull(data.payout_id) ?? undefined,
    turn_no:
      toNumberOrNull(data.turn_no ?? data.current_turn_no) ?? undefined,
    cycle_no: toNumberOrNull(data.cycle_no) ?? undefined,
    period_key: periodKey,
    period_label: String(data.period_label ?? periodKey),
    period_start_date: data.period_start_date ?? data.scheduled_date ?? null,
    period_end_date: data.period_end_date ?? data.scheduled_date ?? null,
    scheduled_date: data.scheduled_date ?? null,
    slot_no: toNumber(data.slot_no, 1),
    due_total: toMoneyString(dueTotal),
    paid_total: toMoneyString(paidTotal),
    outstanding_total: toMoneyString(outstandingTotal),
    ready_for_payout: toBool(isReady),
    payout_already_exists: toBool(data.payout_already_exists),
    can_admin_create_payout: toBool(data.can_admin_create_payout),
    next_turn: null,
    rows,
  } as PayoutReadinessResponse & Record<string, any>;

  response.rows_count = rows.length;
  response.paid_count =
    data.paid_count ??
    rows.filter(
      (row) => toNumber(row.paid_amount) > 0 && toNumber(row.outstanding) <= 0
    ).length;
  response.not_paid_count =
    data.not_paid_count ??
    rows.filter((row) => toNumber(row.outstanding) > 0).length;

  return response;
}

export function buildMerryMobileDetailBundle(
  value: MerryMobileDetailResponse | any
): MerryMobileDetailBundle {
  const raw = normalizeMobilePayload(value);

  return {
    raw,
    detail: mobileDetailToMerryDetail(raw),
    dashboard: mobileDetailToMemberDashboard(raw),
    nextTurn: mobileDetailToNextPayoutTurn(raw),
    readiness: mobileDetailToPayoutReadiness(raw),
    viewer: raw.viewer || null,
  };
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

export async function createMerry(
  payload: MerryCreatePayload
): Promise<MerryCreateResponse> {
  const safePayload = {
    ...payload,
    payouts_per_period: 1,
  };
  const res = await api.post(ENDPOINTS.merry.create, safePayload);
  return res.data;
}

export async function getMerryMobileDetail(
  merryId: number | string
): Promise<MerryMobileDetailResponse> {
  const res = await api.get(ENDPOINTS.merry.mobileDetail(merryId));
  return normalizeMobilePayload(res.data);
}

// Compatibility name only. It now uses mobile-detail, not /api/merry/:id/
export async function getLegacyMerryDetail(
  merryId: number | string
): Promise<MerryDetail> {
  const mobile = await getMerryMobileDetail(merryId);
  return mobileDetailToMerryDetail(mobile);
}

export async function getMerryDetail(merryId: number): Promise<MerryDetail> {
  const mobile = await getMerryMobileDetail(merryId);
  return mobileDetailToMerryDetail(mobile);
}

export async function getMerryMobileDetailBundle(
  merryId: number | string
): Promise<MerryMobileDetailBundle> {
  const mobile = await getMerryMobileDetail(merryId);
  return buildMerryMobileDetailBundle(mobile);
}

export async function getMerryMobileReadinessRows(
  merryId: number | string
): Promise<MerryMobileReadinessRowsResponse> {
  const res = await api.get(ENDPOINTS.merry.mobileReadinessRows(merryId));
  return unwrapApiData(res.data) as MerryMobileReadinessRowsResponse;
}

export async function getMerryMobileReadiness(
  merryId: number | string
): Promise<PayoutReadinessResponse> {
  const rows = await getMerryMobileReadinessRows(merryId);
  return mobileReadinessRowsToPayoutReadiness(rows);
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

/* removed active slot-config functions on purpose */

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
  const safeParams = params
    ? {
        ...params,
        slot_no: 1,
      }
    : { slot_no: 1 };

  const res = await api.get(ENDPOINTS.merry.duesAdmin(merryId), {
    params: safeParams,
  });
  return res.data;
}

/* =========================================================
   Summary / breakdown / wallet / dashboard calls
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

export async function getMerryMemberDashboard(
  merryId: number
): Promise<MerryMemberDashboardResponse> {
  const res = await api.get(ENDPOINTS.merry.dashboard(merryId));
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

export async function getNextPayoutTurn(
  merryId: number
): Promise<NextPayoutTurnResponse> {
  const res = await api.get(ENDPOINTS.merry.nextTurn(merryId));
  return res.data;
}

export async function getPayoutReadiness(
  merryId: number,
  params?: { period_key?: string; slot_no?: number }
): Promise<PayoutReadinessResponse> {
  return getMerryMobileReadiness(merryId);
}

export async function createMerryPayout(
  merryId: number,
  payload: CreatePayoutPayload
): Promise<CreatePayoutResponse> {
  const safePayload = {
    ...payload,
    slot_no: 1,
  };
  const res = await api.post(ENDPOINTS.merry.createPayout(merryId), safePayload);
  return res.data;
}

export async function createNextMerryPayout(
  merryId: number,
  payload: { notes?: string } = {}
): Promise<CreatePayoutResponse> {
  const res = await api.post(ENDPOINTS.merry.createNextPayout(merryId), payload);
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