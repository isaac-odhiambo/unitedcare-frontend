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
import { getSessionUser, saveSessionUser, SessionUser } from "@/services/session";

type PaymentsUser = Partial<MeResponse> & Partial<SessionUser>;

const SURFACE = "#F4F6F8";
const SURFACE_2 = "#EEF2F6";
const SURFACE_3 = "#E8EDF3";
const BORDER = "#D9E1EA";
const CARD_BORDER = "rgba(15, 23, 42, 0.06)";
const TEXT_MAIN = "#0F172A";
const TEXT_SOFT = "#334155";
const TEXT_MUTED = "#64748B";

function money(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDisplayName(user?: PaymentsUser | null) {
  if (!user) return "Member";
  return (
    (user as any)?.full_name ||
    (user as any)?.name ||
    user?.username ||
    (typeof user?.phone === "string" ? user.phone : "") ||
    "Member"
  );
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
    <View style={[styles.pill, { borderColor: `${bg}30`, backgroundColor: `${bg}12` }]}>
      <View style={[styles.pillDot, { backgroundColor: bg }]} />
      <Text style={[styles.pillText, { color: bg }]}>{label}</Text>
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

function SmallAction({
  title,
  icon,
  onPress,
  tone,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone: string;
}) {
  return (
    <Card onPress={onPress} style={styles.smallActionCard} variant="default">
      <View style={[styles.smallActionIconWrap, { backgroundColor: `${tone}18` }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <Text style={styles.smallActionText}>{title}</Text>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
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
      return params.notice || `Deposit started for ${money(params.amount)}.`;
    }

    if (params.requested === "1") {
      return params.notice || "Withdrawal request submitted.";
    }

    return "";
  }, [params.amount, params.deposited, params.notice, params.requested]);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profileKyc as any);
  }, []);

  const clearPaymentParams = useCallback(() => {
    if (
      params.deposited ||
      params.notice ||
      params.amount ||
      params.phone ||
      params.requested
    ) {
      router.replace(ROUTES.tabs.payments as any);
    }
  }, [params.amount, params.deposited, params.notice, params.phone, params.requested]);

  const load = useCallback(async () => {
    try {
      setError("");

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

      if (mergedUser) {
        await saveSessionUser(mergedUser);
      }

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

      let nextError = "";
      if (ledgerRes.status === "rejected") {
        nextError = getApiErrorMessage(ledgerRes.reason);
      } else if (wdRes.status === "rejected") {
        nextError = getApiErrorMessage(wdRes.reason);
      }

      setError(nextError);
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        try {
          setLoading(true);
          await load();
        } finally {
          setLoading(false);
        }
      };

      run();
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

    const credits = (ledger ?? []).filter(
      (row) => String(row.entry_type).toUpperCase() === "CREDIT"
    );
    const debits = (ledger ?? []).filter(
      (row) => String(row.entry_type).toUpperCase() === "DEBIT"
    );

    const totalIn = credits.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalOut = debits.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const lastAmount = lastTxn?.amount ?? "0";
    const lastLabel = lastTxn
      ? `${categoryLabel(lastTxn.category)} • ${money(lastAmount)}`
      : "No activity";

    return {
      lastLabel,
      pendingCount: pendingWds.length,
      processingCount: processingWds.length,
      totalIn: money(totalIn),
      totalOut: money(totalOut),
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
          onAction={() => router.replace(ROUTES.auth.login as any)}
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
      <View style={styles.heroCard}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: SPACING.md }}>
            <Text style={styles.heroEyebrow}>PAYMENTS</Text>
            <Text style={styles.heroTitle}>{formatDisplayName(user)}</Text>
            <Text style={styles.heroSubtitle}>
              {isAdmin ? "Admin payments view" : "Member payments view"}
            </Text>
          </View>

          <View style={styles.heroAvatar}>
            <Ionicons name="card-outline" size={24} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>In {overview.totalIn}</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>Out {overview.totalOut}</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {kycComplete ? "KYC Complete" : "KYC Pending"}
            </Text>
          </View>
        </View>
      </View>

      {successNotice ? (
        <Card style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={COLORS.success}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.successText}>{successNotice}</Text>
          </View>
          <Button title="Dismiss" variant="ghost" onPress={clearPaymentParams} />
        </Card>
      ) : null}

      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.danger}
            />
          </View>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!kycComplete ? (
        <Section title="Verification" subtitle="Withdrawals need completed KYC.">
          <Card style={styles.noticeCard} onPress={goToKyc}>
            <View style={styles.noticeIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={COLORS.info}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Complete account verification</Text>
              <Text style={styles.noticeText}>
                Deposits and ledger access are available now.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
          </Card>
        </Section>
      ) : null}

      <Section title="Overview" subtitle="Latest activity and withdrawal status.">
        <Card style={styles.overviewCard}>
          <InfoRow label="Latest" value={overview.lastLabel} />
          <InfoRow
            label="Pending withdrawals"
            value={String(overview.pendingCount)}
            valueColor={overview.pendingCount > 0 ? COLORS.warning : TEXT_MAIN}
          />
          <InfoRow
            label="Processing withdrawals"
            value={String(overview.processingCount)}
            valueColor={overview.processingCount > 0 ? COLORS.info : TEXT_MAIN}
          />
        </Card>
      </Section>

      <Section title="Actions" subtitle="Main payment tools.">
        <View style={styles.smallActionsGrid}>
          <SmallAction
            title="Deposit"
            icon="arrow-down-circle-outline"
            tone={COLORS.primary}
            onPress={() => router.push(ROUTES.tabs.paymentsDeposit as any)}
          />

          <SmallAction
            title={withdrawAllowed ? "Withdraw" : "KYC First"}
            icon={withdrawAllowed ? "arrow-up-circle-outline" : "shield-outline"}
            tone={withdrawAllowed ? COLORS.success : COLORS.warning}
            onPress={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsRequestWithdrawal as any)
                : goToKyc()
            }
          />

          <SmallAction
            title="Ledger"
            icon="list-outline"
            tone={COLORS.info}
            onPress={() => router.push(ROUTES.tabs.paymentsLedger as any)}
          />

          <SmallAction
            title="Withdrawals"
            icon="cash-outline"
            tone={withdrawAllowed ? COLORS.primary : COLORS.warning}
            onPress={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsWithdrawals as any)
                : goToKyc()
            }
          />
        </View>
      </Section>

      <Section
        title="Recent Transactions"
        right={
          <Button
            variant="ghost"
            title="See all"
            onPress={() => router.push(ROUTES.tabs.paymentsLedger as any)}
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
                    <Text style={styles.feeHint}>System fee</Text>
                  ) : null}
                </Card>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title="No transactions yet"
            subtitle="Your payment activity will appear here."
            actionLabel="Deposit"
            onAction={() => router.push(ROUTES.tabs.paymentsDeposit as any)}
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
                ? router.push(ROUTES.tabs.paymentsWithdrawals as any)
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
            subtitle="Your withdrawal requests will appear here."
            actionLabel={withdrawAllowed ? "Request withdrawal" : "Complete KYC"}
            onAction={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsRequestWithdrawal as any)
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
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: 30,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    overflow: "hidden",
    ...SHADOW.strong,
  },

  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -60,
    right: -40,
  },

  heroGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -30,
    left: -20,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  heroEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 1,
  },

  heroTitle: {
    marginTop: 6,
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 24,
    lineHeight: 30,
  },

  heroSubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.86)",
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  heroAvatar: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },

  heroFooter: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },

  heroPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroPillText: {
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  successCard: {
    backgroundColor: "#F1FAF2",
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.18)",
    borderRadius: RADIUS.xl,
  },

  successIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
  },

  successText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.success,
  },

  errorCard: {
    backgroundColor: "#FFF4F4",
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    borderRadius: RADIUS.xl,
  },

  errorIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.10)",
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.danger,
  },

  noticeCard: {
    backgroundColor: SURFACE,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: `${COLORS.info}18`,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeTitle: {
    fontSize: 14,
    fontFamily: FONT.bold,
    color: TEXT_MAIN,
  },

  noticeText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_MUTED,
  },

  overviewCard: {
    backgroundColor: SURFACE,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  infoRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  infoLabel: {
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 12,
  },

  smallActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
  },

  smallActionCard: {
    width: "48.5%",
    backgroundColor: SURFACE,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: 72,
  },

  smallActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  smallActionText: {
    flex: 1,
    color: TEXT_SOFT,
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  txCard: {
    backgroundColor: SURFACE,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  feeTxCard: {
    borderColor: `${COLORS.warning}40`,
    backgroundColor: SURFACE_2,
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
    color: TEXT_MAIN,
  },

  txMeta: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: FONT.regular,
    color: TEXT_MUTED,
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
    backgroundColor: SURFACE_3,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
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
    color: TEXT_MAIN,
  },

  wdMeta: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: FONT.regular,
    color: TEXT_MUTED,
  },

  wdAmount: {
    fontSize: 13,
    fontFamily: FONT.semiBold,
    color: TEXT_MAIN,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    borderWidth: 1,
  },

  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },

  pillText: {
    fontSize: 11,
    fontFamily: FONT.medium,
  },
});