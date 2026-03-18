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
const SURFACE_2 = "#EEF2F6";
const SURFACE_3 = "#E8EDF3";
const BORDER = "#D9E1EA";
const CARD_BORDER = "rgba(15, 23, 42, 0.06)";
const TEXT_MAIN = "#0F172A";
const TEXT_SOFT = "#334155";
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

function getAccountTypeLabel(type?: string) {
  const t = String(type || "").toUpperCase();
  if (t === "FLEXIBLE") return "Flexible Savings";
  if (t === "FIXED") return "Fixed Savings";
  if (t === "TARGET") return "Target Savings";
  return "Savings Account";
}

function getAccountTypeTone(type?: string) {
  const t = String(type || "").toUpperCase();

  if (t === "FLEXIBLE") {
    return {
      bg: "rgba(37, 99, 235, 0.10)",
      color: COLORS.info,
    };
  }

  if (t === "FIXED") {
    return {
      bg: "rgba(245, 158, 11, 0.12)",
      color: COLORS.warning,
    };
  }

  return {
    bg: "rgba(34, 197, 94, 0.10)",
    color: COLORS.success,
  };
}

function getPrimaryAccount(accounts: SavingsAccount[]) {
  if (!accounts.length) return null;

  const activeAccounts = accounts.filter((a) => a.is_active);
  const source = activeAccounts.length ? activeAccounts : accounts;

  const mainWallet =
    source.find(
      (a) =>
        String(a.account_type || "").toUpperCase() === "FLEXIBLE" &&
        String(a.name || "").trim().length > 0
    ) || source[0];

  return mainWallet;
}

function getExtraAccounts(accounts: SavingsAccount[], primaryId?: number | null) {
  return accounts.filter((a) => a.id !== primaryId);
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

function getPrimaryAccountDescription(account?: SavingsAccount | null) {
  if (!account) return "No main savings wallet available.";

  const type = String(account.account_type || "").toUpperCase();

  if (type === "FLEXIBLE") {
    return "This is your main wallet for regular deposits and day-to-day savings use.";
  }

  if (type === "FIXED" && account.locked_until) {
    return `This account is fixed and locked until ${account.locked_until}.`;
  }

  if (type === "TARGET" && account.target_amount && account.target_deadline) {
    return `This target account is set for ${formatKes(
      account.target_amount
    )} by ${account.target_deadline}.`;
  }

  if (type === "TARGET" && account.target_deadline) {
    return `This target account has a deadline of ${account.target_deadline}.`;
  }

  return "This is your current primary savings wallet.";
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
        <Ionicons name={icon} size={17} color={tone} />
      </View>
      <Text style={styles.smallActionText}>{title}</Text>
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

  const totals = useMemo(() => {
    const sum = (k: keyof SavingsAccount) =>
      accounts.reduce((acc, a) => acc + (Number(a[k] ?? 0) || 0), 0);

    return {
      balance: sum("balance"),
      reserved: sum("reserved_amount"),
      available: sum("available_balance"),
    };
  }, [accounts]);

  const displayName = useMemo(() => formatDisplayName(user), [user]);
  const memberStatus = useMemo(() => formatStatus(user), [user]);
  const primaryAccount = useMemo(() => getPrimaryAccount(accounts), [accounts]);
  const extraAccounts = useMemo(
    () => getExtraAccounts(accounts, primaryAccount?.id ?? null),
    [accounts, primaryAccount]
  );

  const typeTone = useMemo(
    () => getAccountTypeTone(primaryAccount?.account_type),
    [primaryAccount]
  );

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
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.heroTop}>
          <View style={styles.heroAvatar}>
            <Ionicons name="wallet-outline" size={24} color={COLORS.white} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>SAVINGS PROFILE</Text>
            <Text style={styles.heroTitle}>{displayName}</Text>
            <Text style={styles.heroSubtitle}>
              {accounts.length > 0
                ? "Your main wallet is shown first for normal savings use. Add another account only when you need a specific savings purpose."
                : "Create your main savings wallet first, then continue with deposits from one clear flow."}
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
              Main wallet {primaryAccount ? "ready" : "not set"}
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <Card style={styles.errorCard} variant="default">
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

      {accounts.length === 0 ? (
        <Section
          title="Main Wallet"
          subtitle="Start with one main savings wallet."
        >
          <Card style={styles.emptyStartCard} variant="default">
            <View style={styles.emptyStartIcon}>
              <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
            </View>

            <Text style={styles.emptyStartTitle}>No savings wallet yet</Text>
            <Text style={styles.emptyStartText}>
              Create your main wallet first. Additional accounts should only be added when you need a fixed or target savings purpose.
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
      ) : (
        <>
          <Section
            title="Main Wallet"
            subtitle="Your main savings wallet is the primary account for deposits."
          >
            <Card style={styles.mainAccountCard} variant="default">
              <View style={styles.mainAccountTop}>
                <View style={styles.mainAccountIconWrap}>
                  <Ionicons
                    name="wallet-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.mainAccountTitle}>
                    {primaryAccount?.name || "Main wallet"}
                  </Text>
                  <Text style={styles.mainAccountSubtitle}>
                    {getPrimaryAccountDescription(primaryAccount)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.typePill,
                    { backgroundColor: typeTone.bg },
                  ]}
                >
                  <Text style={[styles.typePillText, { color: typeTone.color }]}>
                    {getAccountTypeLabel(primaryAccount?.account_type)}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <InfoRow
                label="Balance"
                value={formatKes(primaryAccount?.balance)}
              />
              <InfoRow
                label="Reserved"
                value={formatKes(primaryAccount?.reserved_amount)}
                valueColor={
                  toNumber(primaryAccount?.reserved_amount) > 0
                    ? COLORS.warning
                    : TEXT_MAIN
                }
              />
              <InfoRow
                label="Available"
                value={formatKes(primaryAccount?.available_balance)}
                valueColor={COLORS.success}
              />
              <InfoRow
                label="Status"
                value={primaryAccount?.is_active ? "Active" : "Inactive"}
                valueColor={
                  primaryAccount?.is_active ? COLORS.success : COLORS.danger
                }
              />

              <View style={{ marginTop: SPACING.md }}>
                <Button
                  title="Deposit Funds"
                  onPress={() => router.push(ROUTES.tabs.paymentsDeposit as any)}
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

          <Section
            title="More Options"
            subtitle="Only open these when you need something beyond the main wallet."
          >
            <View style={styles.smallActionsGrid}>
              <SmallAction
                title="Add Another Account"
                icon="add-circle-outline"
                tone={COLORS.primary}
                onPress={() => router.push(ROUTES.tabs.savingsCreate as any)}
              />

              <SmallAction
                title="History"
                icon="time-outline"
                tone={COLORS.warning}
                onPress={() =>
                  primaryAccount
                    ? router.push(
                        ROUTES.dynamic.savingsAccountHistory(primaryAccount.id) as any
                      )
                    : router.push(ROUTES.tabs.savingsCreate as any)
                }
              />

              <SmallAction
                title={finalWithdrawalAllowed ? "Withdraw" : "Withdraw Info"}
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
                    : primaryAccount
                    ? router.push(
                        ROUTES.dynamic.savingsAccountHistory(primaryAccount.id) as any
                      )
                    : router.push(ROUTES.tabs.savingsCreate as any)
                }
              />

              <SmallAction
                title="Summary"
                icon="stats-chart-outline"
                tone={COLORS.info}
                onPress={() => {}}
              />
            </View>
          </Section>

          {extraAccounts.length > 0 ? (
            <Section
              title="Additional Accounts"
              subtitle="These appear only because you created more than one savings account."
            >
              <Card style={styles.summaryCard} variant="default">
                <InfoRow
                  label="Extra accounts"
                  value={String(extraAccounts.length)}
                />
                <InfoRow
                  label="Combined balance"
                  value={formatKes(
                    extraAccounts.reduce(
                      (sum, account) => sum + toNumber(account.balance),
                      0
                    )
                  )}
                />
                <InfoRow
                  label="Combined available"
                  value={formatKes(
                    extraAccounts.reduce(
                      (sum, account) =>
                        sum + toNumber(account.available_balance),
                      0
                    )
                  )}
                  valueColor={COLORS.success}
                />
              </Card>
            </Section>
          ) : null}

          <Section
            title="Savings Summary"
            subtitle="A quick combined view across all your savings accounts."
          >
            <Card style={styles.summaryCard} variant="default">
              <InfoRow label="Total balance" value={formatKes(totals.balance)} />
              <InfoRow
                label="Total available"
                value={formatKes(totals.available)}
                valueColor={COLORS.success}
              />
              <InfoRow
                label="Total reserved"
                value={formatKes(totals.reserved)}
                valueColor={totals.reserved > 0 ? COLORS.warning : TEXT_MAIN}
              />
            </Card>
          </Section>
        </>
      )}

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
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
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

  mainAccountTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  mainAccountIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.primary}16`,
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

  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  typePillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.2,
  },

  summaryCard: {
    backgroundColor: SURFACE_3,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
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
  },

  smallActionIconWrap: {
    width: 38,
    height: 38,
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
});