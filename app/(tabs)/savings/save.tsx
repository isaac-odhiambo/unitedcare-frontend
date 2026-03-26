// app/(tabs)/savings/save.tsx
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
import { getMe } from "@/services/profile";
import {
  buildSavingsReference,
  getOrCreateDefaultSavingsAccount,
  type SavingsAccount,
} from "@/services/savings";
import { saveSessionUser } from "@/services/session";

const SURFACE = "#F8FAFC";
const CARD_BORDER = "rgba(15, 23, 42, 0.06)";
const TEXT_MAIN = "#0F172A";
const TEXT_MUTED = "#64748B";

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";

  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatAccountType(type?: string | null) {
  const value = String(type || "").toUpperCase();

  if (value === "FLEXIBLE") return "Flexible Savings";
  if (value === "FIXED") return "Fixed Savings";
  if (value === "TARGET") return "Target Savings";
  return "Savings";
}

function isLocked(account?: SavingsAccount | null) {
  if (!account) return false;
  if (String(account.account_type || "").toUpperCase() !== "FIXED") return false;
  if (!account.locked_until) return false;

  const today = new Date();
  const lockedUntil = new Date(account.locked_until);

  today.setHours(0, 0, 0, 0);
  lockedUntil.setHours(0, 0, 0, 0);

  return lockedUntil.getTime() > today.getTime();
}

function SummaryRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const color =
    tone === "success"
      ? COLORS.success
      : tone === "warning"
      ? COLORS.warning
      : TEXT_MAIN;

  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function SavingsSaveScreen() {
  const [user, setUser] = useState<any>(null);
  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const me = await getMe();
      setUser(me);

      if (me) {
        await saveSessionUser(me);
      }

      const wallet = await getOrCreateDefaultSavingsAccount();
      setAccount(wallet);
    } catch (e: any) {
      setError(getErrorMessage(e));
      setAccount(null);
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
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const savingsReference = useMemo(() => {
    if (!account?.id) return "";
    return buildSavingsReference(account.id);
  }, [account]);

  const availableBalance = useMemo(
    () => formatKes(account?.available_balance),
    [account]
  );

  const totalBalance = useMemo(() => formatKes(account?.balance), [account]);

  const reservedBalance = useMemo(
    () => formatKes(account?.reserved_amount),
    [account]
  );

  const handleContinue = useCallback(() => {
    if (!account?.id) return;

    router.push({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        category: "SAVINGS",
        purpose: "SAVINGS_DEPOSIT",
        accountId: String(account.id),
        reference: savingsReference,
        narration: "Savings deposit",
        phone: user?.phone || "",
        returnTo: ROUTES.tabs.savings,
        title: account.name || "Save Money",
      },
    });
  }, [account, savingsReference, user]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.loadingText}>Preparing savings...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to continue with savings."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login as any)}
        />
      </View>
    );
  }

  if (!account) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Unable to open savings"
          subtitle={error || "We could not load your savings right now."}
          actionLabel="Try Again"
          onAction={() => load()}
        />
      </View>
    );
  }

  const locked = isLocked(account);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="wallet-outline" size={24} color={COLORS.white} />
          </View>

          <View style={styles.heroTextWrap}>
            <Text style={styles.heroEyebrow}>SAVE MONEY</Text>
            <Text style={styles.heroTitle}>{account.name || "My Savings"}</Text>
            <Text style={styles.heroSubtitle}>
              Continue to deposit into your savings wallet.
            </Text>
          </View>
        </View>

        <View style={styles.heroBalanceBox}>
          <Text style={styles.heroBalanceLabel}>Available Balance</Text>
          <Text style={styles.heroBalanceValue}>{availableBalance}</Text>
        </View>

        <View style={styles.heroButtonWrap}>
          <Button
            title="Continue to Deposit"
            onPress={handleContinue}
            leftIcon={
              <Ionicons
                name="arrow-down-circle-outline"
                size={18}
                color={COLORS.white}
              />
            }
          />
        </View>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Section title="Wallet">
        <Card style={styles.walletCard}>
          <View style={styles.walletHead}>
            <View style={styles.walletHeadText}>
              <Text style={styles.walletName}>{account.name || "My Savings"}</Text>
              <Text style={styles.walletType}>
                {formatAccountType(account.account_type)}
              </Text>
            </View>

            <View style={styles.typePill}>
              <Text style={styles.typePillText}>
                {String(account.account_type || "SAVINGS")}
              </Text>
            </View>
          </View>

          {!account.is_active ? (
            <View style={styles.noticeBoxDanger}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={COLORS.danger}
              />
              <Text style={[styles.noticeBoxText, { color: COLORS.danger }]}>
                This savings account is inactive.
              </Text>
            </View>
          ) : locked ? (
            <View style={styles.noticeBoxWarning}>
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={COLORS.warning}
              />
              <Text style={[styles.noticeBoxText, { color: COLORS.warning }]}>
                Locked until {account.locked_until}
              </Text>
            </View>
          ) : (
            <View style={styles.noticeBoxSuccess}>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={COLORS.success}
              />
              <Text style={[styles.noticeBoxText, { color: COLORS.success }]}>
                Savings wallet is ready for deposit.
              </Text>
            </View>
          )}

          <View style={styles.summaryList}>
            <SummaryRow label="Balance" value={totalBalance} />
            <SummaryRow
              label="Available"
              value={availableBalance}
              tone="success"
            />
            <SummaryRow
              label="Reserved"
              value={reservedBalance}
              tone="warning"
            />
          </View>
        </Card>
      </Section>

      <Section title="Payment Details">
        <Card style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Deposit route</Text>
            <Text style={styles.detailValue}>Centralized STK deposit</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reference</Text>
            <Text style={styles.detailValue}>{savingsReference}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>{user?.phone || "Not available"}</Text>
          </View>
        </Card>
      </Section>

      <Section title="Next Step">
        <Card style={styles.infoCard}>
          <Text style={styles.infoText}>
            You will continue to the payment screen to enter amount and confirm
            STK push for your savings deposit.
          </Text>

          <View style={{ marginTop: SPACING.md }}>
            <Button
              title="Continue to Deposit"
              onPress={handleContinue}
              leftIcon={
                <Ionicons
                  name="arrow-forward-outline"
                  size={18}
                  color={COLORS.white}
                />
              }
            />
          </View>
        </Card>
      </Section>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
  },

  loadingText: {
    marginTop: SPACING.sm,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.strong,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },

  heroTextWrap: {
    flex: 1,
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
    fontSize: 22,
    lineHeight: 28,
  },

  heroSubtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.86)",
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  heroBalanceBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroBalanceLabel: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  heroBalanceValue: {
    marginTop: 6,
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 28,
    lineHeight: 34,
  },

  heroButtonWrap: {
    marginTop: SPACING.md,
  },

  errorCard: {
    backgroundColor: "#FFF4F4",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },

  errorText: {
    color: COLORS.danger,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  walletCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },

  walletHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  walletHeadText: {
    flex: 1,
  },

  walletName: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 16,
  },

  walletType: {
    marginTop: 4,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  typePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `${COLORS.primary}14`,
  },

  typePillText: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  noticeBoxSuccess: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: "rgba(46, 125, 50, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(46, 125, 50, 0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },

  noticeBoxWarning: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: "rgba(242, 140, 40, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(242, 140, 40, 0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },

  noticeBoxDanger: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },

  noticeBoxText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  summaryList: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },

  summaryRow: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.md,
  },

  summaryLabel: {
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  summaryValue: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 17,
    lineHeight: 22,
  },

  detailsCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
  },

  detailRow: {
    gap: 4,
  },

  detailLabel: {
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  detailValue: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 13,
    lineHeight: 18,
  },

  infoCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },

  infoText: {
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },
});