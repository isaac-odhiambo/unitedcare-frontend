// app/(tabs)/dashboard/index.tsx
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
import { getMyLoans } from "@/services/loans";
import { getMyMerries } from "@/services/merry";
import { getMyLedger } from "@/services/payments";
import {
  canJoinGroup,
  canJoinMerry,
  canRequestLoan,
  canWithdraw,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { listMySavingsAccounts, SavingsAccount } from "@/services/savings";
import { getSessionUser, SessionUser } from "@/services/session";

type DashboardUser = Partial<MeResponse> & Partial<SessionUser>;

type Stat = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type ActionItem = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  go: () => void;
};

function StatCard({ label, value, icon }: Stat) {
  return (
    <Card style={styles.statCard}>
      <View style={styles.statRow}>
        <View style={styles.statIcon}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function ActionTile({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={styles.tile}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={20} color={COLORS.white} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </Card>
  );
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatKes(value: number): string {
  return `KES ${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function getSavingsTotal(accounts: SavingsAccount[]): number {
  return accounts.reduce(
    (sum, account) =>
      sum + toNumber(account.available_balance ?? account.balance ?? 0),
    0
  );
}

function getLoansTotal(loansData: any): number {
  const rows = Array.isArray(loansData)
    ? loansData
    : Array.isArray(loansData?.results)
    ? loansData.results
    : Array.isArray(loansData?.data)
    ? loansData.data
    : [];

  return rows.reduce((sum: number, loan: any) => {
    return sum + toNumber(
      loan?.outstanding_balance ??
        loan?.balance ??
        loan?.remaining_balance ??
        loan?.amount ??
        0
    );
  }, 0);
}

function getLedgerCount(ledgerData: any): number {
  const rows = Array.isArray(ledgerData)
    ? ledgerData
    : Array.isArray(ledgerData?.results)
    ? ledgerData.results
    : Array.isArray(ledgerData?.data)
    ? ledgerData.data
    : [];

  return rows.length;
}

function getMerryCount(merryData: any): number {
  const created = Array.isArray(merryData?.created) ? merryData.created.length : 0;
  const memberships = Array.isArray(merryData?.memberships)
    ? merryData.memberships.length
    : 0;

  return created + memberships;
}

export default function DashboardScreen() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({
    savings: "—",
    loans: "—",
    ledger: "—",
    merry: "—",
  });

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const loanAllowed = canRequestLoan(user);
  const groupAllowed = canJoinGroup(user);
  const merryAllowed = canJoinMerry(user);
  const withdrawAllowed = canWithdraw(user);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profileKyc);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [
        sessionResult,
        meResult,
        savingsResult,
        loansResult,
        ledgerResult,
        merryResult,
      ] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listMySavingsAccounts(),
        getMyLoans(),
        getMyLedger(),
        getMyMerries(),
      ]);

      const sessionUser =
        sessionResult.status === "fulfilled" ? sessionResult.value : null;
      const meUser = meResult.status === "fulfilled" ? meResult.value : null;

      const mergedUser: DashboardUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      const savingsTotal =
        savingsResult.status === "fulfilled"
          ? getSavingsTotal(savingsResult.value)
          : 0;

      const loansTotal =
        loansResult.status === "fulfilled" ? getLoansTotal(loansResult.value) : 0;

      const ledgerCount =
        ledgerResult.status === "fulfilled"
          ? getLedgerCount(ledgerResult.value)
          : 0;

      const merryCount =
        merryResult.status === "fulfilled" ? getMerryCount(merryResult.value) : 0;

      setStats({
        savings: formatKes(savingsTotal),
        loans: formatKes(loansTotal),
        ledger: `${ledgerCount} txns`,
        merry: `${merryCount} merries`,
      });
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

  const actions = useMemo<ActionItem[]>(() => {
    const common: ActionItem[] = [
      {
        title: "Savings",
        subtitle: "View savings accounts and balances",
        icon: "wallet-outline",
        go: () => router.push(ROUTES.tabs.savings),
      },
      {
        title: "Deposit",
        subtitle: "Add money to savings through payments",
        icon: "arrow-down-circle-outline",
        go: () => router.push(ROUTES.tabs.paymentsDeposit),
      },
      {
        title: "Withdrawals",
        subtitle: withdrawAllowed
          ? "Request or track withdrawals"
          : "Complete KYC before withdrawals",
        icon: "arrow-up-circle-outline",
        go: () =>
          withdrawAllowed
            ? router.push(ROUTES.tabs.paymentsWithdrawals)
            : goToKyc(),
      },
      {
        title: "Payments",
        subtitle: "Ledger, transactions and withdrawal history",
        icon: "card-outline",
        go: () => router.push(ROUTES.tabs.payments),
      },
      {
        title: "Loans",
        subtitle: loanAllowed
          ? "Request, pay and manage guarantors"
          : "Complete KYC before requesting a loan",
        icon: "cash-outline",
        go: () => (loanAllowed ? router.push(ROUTES.tabs.loans) : goToKyc()),
      },
      {
        title: "Groups",
        subtitle: groupAllowed
          ? "View groups and memberships"
          : "Complete KYC before joining groups",
        icon: "people-outline",
        go: () => (groupAllowed ? router.push(ROUTES.tabs.groups) : goToKyc()),
      },
      {
        title: "Merry-Go-Round",
        subtitle: merryAllowed
          ? "Dues, contributions and payout activity"
          : "Account approval required before joining merry",
        icon: "repeat-outline",
        go: () =>
          merryAllowed
            ? router.push(ROUTES.tabs.merry)
            : router.push(ROUTES.tabs.profile),
      },
      {
        title: "Profile",
        subtitle: kycComplete
          ? "Account details, KYC and settings"
          : "Complete your KYC to unlock more features",
        icon: "person-circle-outline",
        go: () => router.push(ROUTES.tabs.profile),
      },
    ];

    if (!isAdmin) return common;

    return [
      ...common,
      {
        title: "Approvals",
        subtitle: "Review withdrawals, join requests and confirmations",
        icon: "shield-checkmark-outline",
        go: () => router.push(ROUTES.tabs.payments),
      },
    ];
  }, [
    goToKyc,
    groupAllowed,
    isAdmin,
    kycComplete,
    loanAllowed,
    merryAllowed,
    withdrawAllowed,
  ]);

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
          subtitle="Please login to access your dashboard."
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
        <View style={{ flex: 1 }}>
          <Text style={styles.appName}>UNITED CARE</Text>
          <Text style={styles.subtitle}>
            {isAdmin ? "Dashboard (Admin View)" : "Dashboard"} •{" "}
            {user?.status ?? "—"}
          </Text>
        </View>

        <View style={styles.userPill}>
          <Ionicons name="person-outline" size={14} color={COLORS.primary} />
          <Text style={styles.userPillText} numberOfLines={1}>
            {user.username ?? "User"}
          </Text>
        </View>
      </View>

      {!kycComplete && (
        <Section title="Complete KYC">
          <Card
            style={styles.noteCard}
            onPress={() => router.push(ROUTES.tabs.profileKyc)}
          >
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.noteText}>
              Your account can access savings and merry, but loan requests,
              group joining and withdrawals require completed KYC.
            </Text>
          </Card>
        </Section>
      )}

      <Section title="Overview">
        <View style={styles.statsGrid}>
          <StatCard label="Savings" value={stats.savings} icon="wallet-outline" />
          <StatCard label="Loans" value={stats.loans} icon="cash-outline" />
          <StatCard label="Ledger" value={stats.ledger} icon="receipt-outline" />
          <StatCard label="Merries" value={stats.merry} icon="repeat-outline" />
        </View>
      </Section>

      <Section
        title="Quick Actions"
        right={
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
        }
      >
        <View style={styles.tiles}>
          {actions.map((a) => (
            <ActionTile
              key={a.title}
              title={a.title}
              subtitle={a.subtitle}
              icon={a.icon}
              onPress={a.go}
            />
          ))}
        </View>
      </Section>

      <Section title={isAdmin ? "Operations" : "Tips"}>
        <Card style={styles.noteCard}>
          <Ionicons
            name={isAdmin ? "shield-outline" : "information-circle-outline"}
            size={18}
            color={COLORS.info}
          />
          <Text style={styles.noteText}>
            {isAdmin
              ? "Review approvals in Payments and confirm member activity across Loans, Merry and Groups. Keep audit trails clean through the ledger."
              : kycComplete
              ? "Consistent savings deposits can improve loan readiness. Keep merry dues up to date and monitor your payment ledger regularly."
              : "Complete KYC to unlock withdrawals, loan requests and group membership while continuing to use savings and merry features."}
          </Text>
        </Card>
      </Section>

      <View style={{ height: 10 }} />
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },

  appName: {
    fontSize: FONT.title,
    fontFamily: FONT.bold,
    color: COLORS.text,
    letterSpacing: 0.3,
  },

  subtitle: {
    marginTop: 2,
    fontSize: FONT.caption,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  userPill: {
    flexShrink: 1,
    maxWidth: 170,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
  },

  userPillText: {
    fontSize: FONT.caption,
    fontFamily: FONT.medium,
    color: COLORS.text,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: SPACING.md,
  },

  statCard: {
    width: "48%",
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  statIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.overlay,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  statLabel: {
    fontSize: FONT.caption,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
  },

  statValue: {
    marginTop: 2,
    fontSize: FONT.body,
    color: COLORS.text,
    fontFamily: FONT.semiBold,
  },

  tiles: {
    gap: SPACING.md,
  },

  tile: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  tileTitle: {
    fontSize: FONT.body,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
  },

  tileSubtitle: {
    marginTop: 2,
    fontSize: FONT.caption,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  noteCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
  },
});