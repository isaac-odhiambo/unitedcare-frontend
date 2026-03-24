// app/(tabs)/savings/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  canWithdraw,
  getMe,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { listMySavingsAccounts, SavingsAccount } from "@/services/savings";
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type SavingsUser = Partial<MeResponse> & Partial<SessionUser>;

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

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatDisplayName(user?: SavingsUser | null) {
  if (!user) return "Member";
  return (
    (user as any)?.full_name ||
    (user as any)?.name ||
    user?.username ||
    (typeof user?.phone === "string" ? user.phone : "") ||
    "Member"
  );
}

function getPrimaryAccount(accounts: SavingsAccount[]) {
  if (!accounts.length) return null;

  const activeAccounts = accounts.filter((a) => a.is_active);
  const source = activeAccounts.length ? activeAccounts : accounts;

  return (
    source.find(
      (a) => String(a.account_type || "").toUpperCase() === "FLEXIBLE"
    ) || source[0]
  );
}

function canWithdrawFromAccountNow(account?: SavingsAccount | null) {
  if (!account) return false;
  if (!account.is_active) return false;

  const type = String(account.account_type || "").toUpperCase();

  if (type === "FIXED" && account.locked_until) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lockedUntil = new Date(account.locked_until);
    if (!Number.isNaN(lockedUntil.getTime())) {
      lockedUntil.setHours(0, 0, 0, 0);
      return today >= lockedUntil;
    }

    return false;
  }

  return true;
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const valueColor =
    tone === "success"
      ? COLORS.success
      : tone === "warning"
      ? COLORS.warning
      : TEXT_MAIN;

  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function ActionRow({
  title,
  subtitle,
  icon,
  iconBg,
  iconColor,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={styles.actionRow}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
    </TouchableOpacity>
  );
}

export default function SavingsIndexScreen() {
  const [user, setUser] = useState<SavingsUser | null>(null);
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const kycComplete = isKycComplete(user);
  const withdrawAllowedByProfile = canWithdraw(user);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profileKyc as any);
  }, []);

  const goToSave = useCallback(() => {
    router.push(ROUTES.tabs.savingsSave as any);
  }, []);

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, accountsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listMySavingsAccounts(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: SavingsUser | null =
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

      setAccounts(
        accountsRes.status === "fulfilled" && Array.isArray(accountsRes.value)
          ? accountsRes.value
          : []
      );

      let nextError = "";

      if (meRes.status === "rejected") {
        nextError = getErrorMessage(meRes.reason);
      } else if (accountsRes.status === "rejected") {
        nextError = getErrorMessage(accountsRes.reason);
      }

      setError(nextError);
    } catch (e: any) {
      setError(getErrorMessage(e));
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

  const displayName = useMemo(() => formatDisplayName(user), [user]);
  const primaryAccount = useMemo(() => getPrimaryAccount(accounts), [accounts]);

  const canWithdrawThisAccount = useMemo(
    () => canWithdrawFromAccountNow(primaryAccount),
    [primaryAccount]
  );

  const finalWithdrawalAllowed =
    Boolean(withdrawAllowedByProfile) && Boolean(canWithdrawThisAccount);

  const balance = formatKes(primaryAccount?.balance);
  const available = formatKes(primaryAccount?.available_balance);
  const reserved = formatKes(primaryAccount?.reserved_amount);

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
          subtitle="Please login to access savings."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login as any)}
        />
      </View>
    );
  }

  if (!primaryAccount) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="wallet-outline" size={24} color={COLORS.white} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>SAVINGS</Text>
              <Text style={styles.heroTitle}>{displayName}</Text>
              <Text style={styles.heroSubtitle}>
                Start with one main wallet for your personal savings.
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <Card style={styles.errorCard} variant="default">
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Card style={styles.emptyCard} variant="default">
          <View style={styles.emptyIcon}>
            <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
          </View>

          <Text style={styles.emptyTitle}>No wallet yet</Text>
          <Text style={styles.emptyText}>
            Create your main savings wallet to start saving.
          </Text>

          <View style={{ marginTop: SPACING.md }}>
            <Button
              title="Create Wallet"
              onPress={() => router.push(ROUTES.tabs.savingsCreate as any)}
              leftIcon={
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={COLORS.white}
                />
              }
            />
          </View>
        </Card>
      </ScrollView>
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
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="wallet-outline" size={24} color={COLORS.white} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>MAIN WALLET</Text>
            <Text style={styles.heroTitle}>{displayName}</Text>
            <Text style={styles.heroSubtitle}>
              Save, track your balance, and manage your wallet.
            </Text>
          </View>
        </View>

        <View style={styles.heroBalanceBox}>
          <Text style={styles.heroBalanceLabel}>Available Balance</Text>
          <Text style={styles.heroBalanceValue}>{available}</Text>
        </View>

        <View style={{ marginTop: SPACING.md }}>
          <Button
            title="Save Money"
            onPress={goToSave}
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
        <Card style={styles.errorCard} variant="default">
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!kycComplete ? (
        <Card style={styles.noticeCard} variant="default" onPress={goToKyc}>
          <View style={styles.noticeIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={COLORS.info}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Complete KYC</Text>
            <Text style={styles.noticeText}>
              You can save now, but withdrawals need verification.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
        </Card>
      ) : null}

      <Section title="Overview">
        <View style={styles.summaryGrid}>
          <SummaryTile label="Balance" value={balance} />
          <SummaryTile label="Available" value={available} tone="success" />
          <SummaryTile label="Reserved" value={reserved} tone="warning" />
        </View>
      </Section>

      <Section title="Actions">
        <View style={styles.actionList}>
          <ActionRow
            title="Save Money"
            subtitle="Add money to your savings wallet."
            icon="arrow-down-circle-outline"
            iconBg={`${COLORS.primary}16`}
            iconColor={COLORS.primary}
            onPress={goToSave}
          />

          <ActionRow
            title="History"
            subtitle="View your savings transactions."
            icon="time-outline"
            iconBg={`${COLORS.warning}18`}
            iconColor={COLORS.warning}
            onPress={() =>
              router.push(
                ROUTES.dynamic.savingsAccountHistory(primaryAccount.id) as any
              )
            }
          />

          <ActionRow
            title={finalWithdrawalAllowed ? "Withdraw" : "Withdrawal Info"}
            subtitle={
              finalWithdrawalAllowed
                ? "Request a withdrawal from your wallet."
                : !kycComplete
                ? "Complete KYC before withdrawing."
                : "Check your wallet withdrawal status."
            }
            icon={
              finalWithdrawalAllowed
                ? "arrow-up-circle-outline"
                : "information-circle-outline"
            }
            iconBg={
              finalWithdrawalAllowed
                ? `${COLORS.success}16`
                : `${COLORS.info}16`
            }
            iconColor={finalWithdrawalAllowed ? COLORS.success : COLORS.info}
            onPress={() =>
              finalWithdrawalAllowed
                ? router.push(ROUTES.tabs.paymentsRequestWithdrawal as any)
                : !kycComplete
                ? goToKyc()
                : router.push(
                    ROUTES.dynamic.savingsAccountHistory(primaryAccount.id) as any
                  )
            }
          />
        </View>
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
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

  noticeCard: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },

  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: `${COLORS.info}18`,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  noticeText: {
    marginTop: 4,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  emptyCard: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.lg,
  },

  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.primary}16`,
    marginBottom: SPACING.md,
  },

  emptyTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 18,
  },

  emptyText: {
    marginTop: 6,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 20,
  },

  summaryGrid: {
    gap: SPACING.sm,
  },

  summaryTile: {
    backgroundColor: SURFACE,
    borderRadius: 20,
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
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 18,
    lineHeight: 24,
  },

  actionList: {
    gap: SPACING.sm,
  },

  actionRow: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  actionTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  actionSubtitle: {
    marginTop: 4,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },
});