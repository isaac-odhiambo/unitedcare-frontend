// app/(tabs)/payments/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import {
  getApiErrorMessage,
  getMyLedger,
  getMyWithdrawals,
  PaymentLedgerEntry,
  WithdrawalRequest,
} from "@/services/payments";
import {
  canWithdraw,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type PaymentsUser = Partial<MeResponse> & Partial<SessionUser>;

function money(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusBadgeColor(status: string) {
  const s = (status || "").toUpperCase();
  if (["PAID", "SUCCESS", "APPROVED", "COMPLETED"].includes(s)) {
    return COLORS.success;
  }
  if (["FAILED", "REJECTED", "CANCELLED", "DEFAULTED", "BLOCKED"].includes(s)) {
    return COLORS.danger;
  }
  if (["PROCESSING", "PENDING", "UNDER_REVIEW", "INITIATED", "TIMEOUT"].includes(s)) {
    return COLORS.warning;
  }
  return COLORS.gray;
}

function StatusPill({ label }: { label: string }) {
  const bg = statusBadgeColor(label);
  return (
    <View style={[styles.pill, { borderColor: bg }]}>
      <View style={[styles.pillDot, { backgroundColor: bg }]} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function categoryLabel(category?: string) {
  const c = String(category || "").toUpperCase();

  if (c === "SAVINGS") return "Savings";
  if (c === "LOANS") return "Loans";
  if (c === "MERRY") return "Merry";
  if (c === "GROUP") return "Group";
  if (c === "WITHDRAWAL") return "Withdrawal";
  if (c === "WITHDRAWAL_FEE") return "Withdrawal Fee";
  if (c === "TRANSACTION_FEE") return "Transaction Fee";
  return c || "Other";
}

function isFeeCategory(category?: string) {
  const c = String(category || "").toUpperCase();
  return c === "WITHDRAWAL_FEE" || c === "TRANSACTION_FEE";
}

function MiniRow({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.miniRow}>
      <View style={styles.miniIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.miniTitle}>{title}</Text>
        <Text style={styles.miniSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

export default function PaymentsIndexScreen() {
  const params = useLocalSearchParams<{
    deposited?: string;
    amount?: string;
    phone?: string;
    notice?: string;
    requested?: string;
  }>();

  const [user, setUser] = useState<PaymentsUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [ledger, setLedger] = useState<PaymentLedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const withdrawAllowed = canWithdraw(user);

  const successNotice = useMemo(() => {
    if (params.deposited === "1") {
      return (
        params.notice ||
        `Deposit initiated for ${money(params.amount)} to ${params.phone || "your phone"}. Final STK charge may include transaction fee.`
      );
    }

    if (params.requested === "1") {
      return (
        params.notice ||
        "Withdrawal request submitted successfully. Final Mpesa payout may be lower if withdrawal fee applies."
      );
    }

    return "";
  }, [params.amount, params.deposited, params.notice, params.phone, params.requested]);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profileKyc);
  }, []);

  const clearPaymentParams = useCallback(() => {
    if (params.deposited || params.notice || params.amount || params.phone || params.requested) {
      router.replace(ROUTES.tabs.payments);
    }
  }, [params.amount, params.deposited, params.notice, params.phone, params.requested]);

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const [sessionRes, meRes, ledgerRes, wdRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyLedger(),
        getMyWithdrawals(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: PaymentsUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      if (!mergedUser) {
        setLedger([]);
        setWithdrawals([]);
        return;
      }

      setLedger(
        ledgerRes.status === "fulfilled" && Array.isArray(ledgerRes.value)
          ? ledgerRes.value
          : []
      );

      setWithdrawals(
        wdRes.status === "fulfilled" && Array.isArray(wdRes.value)
          ? wdRes.value
          : []
      );

      if (ledgerRes.status === "rejected" || wdRes.status === "rejected") {
        const err =
          ledgerRes.status === "rejected"
            ? ledgerRes.reason
            : wdRes.status === "rejected"
            ? wdRes.reason
            : null;

        if (err) setError(getApiErrorMessage(err));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
      console.log("PAYMENTS INDEX LOAD ERROR:", getApiErrorMessage(e));
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

  const overview = useMemo(() => {
    const lastTxn = ledger?.[0];

    const pendingWds = (withdrawals ?? []).filter(
      (w) => String(w.status).toUpperCase() === "PENDING"
    );

    const processingWds = (withdrawals ?? []).filter((w) =>
      ["APPROVED", "PROCESSING"].includes(String(w.status).toUpperCase())
    );

    const lastAmount = lastTxn?.amount ?? "0";
    const lastLabel = lastTxn
      ? `${lastTxn.entry_type} • ${categoryLabel(lastTxn.category)} • ${money(lastAmount)}`
      : "No transactions yet";

    return {
      lastLabel,
      pendingCount: pendingWds.length,
      processingCount: processingWds.length,
    };
  }, [ledger, withdrawals]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to access payments."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Payments</Text>
          <Text style={styles.subtitle}>
            Ledger, deposits & withdrawals • {isAdmin ? "Admin" : "Member"}
          </Text>
        </View>

        <Button
          variant="ghost"
          title="Refresh"
          onPress={onRefresh}
          leftIcon={
            <Ionicons
              name="refresh-outline"
              size={16}
              color={COLORS.primary}
            />
          }
        />
      </View>

      {successNotice ? (
        <Card style={styles.successCard}>
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={COLORS.success}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.successText}>{successNotice}</Text>
          </View>
          <Button
            title="Dismiss"
            variant="ghost"
            onPress={clearPaymentParams}
          />
        </Card>
      ) : null}

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
              Deposits and ledger access are available, but withdrawal requests
              require completed KYC.
            </Text>
          </Card>
        </Section>
      )}

      <Section title="Overview">
        <Card style={styles.overviewCard}>
          <MiniRow
            icon="receipt-outline"
            title="Latest activity"
            subtitle={overview.lastLabel}
          />
          <View style={styles.divider} />
          <MiniRow
            icon="time-outline"
            title="Withdrawal requests"
            subtitle={`${overview.pendingCount} pending • ${overview.processingCount} processing`}
            right={
              <Button
                variant="ghost"
                title="View"
                onPress={() => router.push(ROUTES.tabs.paymentsWithdrawals)}
              />
            }
          />
        </Card>
      </Section>

      <Section title="Quick Actions">
        <View style={styles.actionsGrid}>
          <Card
            onPress={() => router.push(ROUTES.tabs.paymentsDeposit)}
            style={styles.actionCard}
          >
            <View style={styles.actionIcon}>
              <Ionicons
                name="arrow-down-circle-outline"
                size={22}
                color={COLORS.white}
              />
            </View>
            <Text style={styles.actionTitle}>Deposit</Text>
            <Text style={styles.actionSub}>STK charge may include fee</Text>
          </Card>

          <Card
            onPress={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsRequestWithdrawal)
                : goToKyc()
            }
            style={styles.actionCard}
          >
            <View style={styles.actionIcon}>
              <Ionicons
                name="arrow-up-circle-outline"
                size={22}
                color={COLORS.white}
              />
            </View>
            <Text style={styles.actionTitle}>Withdraw</Text>
            <Text style={styles.actionSub}>
              {withdrawAllowed ? "Net payout may be lower" : "KYC required"}
            </Text>
          </Card>

          <Card
            onPress={() => router.push(ROUTES.tabs.paymentsLedger)}
            style={styles.actionCard}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="list-outline" size={22} color={COLORS.white} />
            </View>
            <Text style={styles.actionTitle}>Ledger</Text>
            <Text style={styles.actionSub}>Transactions & fees</Text>
          </Card>

          <Card
            onPress={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsWithdrawals)
                : goToKyc()
            }
            style={styles.actionCard}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="cash-outline" size={22} color={COLORS.white} />
            </View>
            <Text style={styles.actionTitle}>Withdrawals</Text>
            <Text style={styles.actionSub}>
              {withdrawAllowed ? "My requests" : "KYC required"}
            </Text>
          </Card>
        </View>
      </Section>

      <Section
        title="Recent Transactions"
        right={
          <Button
            variant="ghost"
            title="See all"
            onPress={() => router.push(ROUTES.tabs.paymentsLedger)}
          />
        }
      >
        {ledger?.length ? (
          <View style={{ gap: SPACING.sm }}>
            {ledger.slice(0, 6).map((row) => {
              const isCredit = String(row.entry_type).toUpperCase() === "CREDIT";
              const amtColor = isCredit ? COLORS.success : COLORS.danger;
              const ref = typeof row.reference === "string" ? row.reference : "";
              const feeRow = isFeeCategory(row.category);

              return (
                <Card
                  key={row.id}
                  style={[styles.txCard, feeRow && styles.feeTxCard]}
                >
                  <View style={styles.txTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txTitle} numberOfLines={1}>
                        {row.narration || categoryLabel(row.category)}
                      </Text>
                      <Text style={styles.txMeta} numberOfLines={2}>
                        {categoryLabel(row.category)}
                        {ref ? ` • ${ref}` : ""}
                        {row.created_at ? ` • ${row.created_at}` : ""}
                      </Text>
                    </View>

                    <Text style={[styles.txAmount, { color: amtColor }]}>
                      {isCredit ? "+" : "-"} {money(row.amount)}
                    </Text>
                  </View>

                  {feeRow ? (
                    <Text style={styles.feeHint}>
                      This entry is a system fee.
                    </Text>
                  ) : null}
                </Card>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title="No transactions yet"
            subtitle="Your deposits, withdrawals, and fees will appear here."
            actionLabel="Deposit"
            onAction={() => router.push(ROUTES.tabs.paymentsDeposit)}
          />
        )}
      </Section>

      <Section
        title="Recent Withdrawals"
        right={
          <Button
            variant="ghost"
            title="See all"
            onPress={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsWithdrawals)
                : goToKyc()
            }
          />
        }
      >
        {withdrawals?.length ? (
          <View style={{ gap: SPACING.sm }}>
            {withdrawals.slice(0, 4).map((w) => (
              <Card key={w.id} style={styles.wdCard}>
                <View style={styles.wdTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wdTitle} numberOfLines={1}>
                      Withdrawal • {w.source}
                    </Text>
                    <Text style={styles.wdMeta} numberOfLines={2}>
                      {w.phone}
                      {w.created_at ? ` • ${w.created_at}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Text style={styles.wdAmount}>{money(w.amount)}</Text>
                    <StatusPill label={String(w.status)} />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No withdrawals"
            subtitle="When you request a withdrawal, it will show here. Final payout may be lower if fee applies."
            actionLabel={withdrawAllowed ? "Request withdrawal" : "Complete KYC"}
            onAction={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsRequestWithdrawal)
                : goToKyc()
            }
          />
        )}
      </Section>

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 30 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },

  title: {
    fontSize: 20,
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  successCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  successText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.success,
  },

  errorCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
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

  overviewCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  miniRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  miniIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.overlay,
    alignItems: "center",
    justifyContent: "center",
  },

  miniTitle: {
    fontSize: 13,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
  },

  miniSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },

  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },

  actionCard: {
    width: "48%",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },

  actionTitle: {
    fontSize: 14,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
  },

  actionSub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  txCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  feeTxCard: {
    borderColor: COLORS.warning,
    borderWidth: 1,
  },

  txTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  txTitle: {
    fontSize: 13,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
  },

  txMeta: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  txAmount: {
    fontSize: 13,
    fontFamily: FONT.semiBold,
  },

  feeHint: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: FONT.regular,
    color: COLORS.warning,
  },

  wdCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  wdTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  wdTitle: {
    fontSize: 13,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
  },

  wdMeta: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  wdAmount: {
    fontSize: 13,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },

  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },

  pillText: {
    fontSize: 11,
    fontFamily: FONT.medium,
    color: COLORS.text,
  },
});