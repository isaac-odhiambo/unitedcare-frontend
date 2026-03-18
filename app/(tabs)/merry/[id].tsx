// app/(tabs)/loans/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getAccessToken, getErrorMessage } from "@/services/api";
import {
  acceptGuarantee,
  getApiErrorMessage,
  getLoanEligibilityPreview,
  getMyGuaranteeRequests,
  getMyLoans,
  Loan,
  LoanEligibilityPreview,
  LoanGuarantor,
  rejectGuarantee,
} from "@/services/loans";
import {
  canWithdraw,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type LoanUser = Partial<MeResponse> & Partial<SessionUser>;

function normalizeToken(token?: string | null) {
  const clean = String(token || "").trim();
  return clean || null;
}

function hasJwtShape(token?: string | null) {
  const clean = normalizeToken(token);
  return !!clean && clean.split(".").length === 3;
}

function toNum(x?: string | number | null) {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtKES(amount?: string | number | null) {
  const n = toNum(amount);
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function NoticeCard({
  icon,
  text,
  buttonLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  buttonLabel?: string;
  onPress?: () => void;
}) {
  return (
    <Card style={styles.noticeCard}>
      <View style={styles.noticeTop}>
        <Ionicons name={icon} size={18} color={COLORS.info} />
        <Text style={styles.noticeText}>{text}</Text>
      </View>

      {buttonLabel && onPress ? (
        <View style={{ marginTop: SPACING.sm }}>
          <Button title={buttonLabel} variant="secondary" onPress={onPress} />
        </View>
      ) : null}
    </Card>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{String(value)}</Text>
    </View>
  );
}

function statusColor(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return COLORS.success;
    case "COMPLETED":
      return COLORS.primary;
    case "PENDING":
    case "UNDER_REVIEW":
      return COLORS.warning;
    case "DEFAULTED":
    case "REJECTED":
    case "CANCELLED":
      return COLORS.danger;
    default:
      return COLORS.gray;
  }
}

function statusText(status?: string | null) {
  if (!status) return "—";
  return String(status).replaceAll("_", " ");
}

function getLoanSubtitle(loan: Loan) {
  const productName =
    loan.product_detail?.name || loan.product_name || `Product #${loan.product}`;
  return `${productName} • ${fmtKES(loan.principal)} • ${loan.term_weeks} week(s)`;
}

function canPay(loan: Loan) {
  return (
    (loan.status === "APPROVED" || loan.status === "DEFAULTED") &&
    toNum(loan.outstanding_balance) > 0
  );
}

export default function LoansIndexScreen() {
  const [user, setUser] = useState<LoanUser | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [guaranteeRequests, setGuaranteeRequests] = useState<LoanGuarantor[]>([]);
  const [eligibility, setEligibility] = useState<LoanEligibilityPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [processingGuaranteeId, setProcessingGuaranteeId] = useState<number | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const safeUser = user ?? {};
  const isAdmin = isAdminUser(safeUser);
  const kycComplete = isKycComplete(safeUser);
  const withdrawAllowed = canWithdraw(safeUser);

  const load = useCallback(async () => {
    try {
      setError("");

      const token = await getAccessToken();
      const hasToken = hasJwtShape(token);

      console.log("LOANS SCREEN DEBUG -> token exists:", hasToken);
      console.log(
        "LOANS SCREEN DEBUG -> token preview:",
        typeof token === "string" ? token.slice(0, 20) : null
      );

      setAuthChecked(hasToken);

      if (!hasToken) {
        console.log("LOANS SCREEN DEBUG -> no valid token, clearing local state");
        setUser(null);
        setLoans([]);
        setGuaranteeRequests([]);
        setEligibility(null);
        return;
      }

      const sessionUser = await getSessionUser();
      console.log("LOANS SCREEN DEBUG -> session user:", sessionUser);

      if (sessionUser) {
        setUser(sessionUser);
      } else {
        setUser({});
      }

      const [meRes, loansRes, guaranteeRes, eligibilityRes] =
        await Promise.allSettled([
          Promise.resolve().then(() => getMe()),
          Promise.resolve().then(() => getMyLoans()),
          Promise.resolve().then(() => getMyGuaranteeRequests()),
          Promise.resolve().then(() => getLoanEligibilityPreview()),
        ]);

      let nextError = "";

      if (meRes.status === "fulfilled" && meRes.value) {
        console.log("LOANS SCREEN DEBUG -> /me success:", meRes.value);

        const mergedUser: LoanUser = {
          ...(sessionUser ?? {}),
          ...(meRes.value ?? {}),
        };

        setUser(mergedUser);
        await saveSessionUser(mergedUser);
      } else {
        console.log("LOANS SCREEN DEBUG -> /me failed:", {
          raw: meRes.status === "rejected" ? meRes.reason : null,
          name: meRes.status === "rejected" ? meRes.reason?.name : undefined,
          message: meRes.status === "rejected" ? meRes.reason?.message : undefined,
          stack: meRes.status === "rejected" ? meRes.reason?.stack : undefined,
          status:
            meRes.status === "rejected" ? meRes.reason?.response?.status : undefined,
          data:
            meRes.status === "rejected" ? meRes.reason?.response?.data : undefined,
          url: meRes.status === "rejected" ? meRes.reason?.config?.url : undefined,
          baseURL:
            meRes.status === "rejected" ? meRes.reason?.config?.baseURL : undefined,
        });

        if (!nextError && meRes.status === "rejected") {
          nextError =
            getApiErrorMessage(meRes.reason) || getErrorMessage(meRes.reason);
        }
      }

      if (loansRes.status === "fulfilled") {
        console.log("LOANS SCREEN DEBUG -> loans success:", loansRes.value);
        setLoans(Array.isArray(loansRes.value) ? loansRes.value : []);
      } else {
        console.log("LOANS SCREEN DEBUG -> loans failed:", {
          raw: loansRes.reason,
          name: loansRes.reason?.name,
          message: loansRes.reason?.message,
          stack: loansRes.reason?.stack,
          status: loansRes.reason?.response?.status,
          data: loansRes.reason?.response?.data,
          url: loansRes.reason?.config?.url,
          baseURL: loansRes.reason?.config?.baseURL,
        });

        setLoans([]);
        if (!nextError) {
          nextError =
            getApiErrorMessage(loansRes.reason) ||
            getErrorMessage(loansRes.reason);
        }
      }

      if (guaranteeRes.status === "fulfilled") {
        console.log("LOANS SCREEN DEBUG -> guarantees success:", guaranteeRes.value);
        setGuaranteeRequests(
          Array.isArray(guaranteeRes.value) ? guaranteeRes.value : []
        );
      } else {
        console.log("LOANS SCREEN DEBUG -> guarantees failed:", {
          raw: guaranteeRes.reason,
          name: guaranteeRes.reason?.name,
          message: guaranteeRes.reason?.message,
          stack: guaranteeRes.reason?.stack,
          status: guaranteeRes.reason?.response?.status,
          data: guaranteeRes.reason?.response?.data,
          url: guaranteeRes.reason?.config?.url,
          baseURL: guaranteeRes.reason?.config?.baseURL,
        });

        setGuaranteeRequests([]);
        if (!nextError) {
          nextError =
            getApiErrorMessage(guaranteeRes.reason) ||
            getErrorMessage(guaranteeRes.reason);
        }
      }

      if (eligibilityRes.status === "fulfilled") {
        console.log(
          "LOANS SCREEN DEBUG -> eligibility success:",
          eligibilityRes.value
        );
        setEligibility(eligibilityRes.value ?? null);
      } else {
        console.log("LOANS SCREEN DEBUG -> eligibility failed:", {
          raw: eligibilityRes.reason,
          name: eligibilityRes.reason?.name,
          message: eligibilityRes.reason?.message,
          stack: eligibilityRes.reason?.stack,
          status: eligibilityRes.reason?.response?.status,
          data: eligibilityRes.reason?.response?.data,
          url: eligibilityRes.reason?.config?.url,
          baseURL: eligibilityRes.reason?.config?.baseURL,
        });

        setEligibility(null);
        if (!nextError) {
          nextError =
            getApiErrorMessage(eligibilityRes.reason) ||
            getErrorMessage(eligibilityRes.reason);
        }
      }

      if (nextError) {
        console.log("LOANS SCREEN DEBUG -> final error:", nextError);
        setError(nextError);
      }
    } catch (e: any) {
      console.log("LOANS SCREEN DEBUG -> fatal catch raw:", e);
      console.log("LOANS SCREEN DEBUG -> fatal catch parsed:", {
        name: e?.name,
        message: e?.message,
        stack: e?.stack,
        status: e?.response?.status,
        data: e?.response?.data,
        url: e?.config?.url,
        baseURL: e?.config?.baseURL,
      });

      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, []);

  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);
      await load();
    } finally {
      setLoading(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      initialLoad();
    }, [initialLoad])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleAcceptGuarantee = useCallback(
    async (guarantorId: number) => {
      try {
        setProcessingGuaranteeId(guarantorId);
        setError("");
        await acceptGuarantee(guarantorId);
        await load();
      } catch (e: any) {
        console.log("LOANS SCREEN DEBUG -> accept guarantee failed:", {
          raw: e,
          guarantorId,
          name: e?.name,
          message: e?.message,
          stack: e?.stack,
          status: e?.response?.status,
          data: e?.response?.data,
          url: e?.config?.url,
          baseURL: e?.config?.baseURL,
        });
        setError(getApiErrorMessage(e) || getErrorMessage(e));
      } finally {
        setProcessingGuaranteeId(null);
      }
    },
    [load]
  );

  const handleRejectGuarantee = useCallback(
    async (guarantorId: number) => {
      try {
        setProcessingGuaranteeId(guarantorId);
        setError("");
        await rejectGuarantee(guarantorId);
        await load();
      } catch (e: any) {
        console.log("LOANS SCREEN DEBUG -> reject guarantee failed:", {
          raw: e,
          guarantorId,
          name: e?.name,
          message: e?.message,
          stack: e?.stack,
          status: e?.response?.status,
          data: e?.response?.data,
          url: e?.config?.url,
          baseURL: e?.config?.baseURL,
        });
        setError(getApiErrorMessage(e) || getErrorMessage(e));
      } finally {
        setProcessingGuaranteeId(null);
      }
    },
    [load]
  );

  const totals = useMemo(() => {
    const active = loans.filter((l) =>
      ["PENDING", "UNDER_REVIEW", "APPROVED", "DEFAULTED"].includes(
        String(l.status).toUpperCase()
      )
    ).length;

    const approved = loans.filter(
      (l) => String(l.status).toUpperCase() === "APPROVED"
    ).length;

    const completed = loans.filter(
      (l) => String(l.status).toUpperCase() === "COMPLETED"
    ).length;

    const outstanding = loans.reduce(
      (sum, l) => sum + toNum(l.outstanding_balance),
      0
    );

    return {
      total: loans.length,
      active,
      approved,
      completed,
      outstanding,
      guarantees: guaranteeRequests.length,
    };
  }, [loans, guaranteeRequests]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!authChecked) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to access loans."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.hTitle}>Loans</Text>
          <Text style={styles.hSub}>
            Request a loan, track repayments, and manage guarantee requests.
          </Text>
        </View>

        <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!kycComplete ? (
        <Section title="KYC Notice">
          <NoticeCard
            icon="shield-checkmark-outline"
            text="Complete KYC to improve access to withdrawal and loan-related services."
            buttonLabel="Complete KYC"
            onPress={() => router.push(ROUTES.tabs.profileKyc as any)}
          />
        </Section>
      ) : null}

      {eligibility ? (
        <Section title="Eligibility">
          <Card style={styles.eligibilityCard}>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Eligible now</Text>
              <Text
                style={[
                  styles.kvValue,
                  { color: eligibility.eligible ? COLORS.success : COLORS.warning },
                ]}
              >
                {eligibility.eligible ? "Yes" : "Not yet"}
              </Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Available savings</Text>
              <Text style={styles.kvValue}>
                {fmtKES(eligibility.available_savings)}
              </Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Maximum request</Text>
              <Text style={styles.kvValue}>
                {fmtKES(eligibility.max_allowed)}
              </Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Active loan</Text>
              <Text style={styles.kvValue}>
                {eligibility.has_active_loan ? "Yes" : "No"}
              </Text>
            </View>

            {eligibility.reason ? (
              <Text style={styles.eligibilityNote}>{eligibility.reason}</Text>
            ) : null}
          </Card>
        </Section>
      ) : null}

      <View style={styles.summaryGrid}>
        <SummaryCard label="My Loans" value={totals.total} />
        <SummaryCard label="Active" value={totals.active} />
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <SummaryCard label="Approved" value={totals.approved} />
        <SummaryCard label="Completed" value={totals.completed} />
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <SummaryCard label="Outstanding" value={fmtKES(totals.outstanding)} />
        <SummaryCard label="Guarantee Requests" value={totals.guarantees} />
      </View>

      <Card style={styles.quickActionsCard}>
        <Section title="Quick Actions">
          <View style={styles.actionsRow}>
            <Button
              title="Request Loan"
              onPress={() => router.push(ROUTES.tabs.loansRequest as any)}
              style={{ flex: 1 }}
              leftIcon={
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={COLORS.white}
                />
              }
            />
            <View style={{ width: SPACING.sm }} />
            <Button
              title="Guarantee Requests"
              variant="secondary"
              onPress={() => router.push(ROUTES.tabs.loansGuarantees as any)}
              style={{ flex: 1 }}
              leftIcon={
                <Ionicons name="people-outline" size={18} color={COLORS.dark} />
              }
            />
          </View>

          {!withdrawAllowed ? (
            <View style={{ marginTop: SPACING.sm }}>
              <NoticeCard
                icon="information-circle-outline"
                text="Some loan disbursement or withdrawal-related actions may remain limited until account checks are complete."
              />
            </View>
          ) : null}
        </Section>
      </Card>

      <Section title="My Guarantee Requests">
        {guaranteeRequests.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No guarantee requests"
            subtitle="Any pending requests to guarantee another member’s loan will appear here."
          />
        ) : (
          guaranteeRequests.map((g) => {
            const busy = processingGuaranteeId === g.id;
            const guarantorName = g.guarantor_detail?.full_name;

            return (
              <Card key={`gr-${g.id}`} style={styles.itemCard}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.title}>Loan Guarantee Request</Text>
                    <Text style={styles.sub}>
                      Loan #{g.loan}
                      {guarantorName ? ` • ${guarantorName}` : ""}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.badge,
                      { color: g.accepted ? COLORS.success : COLORS.warning },
                    ]}
                  >
                    {g.accepted ? "ACCEPTED" : "PENDING"}
                  </Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Loan ID</Text>
                  <Text style={styles.kvValue}>{String(g.loan)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Accepted at</Text>
                  <Text style={styles.kvValue}>{fmtDate(g.accepted_at)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Reserved amount</Text>
                  <Text style={styles.kvValue}>
                    {g.reserved_amount ? fmtKES(g.reserved_amount) : "—"}
                  </Text>
                </View>

                {!g.accepted ? (
                  <View style={styles.actionsRow}>
                    <Button
                      title={busy ? "Please wait..." : "Accept"}
                      onPress={() => handleAcceptGuarantee(g.id)}
                      style={{ flex: 1 }}
                      disabled={busy}
                      leftIcon={
                        <Ionicons
                          name="checkmark-outline"
                          size={18}
                          color={COLORS.white}
                        />
                      }
                    />
                    <View style={{ width: SPACING.sm }} />
                    <Button
                      title="Reject"
                      variant="secondary"
                      onPress={() => handleRejectGuarantee(g.id)}
                      style={{ flex: 1 }}
                      disabled={busy}
                      leftIcon={
                        <Ionicons
                          name="close-outline"
                          size={18}
                          color={COLORS.dark}
                        />
                      }
                    />
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </Section>

      <Section title="My Loans">
        {loans.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No loans yet"
            subtitle="Your submitted and approved loans will appear here."
            actionLabel="Request Loan"
            onAction={() => router.push(ROUTES.tabs.loansRequest as any)}
          />
        ) : (
          loans.map((loan) => {
            const outstanding = toNum(loan.outstanding_balance);
            const paid = toNum(loan.total_paid);
            const total = toNum(loan.total_payable);

            return (
              <Card key={`loan-${loan.id}`} style={styles.itemCard}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.title}>Loan #{loan.id}</Text>
                    <Text style={styles.sub}>{getLoanSubtitle(loan)}</Text>
                  </View>

                  <Text
                    style={[styles.badge, { color: statusColor(loan.status) }]}
                  >
                    {statusText(loan.status).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Principal</Text>
                  <Text style={styles.kvValue}>{fmtKES(loan.principal)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Total payable</Text>
                  <Text style={styles.kvValue}>
                    {total > 0 ? fmtKES(total) : "Pending approval"}
                  </Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Paid so far</Text>
                  <Text style={styles.kvValue}>{fmtKES(paid)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Outstanding</Text>
                  <Text style={styles.kvValue}>{fmtKES(outstanding)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Created</Text>
                  <Text style={styles.kvValue}>{fmtDate(loan.created_at)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Approved</Text>
                  <Text style={styles.kvValue}>{fmtDate(loan.approved_at)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Security target</Text>
                  <Text style={styles.kvValue}>
                    {loan.security_target ? fmtKES(loan.security_target) : "—"}
                  </Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Reserved security</Text>
                  <Text style={styles.kvValue}>
                    {loan.security_reserved_total
                      ? fmtKES(loan.security_reserved_total)
                      : "—"}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    title="Open"
                    variant="secondary"
                    onPress={() =>
                      router.push(ROUTES.dynamic.loanDetail(loan.id) as any)
                    }
                    style={{ flex: 1 }}
                  />
                  <View style={{ width: SPACING.sm }} />
                  <Button
                    title={canPay(loan) ? "Repay Loan" : "View"}
                    onPress={() =>
                      router.push(ROUTES.dynamic.loanDetail(loan.id) as any)
                    }
                    style={{ flex: 1 }}
                    leftIcon={
                      <Ionicons
                        name={canPay(loan) ? "cash-outline" : "eye-outline"}
                        size={18}
                        color={COLORS.white}
                      />
                    }
                  />
                </View>
              </Card>
            );
          })
        )}
      </Section>

      {isAdmin ? (
        <Section title="Admin Note">
          <NoticeCard
            icon="shield-checkmark-outline"
            text="Loan approvals and review actions should be handled from the admin loan review screens or Django admin tools."
          />
        </Section>
      ) : null}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.card,
  },
  quickActionsCard: {
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
  },
  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },
  noticeCard: {
    padding: SPACING.md,
  },
  noticeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  noticeText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },
  eligibilityCard: {
    padding: SPACING.md,
    ...SHADOW.card,
  },
  eligibilityNote: {
    marginTop: SPACING.sm,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },
  summaryValue: {
    marginTop: 8,
    fontFamily: FONT.bold,
    fontSize: 16,
    color: COLORS.dark,
  },
  hTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },
  hSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },
  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  title: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },
  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },
  badge: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },
  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },
  kvLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },
  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },
  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },
});
