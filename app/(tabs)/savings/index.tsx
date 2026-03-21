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

const SURFACE = "#F4F6F8";
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

function formatStatus(user?: SavingsUser | null) {
  return String((user as any)?.status || "ACTIVE").replaceAll("_", " ");
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

function getWalletDescription(account?: SavingsAccount | null) {
  if (!account) return "No main wallet available.";

  const type = String(account.account_type || "").toUpperCase();

  if (type === "FLEXIBLE") {
    return "Your main wallet for normal deposits, balances, and withdrawals.";
  }

  if (type === "FIXED" && account.locked_until) {
    return `This wallet is fixed and locked until ${account.locked_until}.`;
  }

  if (type === "TARGET" && account.target_amount && account.target_deadline) {
    return `Target wallet set for ${formatKes(account.target_amount)} by ${account.target_deadline}.`;
  }

  if (type === "TARGET" && account.target_deadline) {
    return `Target wallet deadline is ${account.target_deadline}.`;
  }

  return "This is your current main wallet.";
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

function QuickAction({
  title,
  subtitle,
  icon,
  tone,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={styles.quickActionCard} variant="default">
      <View style={[styles.quickActionIcon, { backgroundColor: `${tone}18` }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
    </Card>
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
  const memberStatus = useMemo(() => formatStatus(user), [user]);
  const primaryAccount = useMemo(() => getPrimaryAccount(accounts), [accounts]);

  const canWithdrawThisAccount = useMemo(
    () => canWithdrawFromAccountNow(primaryAccount),
    [primaryAccount]
  );

  const finalWithdrawalAllowed =
    Boolean(withdrawAllowedByProfile) && Boolean(canWithdrawThisAccount);

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
            <View style={styles.heroAvatar}>
              <Ionicons name="wallet-outline" size={24} color={COLORS.white} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>MAIN WALLET</Text>
              <Text style={styles.heroTitle}>{displayName}</Text>
              <Text style={styles.heroSubtitle}>
                Create your one main savings wallet to start saving and tracking
                your balance.
              </Text>
            </View>
          </View>

          <View style={styles.heroMetaWrap}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{memberStatus}</Text>
            </View>

            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>
                {kycComplete ? "KYC Complete" : "KYC Pending"}
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <Card style={styles.errorCard} variant="default">
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Section title="Main Wallet" subtitle="You only need one savings wallet.">
          <Card style={styles.emptyStartCard} variant="default">
            <View style={styles.emptyStartIcon}>
              <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
            </View>

            <Text style={styles.emptyStartTitle}>No main wallet yet</Text>
            <Text style={styles.emptyStartText}>
              Create your main wallet first. All personal savings deposits and
              withdrawals will use this wallet.
            </Text>

            <View style={{ marginTop: SPACING.md }}>
              <Button
                title="Create Main Wallet"
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
        </Section>
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
          <View style={styles.heroAvatar}>
            <Ionicons name="wallet-outline" size={24} color={COLORS.white} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>MAIN WALLET</Text>
            <Text style={styles.heroTitle}>{displayName}</Text>
            <Text style={styles.heroSubtitle}>
              One simple wallet for deposits, balances, reserved funds, and
              withdrawals.
            </Text>
          </View>
        </View>

        <View style={styles.heroMetaWrap}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{memberStatus}</Text>
          </View>

          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {kycComplete ? "KYC Complete" : "KYC Pending"}
            </Text>
          </View>

          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {primaryAccount.is_active ? "Wallet Active" : "Wallet Inactive"}
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <Card style={styles.errorCard} variant="default">
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!kycComplete ? (
        <Section title="Verification" subtitle="Withdrawals need completed KYC.">
          <Card style={styles.noticeCard} variant="default" onPress={goToKyc}>
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
                Deposits are available now, but withdrawals need completed KYC.
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
          </Card>
        </Section>
      ) : null}

      <Section title="Wallet Overview" subtitle="Your personal savings at a glance.">
        <Card style={styles.mainAccountCard} variant="default">
          <Text style={styles.mainAccountTitle}>
            {primaryAccount.name || "Main Wallet"}
          </Text>
          <Text style={styles.mainAccountSubtitle}>
            {getWalletDescription(primaryAccount)}
          </Text>

          <View style={styles.divider} />

          <InfoRow label="Balance" value={formatKes(primaryAccount.balance)} />
          <InfoRow
            label="Reserved"
            value={formatKes(primaryAccount.reserved_amount)}
            valueColor={
              toNumber(primaryAccount.reserved_amount) > 0
                ? COLORS.warning
                : TEXT_MAIN
            }
          />
          <InfoRow
            label="Available"
            value={formatKes(primaryAccount.available_balance)}
            valueColor={COLORS.success}
          />
          <InfoRow
            label="Status"
            value={primaryAccount.is_active ? "Active" : "Inactive"}
            valueColor={primaryAccount.is_active ? COLORS.success : COLORS.danger}
          />

          <View style={{ marginTop: SPACING.md }}>
            <Button
              title="Save Money"
              onPress={() => router.push(ROUTES.tabs.savingsSave as any)}
              leftIcon={
                <Ionicons
                  name="arrow-down-circle-outline"
                  size={18}
                  color={COLORS.white}
                />
              }
            />
          </View>
        </Card>
      </Section>

      <Section title="Quick Actions" subtitle="Simple actions for your main wallet.">
        <View style={styles.quickActionList}>
          <QuickAction
            title="Save Money"
            subtitle="Open the central payment flow for savings."
            icon="wallet-outline"
            tone={COLORS.primary}
            onPress={() => router.push(ROUTES.tabs.savingsSave as any)}
          />

          <QuickAction
            title="History"
            subtitle="See your wallet deposits and withdrawals."
            icon="time-outline"
            tone={COLORS.warning}
            onPress={() =>
              router.push(
                ROUTES.dynamic.savingsAccountHistory(primaryAccount.id) as any
              )
            }
          />

          <QuickAction
            title={finalWithdrawalAllowed ? "Withdraw" : "Withdrawal Info"}
            subtitle={
              finalWithdrawalAllowed
                ? "Request a withdrawal from your wallet."
                : !kycComplete
                ? "Complete KYC before withdrawing."
                : "See wallet details and status."
            }
            icon={
              finalWithdrawalAllowed
                ? "arrow-up-circle-outline"
                : "information-circle-outline"
            }
            tone={finalWithdrawalAllowed ? COLORS.success : COLORS.info}
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

      <View style={{ height: 24 }} />
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
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.strong,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
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
    marginTop: 7,
    color: "rgba(255,255,255,0.86)",
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  heroMetaWrap: {
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

  emptyStartCard: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.md,
  },

  emptyStartIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.primary}16`,
    marginBottom: SPACING.md,
  },

  emptyStartTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 16,
  },

  emptyStartText: {
    marginTop: 6,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  mainAccountCard: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  mainAccountTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 16,
  },

  mainAccountSubtitle: {
    marginTop: 5,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  divider: {
    height: 1,
    backgroundColor: "#D9E1EA",
    marginVertical: SPACING.md,
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

  quickActionList: {
    gap: SPACING.sm,
  },

  quickActionCard: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  quickActionTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  quickActionSubtitle: {
    marginTop: 4,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },
});