// constants/routes.ts
// ------------------------------------------------------
// Frontend screen routes for Expo Router
// Single source of truth for navigation paths
// ------------------------------------------------------

export const ROUTES = {
  auth: {
    login: "/(auth)/login",
    register: "/(auth)/register",
    verifyOtp: "/(auth)/verify-otp",
    forgotPassword: "/(auth)/forgot-password",
    resetPassword: "/(auth)/reset-password",
  },

  tabs: {
    dashboard: "/(tabs)/dashboard",

    /* -----------------------------
       Savings
    ----------------------------- */
    savings: "/(tabs)/savings",
    savingsCreate: "/(tabs)/savings/create",
    savingsHistory: "/(tabs)/savings/history",

    /* -----------------------------
       Payments
    ----------------------------- */
    payments: "/(tabs)/payments",
    paymentsLedger: "/(tabs)/payments/ledger",
    paymentsDeposit: "/(tabs)/payments/deposit",
    paymentsWithdrawals: "/(tabs)/payments/withdrawals",
    paymentsRequestWithdrawal: "/(tabs)/payments/request-withdrawal",

    /* -----------------------------
       Loans
    ----------------------------- */
    loans: "/(tabs)/loans",
    loansRequest: "/(tabs)/loans/request",
    loansPay: "/(tabs)/loans/pay",
    loansAddGuarantor: "/(tabs)/loans/add-guarantor",
    loansGuarantees: "/(tabs)/loans/guarantees",

    /* -----------------------------
       Merry-Go-Round
    ----------------------------- */
    merry: "/(tabs)/merry",
    merryContribute: "/(tabs)/merry/contribute",
    merryHistory: "/(tabs)/merry/history",
    merryJoinRequests: "/(tabs)/merry/join-requests",
    merryPayments: "/(tabs)/merry/contributions",
    merryCreate: "/(tabs)/merry/create",
    merryMembers: "/(tabs)/merry/members",
    merryPayoutsSchedule: "/(tabs)/merry/payouts-schedule",
    merryAdminJoinRequests: "/(tabs)/merry/admin-join-requests",
    merryAdminPayoutCreate: "/(tabs)/merry/admin-payout-create",

    /* -----------------------------
       Groups
    ----------------------------- */
    groups: "/(tabs)/groups",
    groupsAvailable: "/(tabs)/groups/available",
    groupsMySavings: "/(tabs)/groups/my-savings",
    groupsMemberships: "/(tabs)/groups/memberships",
    groupsJoinRequests: "/(tabs)/groups/join-requests",
    groupsCreate: "/(tabs)/groups/create",
    groupsEdit: "/(tabs)/groups/edit",
    groupsAddMembership: "/(tabs)/groups/add-membership",
    groupsContribute: "/(tabs)/groups/contribute",
    groupsHistory: "/(tabs)/groups/history",
    groupsAdminJoinRequests: "/(tabs)/groups/admin-join-requests",

    /* -----------------------------
       Profile
    ----------------------------- */
    profile: "/(tabs)/profile",
    profileEdit: "/(tabs)/profile/edit",
    profileKyc: "/(tabs)/profile/kyc",
  },

  dynamic: {
    /* -----------------------------
       Dynamic detail screens
    ----------------------------- */
    loanDetail: (id: number | string) => `/(tabs)/loans/${id}`,
    merryDetail: (id: number | string) => `/(tabs)/merry/${id}`,
    groupDetail: (id: number | string) => `/(tabs)/groups/${id}`,

    /* -----------------------------
       Savings dynamic helpers
    ----------------------------- */
    savingsAccountDetail: (accountId: number | string) =>
      `/(tabs)/savings/${accountId}`,

    savingsAccountHistory: (accountId: number | string) =>
      `/(tabs)/savings/history?accountId=${accountId}`,

    /* -----------------------------
       Group dynamic helpers
    ----------------------------- */
    groupMemberships: (groupId: number | string) =>
      `/(tabs)/groups/memberships?groupId=${groupId}`,

    groupJoinRequests: (groupId: number | string) =>
      `/(tabs)/groups/join-requests?groupId=${groupId}`,

    groupAdminJoinRequests: (groupId: number | string) =>
      `/(tabs)/groups/admin-join-requests?groupId=${groupId}`,

    groupContribute: (groupId: number | string) =>
      `/(tabs)/groups/contribute?groupId=${groupId}`,

    groupHistory: (groupId: number | string) =>
      `/(tabs)/groups/history?groupId=${groupId}`,

    groupEdit: (groupId: number | string) =>
      `/(tabs)/groups/edit?groupId=${groupId}`,

    /* -----------------------------
       Merry dynamic helpers
    ----------------------------- */
    merryMembers: (merryId: number | string) =>
      `/(tabs)/merry/members?merryId=${merryId}`,

    merryJoinRequests: (merryId: number | string) =>
      `/(tabs)/merry/join-requests?merryId=${merryId}`,

    merryAdminJoinRequests: (merryId: number | string) =>
      `/(tabs)/merry/admin-join-requests?merryId=${merryId}`,

    merryContribute: (merryId: number | string) =>
      `/(tabs)/merry/contribute?merryId=${merryId}`,

    merryHistory: (merryId: number | string) =>
      `/(tabs)/merry/history?merryId=${merryId}`,

    merryPayoutSchedule: (merryId: number | string) =>
      `/(tabs)/merry/payouts-schedule?merryId=${merryId}`,

    merryAdminPayoutCreate: (merryId: number | string) =>
      `/(tabs)/merry/admin-payout-create?merryId=${merryId}`,
  },
} as const;
