// constants/routes.ts

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
    notifications: "/(tabs)/notifications",

    savings: "/(tabs)/savings",
    savingsSave: "/(tabs)/savings/save",
    savingsHistory: "/(tabs)/savings/history",

    payments: "/(tabs)/payments",
    paymentsLedger: "/(tabs)/payments/ledger",
    paymentsDeposit: "/(tabs)/payments/deposit",
    paymentsWithdrawals: "/(tabs)/payments/withdrawals",
    paymentsRequestWithdrawal: "/(tabs)/payments/request-withdrawal",

    loans: "/(tabs)/loans",
    loansRequest: "/(tabs)/loans/request",
    loansPay: "/(tabs)/loans/pay",
    loansAddGuarantor: "/(tabs)/loans/add-guarantor",
    loansGuaranteeRequests: "/(tabs)/loans/guarantee-requests",
    loansGuarantees: "/(tabs)/loans/guarantees",
    loansHistory: "/(tabs)/loans/history",
    loansAdminApprove: "/(tabs)/loans/admin-approve",

    merry: "/(tabs)/merry",
    merryContribute: "/(tabs)/merry/contribute",
    merryHistory: "/(tabs)/merry/history",
    merryJoinRequest: "/(tabs)/merry/join-request",
    merryPayments: "/(tabs)/merry/contributions",
    merryCreate: "/(tabs)/merry/create",
    merryMembers: "/(tabs)/merry/members",
    merryPayoutsSchedule: "/(tabs)/merry/payouts-schedule",
    merryAdminJoinRequests: "/(tabs)/merry/admin-join-requests",
    merryAdminPayoutCreate: "/(tabs)/merry/admin-payout-create",

    groups: "/(tabs)/groups",
    groupsAvailable: "/(tabs)/groups/available",
    groupsMySavings: "/(tabs)/groups/my-savings",
    groupsMemberships: "/(tabs)/groups/memberships",
    groupsJoinRequests: "/(tabs)/groups/join-requests",
    groupsContribute: "/(tabs)/groups/contribute",
    groupsHistory: "/(tabs)/groups/history",
    groupsAdminJoinRequests: "/(tabs)/groups/admin-join-requests",

    profile: "/(tabs)/profile",
    profileEdit: "/(tabs)/profile/edit",
    
  },

  dynamic: {
    loanDetail: (id: number | string) => `/(tabs)/loans/${id}`,
    merryDetail: (id: number | string) => `/(tabs)/merry/${id}`,
    groupDetail: (id: number | string) => `/(tabs)/groups/${id}`,

    savingsAccountDetail: (accountId: number | string) =>
      `/(tabs)/savings/${accountId}`,

    savingsAccountHistory: (accountId: number | string) =>
      `/(tabs)/savings/history?accountId=${accountId}`,

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

    merryMembers: (merryId: number | string) =>
      `/(tabs)/merry/members?merryId=${merryId}`,

    merryJoinRequest: (merryId: number | string) =>
      `/(tabs)/merry/join-request?merryId=${merryId}`,

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