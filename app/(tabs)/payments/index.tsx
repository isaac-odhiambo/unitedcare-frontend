import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, SHADOW, SPACING } from "@/constants/theme";
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

const PAGE_BG = "#0B5D4B";
const PAGE_BG_DARK = "#084C3D";
const BRAND = "#0C6A80";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.92)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.76)";

const TEXT_MAIN = "#17323B";
const TEXT_SOFT = "#4A6470";
const TEXT_MUTED = "#6F8791";

const SURFACE_LIGHT = "#F5FBF8";
const SURFACE_LIGHT_2 = "#ECF8F3";
const SURFACE_LIGHT_3 = "#E5F5EF";

const CARD_SOFT = "rgba(255,255,255,0.10)";
const CARD_SOFT_BORDER = "rgba(255,255,255,0.12)";

const CARD_GREEN = "#E8F6EF";
const CARD_GREEN_BORDER = "#D3ECDD";

const CARD_BLUE = "#EAF6FA";
const CARD_BLUE_BORDER = "#D7EDF4";

const CARD_MINT = "#EDF9F6";
const CARD_MINT_BORDER = "#D8F0EA";

const CARD_WARM = "#F8F4EA";
const CARD_WARM_BORDER = "#ECE1C7";

const CARD_ALERT = "rgba(239, 68, 68, 0.14)";
const CARD_ALERT_BORDER = "rgba(239,68,68,0.22)";

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
    <View
      style={[
        styles.pill,
        { borderColor: `${bg}30`, backgroundColor: `${bg}12` },
      ]}
    >
      <View style={[styles.pillDot, { backgroundColor: bg }]} />
      <Text style={[styles.pillText, { color: bg }]}>{label}</Text>
    </View>
  );
}

function categoryLabel(category?: string) {
  const c = String(category || "").toUpperCase();

  if (c === "SAVINGS") return "Savings";
  if (c === "LOANS") return "Support";
  if (c === "MERRY") return "Merry";
  if (c === "GROUP") return "Group";
  if (c === "WITHDRAWAL") return "Withdrawal";
  if (c === "WITHDRAWAL_FEE") return "Withdrawal Fee";
  if (c === "TRANSACTION_FEE") return "Service Fee";
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
  cardStyle,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone: string;
  cardStyle?: any;
}) {
  return (
    <Card onPress={onPress} style={[styles.smallActionCard, cardStyle]} variant="default">
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
  const insets = useSafeAreaInsets();

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
      return params.notice || `Your contribution request for ${money(params.amount)} has started.`;
    }

    if (params.requested === "1") {
      return params.notice || "Your withdrawal request has been received.";
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
      : "No activity yet";

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
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#DFFCF1" />
          <Text style={styles.loadingText}>Loading your community activity...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.page}>
          <EmptyState
            title="Not signed in"
            subtitle="Please login to continue with your community activity."
            actionLabel="Go to Login"
            onAction={() => router.replace(ROUTES.auth.login as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 30, 36) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#DFFCF1"
            colors={["#DFFCF1", "#A8F0CC"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: SPACING.md }}>
              <Text style={styles.heroEyebrow}>COMMUNITY ACTIVITY</Text>
              <Text style={styles.heroTitle}>{formatDisplayName(user)}</Text>
              <Text style={styles.heroSubtitle}>
                {isAdmin ? "Community overview (Admin)" : "Your community activity"}
              </Text>
            </View>

            <View style={styles.heroAvatar}>
              <Ionicons name="layers-outline" size={24} color={WHITE} />
            </View>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>Added {overview.totalIn}</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>Moved out {overview.totalOut}</Text>
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
          <Section
            title="Verification"
            subtitle="Withdrawals need completed KYC."
          >
            <Card style={styles.noticeCard} onPress={goToKyc}>
              <View style={styles.noticeIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color="#0A6E8A"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Complete your verification</Text>
                <Text style={styles.noticeText}>
                  You can still add contributions and view activity as you continue.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
            </Card>
          </Section>
        ) : null}

        <Section title="Overview" subtitle="Your recent activity and progress.">
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
              valueColor={overview.processingCount > 0 ? BRAND : TEXT_MAIN}
            />
          </Card>
        </Section>

        <Section title="Quick Actions" subtitle="What would you like to do?">
          <View style={styles.smallActionsGrid}>
            <SmallAction
              title="Add Contribution"
              icon="arrow-down-circle-outline"
              tone="#0B6A80"
              cardStyle={styles.actionSavings}
              onPress={() => router.push(ROUTES.tabs.paymentsDeposit as any)}
            />

            <SmallAction
              title={withdrawAllowed ? "Withdraw" : "Complete KYC"}
              icon={withdrawAllowed ? "arrow-up-circle-outline" : "shield-outline"}
              tone={withdrawAllowed ? "#379B4A" : COLORS.warning}
              cardStyle={withdrawAllowed ? styles.actionMerry : styles.actionWarning}
              onPress={() =>
                withdrawAllowed
                  ? router.push(ROUTES.tabs.paymentsRequestWithdrawal as any)
                  : goToKyc()
              }
            />

            <SmallAction
              title="Activity Summary"
              icon="list-outline"
              tone="#0A6E8A"
              cardStyle={styles.actionGroups}
              onPress={() => router.push(ROUTES.tabs.paymentsLedger as any)}
            />

            <SmallAction
              title="Withdrawals"
              icon="cash-outline"
              tone={withdrawAllowed ? "#148C84" : COLORS.warning}
              cardStyle={withdrawAllowed ? styles.actionSupport : styles.actionWarning}
              onPress={() =>
                withdrawAllowed
                  ? router.push(ROUTES.tabs.paymentsWithdrawals as any)
                  : goToKyc()
              }
            />
          </View>
        </Section>

        <Section
          title="Recent Activity"
          subtitle="A short preview of your latest entries."
          right={
            <Button
              variant="ghost"
              title="Open full ledger"
              onPress={() => router.push(ROUTES.tabs.paymentsLedger as any)}
            />
          }
        >
          {ledger?.length ? (
            <View style={{ gap: SPACING.sm }}>
              {ledger.slice(0, 3).map((row) => {
                const isCredit = String(row.entry_type).toUpperCase() === "CREDIT";
                const amtColor = isCredit ? COLORS.success : COLORS.danger;
                const ref = typeof row.reference === "string" ? row.reference : "";
                const feeRow = isFeeCategory(row.category);

                return (
                  <Card
                    key={row.id}
                    style={[
                      styles.txCard,
                      feeRow ? styles.feeTxCard : styles.standardTxCard,
                    ]}
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
                      <Text style={styles.feeHint}>Service fee</Text>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          ) : (
            <EmptyState
              title="No activity yet"
              subtitle="Your community activity will appear here."
              actionLabel="Add Contribution"
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
              {withdrawals.slice(0, 3).map((w) => (
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
              title="No withdrawals yet"
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    padding: SPACING.md,
    position: "relative",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
  },

  loadingText: {
    marginTop: SPACING.sm,
    color: TEXT_ON_DARK,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -60,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(175, 245, 214, 0.08)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 260,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(183, 255, 232, 0.06)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: 80,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 100,
    left: 40,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.40)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    top: 180,
    right: 60,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  heroCard: {
    backgroundColor: CARD_SOFT,
    borderRadius: 24,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: CARD_SOFT_BORDER,
    ...SHADOW.card,
  },

  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -60,
    right: -40,
  },

  heroGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(168, 240, 204, 0.08)",
    bottom: -30,
    left: -20,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  heroEyebrow: {
    color: TEXT_ON_DARK_SOFT,
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 1,
  },

  heroTitle: {
    marginTop: 6,
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 24,
    lineHeight: 30,
  },

  heroSubtitle: {
    marginTop: 8,
    color: TEXT_ON_DARK,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  heroAvatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
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
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroPillText: {
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  successCard: {
    backgroundColor: CARD_GREEN,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_GREEN_BORDER,
    borderRadius: 20,
  },

  successIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 255, 235, 0.86)",
  },

  successText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_MAIN,
  },

  errorCard: {
    backgroundColor: CARD_ALERT,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_ALERT_BORDER,
    borderRadius: 20,
  },

  errorIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: WHITE,
  },

  noticeCard: {
    backgroundColor: CARD_BLUE,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BLUE_BORDER,
  },

  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(236, 251, 255, 0.92)",
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
    color: TEXT_SOFT,
  },

  overviewCard: {
    backgroundColor: SURFACE_LIGHT_2,
    padding: SPACING.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DDEFE7",
  },

  infoRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  infoLabel: {
    color: TEXT_SOFT,
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
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: 72,
    ...SHADOW.card,
  },

  actionSavings: {
    backgroundColor: CARD_MINT,
    borderColor: CARD_MINT_BORDER,
  },

  actionMerry: {
    backgroundColor: CARD_GREEN,
    borderColor: CARD_GREEN_BORDER,
  },

  actionGroups: {
    backgroundColor: CARD_BLUE,
    borderColor: CARD_BLUE_BORDER,
  },

  actionSupport: {
    backgroundColor: SURFACE_LIGHT_3,
    borderColor: "#D8ECE5",
  },

  actionWarning: {
    backgroundColor: CARD_WARM,
    borderColor: CARD_WARM_BORDER,
  },

  smallActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  smallActionText: {
    flex: 1,
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  txCard: {
    padding: SPACING.md,
    borderRadius: 18,
    borderWidth: 1,
  },

  standardTxCard: {
    backgroundColor: SURFACE_LIGHT,
    borderColor: "#D8ECE5",
  },

  feeTxCard: {
    borderColor: CARD_WARM_BORDER,
    backgroundColor: CARD_WARM,
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
    color: TEXT_SOFT,
  },

  txAmount: {
    fontSize: 13,
    fontFamily: FONT.semiBold,
  },

  feeHint: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: FONT.regular,
    color: "#9A5B00",
  },

  wdCard: {
    backgroundColor: SURFACE_LIGHT,
    padding: SPACING.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8ECE5",
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
    color: TEXT_SOFT,
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
    borderRadius: 999,
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