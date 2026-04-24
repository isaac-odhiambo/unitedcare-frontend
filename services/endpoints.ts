// services/endpoints.ts
// --------------------------------------------------
// Central place for ALL backend API endpoint paths
// Keep this file as the single source of truth
// --------------------------------------------------

export const ENDPOINTS = {
  /* =========================================================
     ACCOUNTS
  ========================================================= */
  accounts: {
    register: "/api/accounts/register/",
    verifyOtp: "/api/accounts/verify-otp/",
    resendOtp: "/api/accounts/resend-otp/",
    login: "/api/accounts/login/",
    me: "/api/accounts/me/",
    forgotPassword: "/api/accounts/forgot-password/",
    resetPassword: "/api/accounts/reset-password/",
  },

  /* =========================================================
     SAVINGS
  ========================================================= */
  savings: {
    accounts: "/api/savings/accounts/",
    createAccount: "/api/savings/accounts/create/",
    deposit: "/api/savings/deposit/",
    history: (accountId: number | string) =>
      `/api/savings/accounts/${accountId}/history/`,
  },

  /* =========================================================
     PAYMENTS (Centralized payment engine)
  ========================================================= */
  payments: {
    mpesaConfig: "/payments/mpesa-config/",

    adminMpesaConfig: "/payments/mpesa-config/admin/",
    adminMpesaConfigDetail: (configId: number | string) =>
      `/payments/mpesa-config/admin/${configId}/`,

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

    myMpesaTransactions: "/payments/mpesa/me/transactions/",
    myMpesaTransactionDetail: (id: number | string) =>
      `/payments/mpesa/me/transactions/${id}/`,

    feePreview: "/payments/fees/preview/",
  },

  /* =========================================================
     GROUPS
  ========================================================= */
  groups: {
    root: "/api/groups/",

    groups: "/api/groups/groups/",
    detail: (groupId: number | string) => `/api/groups/groups/${groupId}/`,

    available: "/api/groups/groups/available/",

    memberships: "/api/groups/memberships/",
    membershipDetail: (membershipId: number | string) =>
      `/api/groups/memberships/${membershipId}/`,

    dependants: "/api/groups/dependants/",

    joinRequests: "/api/groups/join-requests/",
    joinRequestDetail: (requestId: number | string) =>
      `/api/groups/join-requests/${requestId}/`,

    approveJoinRequest: (requestId: number | string) =>
      `/api/groups/join-requests/${requestId}/approve/`,

    rejectJoinRequest: (requestId: number | string) =>
      `/api/groups/join-requests/${requestId}/reject/`,

    cancelJoinRequest: (requestId: number | string) =>
      `/api/groups/join-requests/${requestId}/cancel/`,

    mySavings: "/api/groups/my-savings/",
    contribute: "/api/groups/contribute/",

    myContributions: (groupId: number | string) =>
      `/api/groups/${groupId}/contributions/my/`,

    allContributions: (groupId: number | string) =>
      `/api/groups/${groupId}/contributions/all/`,
  },

  /* =========================================================
     LOANS
  ========================================================= */
  loans: {
    myLoans: "/api/loans/myloans/",
    eligibility: "/api/loans/eligibility/",
    guarantorCandidates: "/api/loans/guarantor-candidates/",
    request: "/api/loans/request/",

    detail: (loanId: number | string) => `/api/loans/loan/${loanId}/`,

    approve: (loanId: number | string) =>
      `/api/loans/loan/${loanId}/approve/`,

    reject: (loanId: number | string) =>
      `/api/loans/loan/${loanId}/reject/`,

    pay: (loanId: number | string) =>
      `/api/loans/loan/${loanId}/pay/`,

    addGuarantor: "/api/loans/loan/add-guarantor/",

    securityPreview: "/api/loans/security-preview/",

    myGuaranteeRequests: "/api/loans/guarantee/my-requests/",

    acceptGuarantee: (guarantorId: number | string) =>
      `/api/loans/guarantee/${guarantorId}/accept/`,

    rejectGuarantee: (guarantorId: number | string) =>
      `/api/loans/guarantee/${guarantorId}/reject/`,
  },

  /* =========================================================
     MERRY-GO-ROUND (QUEUE-BASED ROSCA)
  ========================================================= */
  merry: {
    my: "/api/merry/my/",
    available: "/api/merry/available/",
    create: "/api/merry/create/",

    detail: (merryId: number | string) => `/api/merry/${merryId}/`,

    dashboard: (merryId: number | string) =>
      `/api/merry/${merryId}/dashboard/`,

    duesSummary: "/api/merry/dues/summary/",

    duesAdmin: (merryId: number | string) =>
      `/api/merry/${merryId}/dues/`,

    ensureDues: (merryId: number | string) =>
      `/api/merry/${merryId}/dues/ensure/`,

    duesMy: (merryId: number | string) =>
      `/api/merry/${merryId}/dues/my/`,

    /* =========================
       JOIN FLOW
    ========================= */
    joinRequest: (merryId: number | string) =>
      `/api/merry/${merryId}/join/request/`,

    myJoinRequests: "/api/merry/join/requests/my/",

    adminJoinRequests: (merryId: number | string) =>
      `/api/merry/${merryId}/join/requests/`,

    approveJoinRequest: (requestId: number | string) =>
      `/api/merry/join/requests/${requestId}/approve/`,

    cancelJoinRequest: (requestId: number | string) =>
      `/api/merry/join/requests/${requestId}/cancel/`,

    rejectJoinRequest: (requestId: number | string) =>
      `/api/merry/join/requests/${requestId}/reject/`,

    /* =========================
       MEMBERS / SEATS
    ========================= */
    members: (merryId: number | string) =>
      `/api/merry/${merryId}/members/`,

    seats: (merryId: number | string) =>
      `/api/merry/${merryId}/seats/`,

    /* =========================
       PAYMENTS
    ========================= */
    paymentBreakdown: (merryId: number | string) =>
      `/api/merry/${merryId}/payments/breakdown/`,

    paymentIntent: (merryId: number | string) =>
      `/api/merry/${merryId}/payments/intent/`,

    myPayments: "/api/merry/payments/my/",

    confirmPayment: (paymentId: number | string) =>
      `/api/merry/payments/${paymentId}/confirm/`,

    /* =========================
       WALLET
    ========================= */
    myWallet: "/api/merry/wallet/my/",
    myWalletTransactions: "/api/merry/wallet/my/transactions/",

    adminUserWallet: (userId: number | string) =>
      `/api/merry/admin/users/${userId}/wallet/`,

    /* =========================
       PAYOUT FLOW
    ========================= */
    payoutSchedule: (merryId: number | string) =>
      `/api/merry/${merryId}/payouts/schedule/`,

    nextTurn: (merryId: number | string) =>
      `/api/merry/${merryId}/payouts/next-turn/`,

    payoutReadiness: (merryId: number | string) =>
      `/api/merry/${merryId}/payouts/readiness/`,

    createPayout: (merryId: number | string) =>
      `/api/merry/${merryId}/payouts/create/`,

    createNextPayout: (merryId: number | string) =>
      `/api/merry/${merryId}/payouts/create-next/`,

    markPayoutPaid: (payoutId: number | string) =>
      `/api/merry/payouts/${payoutId}/paid/`,
  },
} as const;

export type EndpointTree = typeof ENDPOINTS;