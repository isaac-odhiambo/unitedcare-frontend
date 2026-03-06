// services/endpoints.ts
// --------------------------------------------------
// Central place for ALL backend API endpoint paths
// Keep this file as the single source of truth
// --------------------------------------------------

export const ENDPOINTS = {
  accounts: {
    register: "/api/accounts/register/",
    verifyOtp: "/api/accounts/verify-otp/",
    resendOtp: "/api/accounts/resend-otp/",
    login: "/api/accounts/login/",
    me: "/api/accounts/me/",
    forgotPassword: "/api/accounts/forgot-password/",
    resetPassword: "/api/accounts/reset-password/",
    kycSubmit: "/api/accounts/kyc/",
  },

  savings: {
    accounts: "/api/savings/accounts/",
    createAccount: "/api/savings/accounts/create/",
    deposit: "/api/savings/deposit/",
    history: (accountId: number | string) =>
      `/api/savings/accounts/${accountId}/history/`,
  },

  payments: {
    myLedger: "/payments/ledger/my/",
    adminLedger: "/payments/ledger/admin/",

    myWithdrawals: "/payments/withdrawals/my/",
    adminWithdrawals: "/payments/withdrawals/admin/",
    requestWithdrawal: "/payments/withdrawals/request/",
    approveWithdrawal: (withdrawalId: number | string) =>
      `/payments/withdrawals/${withdrawalId}/approve/`,
    rejectWithdrawal: (withdrawalId: number | string) =>
      `/payments/withdrawals/${withdrawalId}/reject/`,

    stkPush: "/payments/mpesa/stk-push/",
    adminMpesa: "/payments/mpesa/admin/",
  },

  groups: {
    root: "/api/groups/",
    groups: "/api/groups/groups/",
    detail: (groupId: number | string) => `/api/groups/groups/${groupId}/`,

    memberships: "/api/groups/memberships/",
    membershipDetail: (membershipId: number | string) =>
      `/api/groups/memberships/${membershipId}/`,

    contribute: "/api/groups/contribute/",
    mySavings: "/api/groups/my-savings/",

    myContributions: (groupId: number | string) =>
      `/api/groups/${groupId}/contributions/my/`,
    allContributions: (groupId: number | string) =>
      `/api/groups/${groupId}/contributions/all/`,
  },

  loans: {
    myLoans: "/api/loans/myloans/",
    request: "/api/loans/request/",

    detail: (loanId: number | string) => `/api/loans/loan/${loanId}/`,
    approve: (loanId: number | string) => `/api/loans/loan/${loanId}/approve/`,
    pay: (loanId: number | string) => `/api/loans/loan/${loanId}/pay/`,

    addGuarantor: "/api/loans/loan/add-guarantor/",

    myGuaranteeRequests: "/api/loans/guarantee/my-requests/",
    acceptGuarantee: (guarantorId: number | string) =>
      `/api/loans/guarantee/${guarantorId}/accept/`,
    rejectGuarantee: (guarantorId: number | string) =>
      `/api/loans/guarantee/${guarantorId}/reject/`,
  },

  merry: {
    my: "/api/merry/my/",
    create: "/api/merry/create/",

    detail: (merryId: number | string) => `/api/merry/${merryId}/`,

    duesAdmin: (merryId: number | string) => `/api/merry/${merryId}/dues/`,
    ensureDues: (merryId: number | string) =>
      `/api/merry/${merryId}/dues/ensure/`,
    duesMy: (merryId: number | string) => `/api/merry/${merryId}/dues/my/`,

    joinRequest: (merryId: number | string) =>
      `/api/merry/${merryId}/join/request/`,
    adminJoinRequests: (merryId: number | string) =>
      `/api/merry/${merryId}/join/requests/`,

    members: (merryId: number | string) => `/api/merry/${merryId}/members/`,
    seats: (merryId: number | string) => `/api/merry/${merryId}/seats/`,
    slots: (merryId: number | string) => `/api/merry/${merryId}/slots/`,

    paymentIntent: (merryId: number | string) =>
      `/api/merry/${merryId}/payments/intent/`,
    myPayments: "/api/merry/payments/my/",
    confirmPayment: (paymentId: number | string) =>
      `/api/merry/payments/${paymentId}/confirm/`,

    createPayout: (merryId: number | string) =>
      `/api/merry/${merryId}/payouts/create/`,
    payoutSchedule: (merryId: number | string) =>
      `/api/merry/${merryId}/payouts/schedule/`,
    markPayoutPaid: (payoutId: number | string) =>
      `/api/merry/payouts/${payoutId}/paid/`,

    myJoinRequests: "/api/merry/join/requests/my/",
    approveJoinRequest: (requestId: number | string) =>
      `/api/merry/join/requests/${requestId}/approve/`,
    cancelJoinRequest: (requestId: number | string) =>
      `/api/merry/join/requests/${requestId}/cancel/`,
    rejectJoinRequest: (requestId: number | string) =>
      `/api/merry/join/requests/${requestId}/reject/`,
  },
} as const;

export type EndpointTree = typeof ENDPOINTS;