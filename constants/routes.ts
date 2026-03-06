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

    savings: "/(tabs)/savings",
    savingsCreate: "/(tabs)/savings/create",

    payments: "/(tabs)/payments",
    paymentsLedger: "/(tabs)/payments/ledger",
    paymentsDeposit: "/(tabs)/payments/deposit",
    paymentsWithdrawals: "/(tabs)/payments/withdrawals",
    paymentsRequestWithdrawal: "/(tabs)/payments/request-withdrawal",

    loans: "/(tabs)/loans",
    loansRequest: "/(tabs)/loans/request",
    loansPay: "/(tabs)/loans/pay",
    loansAddGuarantor: "/(tabs)/loans/add-guarantor",
    loansGuarantees: "/(tabs)/loans/guarantees",

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

    groups: "/(tabs)/groups",
    groupsMemberships: "/(tabs)/groups/memberships",
    groupsAddMembership: "/(tabs)/groups/add-membership",

    profile: "/(tabs)/profile",
    profileEdit: "/(tabs)/profile/edit",
    profileKyc: "/(tabs)/profile/kyc",
  },

  dynamic: {
    loanDetail: (id: number | string) => `/(tabs)/loans/${id}`,
    merryDetail: (id: number | string) => `/(tabs)/merry/${id}`,
    groupDetail: (id: number | string) => `/(tabs)/groups/${id}`,
    savingsAccountHistory: (accountId: number | string) =>
      `/(tabs)/savings/history?accountId=${accountId}`,
  },
} as const;