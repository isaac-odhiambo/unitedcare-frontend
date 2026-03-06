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
import { getErrorMessage } from "@/services/api";
import { getMyLoans, Loan } from "@/services/loans";
import {
  canRequestLoan,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type LoansUser = Partial<MeResponse> & Partial<SessionUser>;

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatusPill({ status }: { status: string }) {
  const s = String(status || "").toUpperCase();

  const bg =
    s === "APPROVED" || s === "COMPLETED"
      ? "rgba(46, 125, 50, 0.12)"
      : s === "REJECTED" || s === "DEFAULTED"
      ? "rgba(211, 47, 47, 0.12)"
      : s === "UNDER_REVIEW"
      ? "rgba(37, 99, 235, 0.12)"
      : "rgba(242, 140, 40, 0.14)";

  const color =
    s === "APPROVED" || s === "COMPLETED"
      ? COLORS.success
      : s === "REJECTED" || s === "DEFAULTED"
      ? COLORS.danger
      : s === "UNDER_REVIEW"
      ? COLORS.info
      : COLORS.accent;

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{s}</Text>
    </View>
  );
}

function LoanRow({ loan }: { loan: Loan }) {
  const context = loan.merry
    ? `Merry #${loan.merry}`
    : loan.group
    ? `Group #${loan.group}`
    : "General";

  return (
    <Card style={styles.loanCard}>
      <View style={styles.loanTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.loanTitle}>Loan #{loan.id}</Text>
          <Text style={styles.loanSub}>
            {context} • {loan.term_weeks} weeks
          </Text>
        </View>
        <StatusPill status={loan.status} />
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Principal</Text>
          <Text style={styles.metricValue}>{formatKes(loan.principal)}</Text>
        </View>

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Outstanding</Text>
          <Text style={styles.metricValue}>
            {formatKes(loan.outstanding_balance ?? "0.00")}
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Text
          style={styles.viewLink}
          onPress={() => router.push(ROUTES.dynamic.loanDetail(loan.id) as any)}
        >
          View details
        </Text>

        <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
      </View>
    </Card>
  );
}

export default function LoansIndexScreen() {
  const [user, setUser] = useState<LoansUser | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const loanAllowed = canRequestLoan(user);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profileKyc);
  }, []);

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const [sessionRes, meRes, loansRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyLoans(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: LoansUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      if (!mergedUser) {
        setLoans([]);
        return;
      }

      setLoans(
        loansRes.status === "fulfilled" && Array.isArray(loansRes.value)
          ? loansRes.value
          : []
      );

      if (loansRes.status === "rejected") {
        setError(getErrorMessage(loansRes.reason));
      }
    } catch (e: any) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const active = useMemo(
    () =>
      loans.filter((l) =>
        ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(
          String(l.status || "").toUpperCase()
        )
      ),
    [loans]
  );

  const completed = useMemo(
    () =>
      loans.filter((l) =>
        ["COMPLETED", "REJECTED", "DEFAULTED"].includes(
          String(l.status || "").toUpperCase()
        )
      ),
    [loans]
  );

  const totalOutstanding = useMemo(
    () =>
      active.reduce((sum, l) => {
        const n = Number(l.outstanding_balance ?? 0);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [active]
  );

  const totalActive = active.length;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
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
        <View>
          <Text style={styles.hTitle}>Loans</Text>
          <Text style={styles.hSub}>
            Manage requests, guarantors and repayments •{" "}
            {isAdmin ? "Admin" : "Member"}
          </Text>
        </View>

        <Ionicons name="cash-outline" size={22} color={COLORS.primary} />
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

      {!kycComplete && (
        <Section title="KYC Notice">
          <Card style={styles.noticeCard} onPress={goToKyc}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.noticeText}>
              You can view loan history and repayments, but requesting a new loan
              requires completed KYC.
            </Text>
          </Card>
        </Section>
      )}

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>Active Loans</Text>
          <Text style={styles.summaryValue}>{totalActive}</Text>
        </View>

        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>Outstanding</Text>
          <Text style={styles.summaryValue}>
            {formatKes(totalOutstanding)}
          </Text>
        </View>
      </View>

      <View style={styles.actionBar}>
        <Button
          title={loanAllowed ? "Request Loan" : "Complete KYC"}
          onPress={() =>
            loanAllowed ? router.push(ROUTES.tabs.loansRequest) : goToKyc()
          }
          style={{ flex: 1 }}
        />
        <View style={{ width: SPACING.sm }} />
        <Button
          title="Guarantees"
          variant="secondary"
          onPress={() => router.push(ROUTES.tabs.loansGuarantees)}
          style={{ flex: 1 }}
        />
      </View>

      <Section
        title="Active"
        right={
          <Text
            style={styles.smallLink}
            onPress={() =>
              loanAllowed ? router.push(ROUTES.tabs.loansRequest) : goToKyc()
            }
          >
            {loanAllowed ? "New request" : "Complete KYC"}
          </Text>
        }
      >
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : active.length === 0 ? (
          <EmptyState
            title="No active loans"
            subtitle={
              loanAllowed
                ? "Request a loan to get started."
                : "Complete KYC before requesting a loan."
            }
            actionLabel={loanAllowed ? "Request loan" : "Complete KYC"}
            onAction={() =>
              loanAllowed ? router.push(ROUTES.tabs.loansRequest) : goToKyc()
            }
          />
        ) : (
          active.map((l) => <LoanRow key={l.id} loan={l} />)
        )}
      </Section>

      <Section title="History">
        {!loading && completed.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No loan history"
            subtitle="Completed and rejected loans will appear here."
          />
        ) : (
          completed.map((l) => <LoanRow key={l.id} loan={l} />)
        )}
      </Section>

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
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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

  errorCard: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.danger,
  },

  noticeCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  summaryGrid: {
    marginTop: SPACING.md,
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

  actionBar: {
    flexDirection: "row",
    marginTop: SPACING.md,
    alignItems: "center",
  },

  muted: {
    marginTop: 6,
    fontFamily: FONT.regular,
    color: COLORS.gray,
  },

  smallLink: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.primary,
  },

  loanCard: {
    marginBottom: SPACING.md,
  },

  loanTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  loanTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  loanSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  metrics: {
    marginTop: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.sm as any,
  },

  metric: {
    width: "48%",
  },

  metricLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
  },

  metricValue: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  viewLink: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.primary,
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  pillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});