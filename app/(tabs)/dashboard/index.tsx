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
import {
  COLORS,
  P,
  RADIUS,
  SHADOW,
  SPACING,
  TYPE,
} from "@/constants/theme";
import {
  getMyGuaranteeRequests,
  getMyLoans,
  Loan,
  LoanGuarantor,
} from "@/services/loans";
import {
  fmtKES,
  getMyAllMerryDueSummary,
  MerryDueSummaryItem,
  MyAllMerryDueSummaryResponse,
} from "@/services/merry";
import {
  canJoinGroup,
  canJoinMerry,
  canRequestLoan,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { listMySavingsAccounts, SavingsAccount } from "@/services/savings";
import { getSessionUser, SessionUser } from "@/services/session";

type DashboardUser = Partial<MeResponse> & Partial<SessionUser>;

type NotificationItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "success" | "warning" | "info";
  actionLabel?: string;
  onPress?: () => void;
};

function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getToneColors(
  tone: "primary" | "success" | "warning" | "info" = "primary"
) {
  const map = {
    primary: {
      soft: COLORS.primarySoft,
      softAlt: COLORS.dashboardHeroSoft,
      iconBg: "rgba(14, 94, 111, 0.10)",
      icon: COLORS.primary,
      border: "rgba(14, 94, 111, 0.10)",
      accent: COLORS.primary,
      statBg: COLORS.statCardBlue,
    },
    success: {
      soft: COLORS.secondarySoft,
      softAlt: COLORS.statCardGreen,
      iconBg: "rgba(22, 163, 74, 0.10)",
      icon: COLORS.secondary,
      border: "rgba(22, 163, 74, 0.10)",
      accent: COLORS.secondary,
      statBg: COLORS.statCardGreen,
    },
    warning: {
      soft: COLORS.warningSoft,
      softAlt: COLORS.statCardOrange,
      iconBg: "rgba(245, 158, 11, 0.12)",
      icon: COLORS.warning,
      border: "rgba(245, 158, 11, 0.10)",
      accent: COLORS.warning,
      statBg: COLORS.statCardOrange,
    },
    info: {
      soft: COLORS.infoSoft,
      softAlt: COLORS.statCardBlue,
      iconBg: "rgba(37, 99, 235, 0.10)",
      icon: COLORS.info,
      border: "rgba(37, 99, 235, 0.10)",
      accent: COLORS.info,
      statBg: COLORS.statCardBlue,
    },
  };

  return map[tone];
}

function formatUserStatus(status?: string) {
  const value = String(status || "ACTIVE").replaceAll("_", " ").trim();
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
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

function hasAmount(value?: string | number | null): boolean {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0;
}

function getSavingsTotal(accounts: SavingsAccount[]): number {
  return accounts.reduce(
    (sum, account) =>
      sum + toNumber(account.available_balance ?? account.balance ?? 0),
    0
  );
}

function getLoansTotal(loansData: Loan[]): number {
  const rows = Array.isArray(loansData) ? loansData : [];
  return rows.reduce((sum: number, loan: Loan) => {
    return sum + toNumber(loan?.outstanding_balance ?? 0);
  }, 0);
}

function StatTile({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "warning" | "info";
}) {
  const colors = getToneColors(tone);

  return (
    <Card
      style={[
        styles.statCard,
        {
          backgroundColor: colors.statBg,
          borderColor: colors.border,
        },
      ]}
      variant="default"
    >
      <View style={[styles.statIconWrap, { backgroundColor: colors.iconBg }]}>
        <Ionicons name={icon} size={18} color={colors.icon} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </Card>
  );
}

function PriorityActionCard({
  title,
  subtitle,
  amount,
  icon,
  tone = "primary",
  primaryLabel,
  secondaryLabel,
  onPrimaryPress,
  onSecondaryPress,
}: {
  title: string;
  subtitle: string;
  amount?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "warning" | "info";
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimaryPress: () => void;
  onSecondaryPress?: () => void;
}) {
  const colors = getToneColors(tone);

  return (
    <Card style={styles.priorityCard} variant="default">
      <View style={styles.priorityTop}>
        <View style={[styles.priorityIconWrap, { backgroundColor: colors.iconBg }]}>
          <Ionicons name={icon} size={20} color={colors.icon} />
        </View>

        <View style={styles.priorityTextWrap}>
          <Text style={styles.priorityTitle}>{title}</Text>
          <Text style={styles.prioritySubtitle}>{subtitle}</Text>
        </View>
      </View>

      {amount ? (
        <View style={[styles.priorityAmountBox, { backgroundColor: colors.soft }]}>
          <Text style={styles.priorityAmountLabel}>Amount</Text>
          <Text style={[styles.priorityAmountValue, { color: colors.accent }]}>
            {amount}
          </Text>
        </View>
      ) : null}

      <View style={styles.priorityButtonRow}>
        <Button title={primaryLabel} onPress={onPrimaryPress} style={{ flex: 1 }} />
        {secondaryLabel && onSecondaryPress ? (
          <>
            <View style={{ width: SPACING.sm }} />
            <Button
              title={secondaryLabel}
              variant="secondary"
              onPress={onSecondaryPress}
              style={{ flex: 1 }}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

function NotificationCard({ item }: { item: NotificationItem }) {
  const colors = getToneColors(item.tone);

  return (
    <Card
      onPress={item.onPress}
      style={[
        styles.notificationCard,
        {
          backgroundColor: COLORS.white,
          borderColor: colors.border,
        },
      ]}
      variant="default"
    >
      <View style={[styles.notificationIconWrap, { backgroundColor: colors.iconBg }]}>
        <Ionicons name={item.icon} size={18} color={colors.icon} />
      </View>

      <View style={styles.notificationTextWrap}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationSubtitle}>{item.subtitle}</Text>
        {item.actionLabel ? (
          <Text style={[styles.notificationAction, { color: colors.accent }]}>
            {item.actionLabel}
          </Text>
        ) : null}
      </View>

      {item.onPress ? (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      ) : null}
    </Card>
  );
}

function MiniLink({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={styles.miniLinkCard} variant="default">
      <View style={styles.miniLinkInner}>
        <View style={styles.miniLinkIcon}>
          <Ionicons name={icon} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.miniLinkText}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </Card>
  );
}

function MerryDueCard({ item }: { item: MerryDueSummaryItem }) {
  const overdue = hasAmount(item.overdue);
  const current = hasAmount(item.current_due);
  const next = hasAmount(item.next_due);

  const badgeText = overdue
    ? "Overdue"
    : current
      ? "Due now"
      : next
        ? "Next due"
        : "Up to date";

  const badgeStyle = overdue
    ? styles.merryBadgeDanger
    : current
      ? styles.merryBadgeWarning
      : styles.merryBadgeSuccess;

  return (
    <Card style={styles.merryCard} variant="default">
      <View style={styles.merryCardTop}>
        <View style={{ flex: 1, paddingRight: SPACING.sm }}>
          <Text style={styles.merryCardTitle}>{item.merry_name}</Text>
          <Text style={styles.merryCardSub}>
            {item.seat_count} seat{item.seat_count === 1 ? "" : "s"}
            {item.seat_numbers?.length ? ` • ${item.seat_numbers.join(", ")}` : ""}
          </Text>
        </View>

        <View style={[styles.merryBadge, badgeStyle]}>
          <Text style={styles.merryBadgeText}>{badgeText}</Text>
        </View>
      </View>

      <View style={styles.merryAmountBox}>
        <Text style={styles.merryAmountLabel}>Required now</Text>
        <Text style={styles.merryAmountValue}>{fmtKES(item.required_now)}</Text>
      </View>

      <View style={styles.merryMeta}>
        <View style={styles.merryMetaRow}>
          <Text style={styles.merryMetaLabel}>Overdue</Text>
          <Text style={styles.merryMetaValue}>{fmtKES(item.overdue)}</Text>
        </View>

        <View style={styles.merryMetaRow}>
          <Text style={styles.merryMetaLabel}>Current due</Text>
          <Text style={styles.merryMetaValue}>{fmtKES(item.current_due)}</Text>
        </View>

        {next ? (
          <View style={styles.merryMetaRow}>
            <Text style={styles.merryMetaLabel}>Next due</Text>
            <Text style={styles.merryMetaValue}>
              {fmtKES(item.next_due)}
              {item.next_due_date ? ` • ${item.next_due_date}` : ""}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.merryActionRow}>
        <Button
          title="Open"
          variant="secondary"
          onPress={() =>
            router.push(ROUTES.dynamic.merryDetail(item.merry_id) as any)
          }
          style={{ flex: 1 }}
        />
        <View style={{ width: SPACING.sm }} />
        <Button
          title={hasAmount(item.required_now) ? "Pay Now" : "View"}
          onPress={() =>
            router.push(ROUTES.dynamic.merryDetail(item.merry_id) as any)
          }
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

export default function DashboardScreen() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [heroSavings, setHeroSavings] = useState("—");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [guaranteeRequests, setGuaranteeRequests] = useState<LoanGuarantor[]>([]);
  const [merrySummary, setMerrySummary] =
    useState<MyAllMerryDueSummaryResponse | null>(null);

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const loanAllowed = canRequestLoan(user);
  const groupAllowed = canJoinGroup(user);
  const merryAllowed = canJoinMerry(user);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profileKyc as any);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [
        sessionResult,
        meResult,
        savingsResult,
        loansResult,
        merrySummaryResult,
        guaranteeResult,
      ] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listMySavingsAccounts(),
        getMyLoans(),
        getMyAllMerryDueSummary(),
        getMyGuaranteeRequests(),
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

      const savingsAccounts =
        savingsResult.status === "fulfilled" ? savingsResult.value : [];
      const savingsTotal = getSavingsTotal(savingsAccounts);
      setHeroSavings(formatKes(savingsTotal));

      setLoans(loansResult.status === "fulfilled" ? loansResult.value : []);
      setGuaranteeRequests(
        guaranteeResult.status === "fulfilled" ? guaranteeResult.value : []
      );
      setMerrySummary(
        merrySummaryResult.status === "fulfilled" ? merrySummaryResult.value : null
      );
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

  const greetingName = useMemo(() => {
    return (
      user?.username ||
      (typeof user?.phone === "string" ? user.phone : "") ||
      "Member"
    );
  }, [user]);

  const greetingText = useMemo(() => getGreetingByTime(), []);
  const totalOutstandingLoans = useMemo(() => getLoansTotal(loans), [loans]);

  const topMerryCards = useMemo(() => {
    return (merrySummary?.items ?? []).slice(0, 2);
  }, [merrySummary]);

  const firstPayableMerry = useMemo(() => {
    const items = merrySummary?.items ?? [];
    return (
      items.find((item) => hasAmount(item.required_now)) ||
      items.find((item) => hasAmount(item.pay_with_next)) ||
      items[0] ||
      null
    );
  }, [merrySummary]);

  const stats = useMemo(() => {
    return {
      savings: heroSavings,
      merryDue: fmtKES(merrySummary?.total_required_now),
      activeMerry: String(merrySummary?.active_merries ?? 0),
    };
  }, [heroSavings, merrySummary]);

  const notificationItems = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    if (!kycComplete) {
      items.push({
        id: "kyc-needed",
        title: "Complete your verification",
        subtitle:
          "Finish KYC to unlock full participation in savings, groups and merry.",
        icon: "shield-checkmark-outline",
        tone: "info",
        actionLabel: "Open KYC",
        onPress: () => router.push(ROUTES.tabs.profileKyc as any),
      });
    }

    if (hasAmount(merrySummary?.total_overdue)) {
      items.push({
        id: "merry-overdue",
        title: "Merry contribution needs attention",
        subtitle: `You have overdue merry contributions of ${fmtKES(
          merrySummary?.total_overdue
        )}.`,
        icon: "warning-outline",
        tone: "warning",
        actionLabel: "Open merry",
        onPress: () => router.push(ROUTES.tabs.merry as any),
      });
    }

    if (guaranteeRequests.length > 0) {
      items.push({
        id: "guarantee-requests",
        title: "Support request waiting",
        subtitle:
          guaranteeRequests.length === 1
            ? "You have 1 pending guarantor request."
            : `You have ${guaranteeRequests.length} pending guarantor requests.`,
        icon: "notifications-outline",
        tone: "warning",
        actionLabel: "View requests",
        onPress: () => router.push("/(tabs)/loans/guarantee-requests" as any),
      });
    }

    const approvedLoan = loans.find(
      (l) => String(l.status).toUpperCase() === "APPROVED"
    );

    if (approvedLoan) {
      items.push({
        id: "loan-approved",
        title: "Loan update available",
        subtitle: "One of your loan applications has been approved.",
        icon: "checkmark-circle-outline",
        tone: "success",
        actionLabel: "Open loan",
        onPress: () =>
          router.push({
            pathname: "/(tabs)/loans/[id]" as any,
            params: { id: String(approvedLoan.id) },
          }),
      });
    }

    return items.slice(0, 3);
  }, [guaranteeRequests, kycComplete, loans, merrySummary]);

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
      <View style={styles.headerRow}>
        <View style={styles.headerBrand}>
          <View style={styles.headerBrandIcon}>
            <Ionicons
              name="people-circle-outline"
              size={22}
              color={COLORS.white}
            />
          </View>

          <View style={styles.headerBrandText}>
            <Text style={styles.headerTitle}>United Care</Text>
            <Text style={styles.headerSubtitle}>Self-help group dashboard</Text>
          </View>
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

      <Card style={styles.heroCard} variant="elevated">
        <View style={styles.heroCircleOne} />
        <View style={styles.heroCircleTwo} />
        <View style={styles.heroGlow} />

        <View style={styles.heroTop}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroEyebrow}>
              {isAdmin ? "COMMUNITY LEAD VIEW" : "SELF-HELP GROUP MEMBER"}
            </Text>
            <Text style={styles.heroTitle}>
              {greetingText}, {greetingName}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isAdmin
                ? "Support the group through active merry participation and steady savings."
                : "Stay active in merry and keep building your savings journey."}
            </Text>
          </View>

          <View style={styles.heroAvatar}>
            <Ionicons
              name={isAdmin ? "shield-checkmark-outline" : "heart-outline"}
              size={24}
              color={COLORS.white}
            />
          </View>
        </View>

        <View style={styles.heroBalanceCard}>
          <Text style={styles.heroBalanceLabel}>Merry due now</Text>
          <Text style={styles.heroBalanceValue}>
            {fmtKES(merrySummary?.total_required_now)}
          </Text>
          <Text style={styles.heroBalanceNote}>
            {hasAmount(merrySummary?.total_overdue)
              ? `Includes overdue of ${fmtKES(merrySummary?.total_overdue)}`
              : "Open merry to review your current and upcoming contributions."}
          </Text>
        </View>

        <View style={styles.heroButtonRow}>
          <Button
            title={
              firstPayableMerry
                ? "Pay Merry Now"
                : merryAllowed
                  ? "Open Merry"
                  : "Unlock Merry"
            }
            onPress={() => {
              if (firstPayableMerry) {
                router.push(
                  ROUTES.dynamic.merryDetail(firstPayableMerry.merry_id) as any
                );
              } else if (merryAllowed) {
                router.push(ROUTES.tabs.merry as any);
              } else {
                goToKyc();
              }
            }}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="Savings"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.savings as any)}
            style={{ flex: 1 }}
          />
        </View>

        <View style={styles.heroPills}>
          <View style={styles.heroPill}>
            <Ionicons name="ellipse" size={8} color="#8CF0C7" />
            <Text style={styles.heroPillText}>
              {formatUserStatus(user?.status)}
            </Text>
          </View>

          <View style={styles.heroPill}>
            <Ionicons
              name={isAdmin ? "shield-outline" : "people-outline"}
              size={14}
              color={COLORS.white}
            />
            <Text style={styles.heroPillText}>
              {isAdmin ? "Community lead" : "Saving together"}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.overviewRow}>
        <StatTile
          label="Savings"
          value={stats.savings}
          icon="wallet-outline"
          tone="primary"
        />
        <StatTile
          label="Merry Due"
          value={stats.merryDue}
          icon="repeat-outline"
          tone="success"
        />
        <StatTile
          label="Active Merry"
          value={stats.activeMerry}
          icon="people-outline"
          tone="info"
        />
      </View>

      <Section
        title="Main Actions"
        subtitle="Keep the dashboard focused on the two most important areas."
      >
        <View style={styles.priorityWrap}>
          <PriorityActionCard
            title="Merry"
            subtitle={
              hasAmount(merrySummary?.total_required_now)
                ? "Your merry has an amount ready for action."
                : "Open merry and manage your participation."
            }
            amount={fmtKES(merrySummary?.total_required_now)}
            icon="repeat-outline"
            tone="success"
            primaryLabel={
              hasAmount(merrySummary?.total_required_now) ? "Pay Now" : "Open Merry"
            }
            secondaryLabel="View"
            onPrimaryPress={() => {
              if (firstPayableMerry) {
                router.push(
                  ROUTES.dynamic.merryDetail(firstPayableMerry.merry_id) as any
                );
              } else {
                router.push(ROUTES.tabs.merry as any);
              }
            }}
            onSecondaryPress={() => router.push(ROUTES.tabs.merry as any)}
          />

          <PriorityActionCard
            title="Savings"
            subtitle="Continue growing your savings without leaving the main flow."
            amount={heroSavings}
            icon="wallet-outline"
            tone="primary"
            primaryLabel="Open Savings"
            secondaryLabel="Deposit"
            onPrimaryPress={() => router.push(ROUTES.tabs.savings as any)}
            onSecondaryPress={() => router.push(ROUTES.tabs.savings as any)}
          />
        </View>
      </Section>

      <Section
        title="Merry Summary"
        subtitle="A short summary only, without overcrowding the dashboard."
      >
        {topMerryCards.length === 0 ? (
          <EmptyState
            icon="repeat-outline"
            title="No active merry yet"
            subtitle={
              merryAllowed
                ? "When you join a merry, your summary will appear here."
                : "Complete the needed account steps to unlock merry participation."
            }
            actionLabel={merryAllowed ? "Open Merry" : "Complete KYC"}
            onAction={() =>
              merryAllowed
                ? router.push(ROUTES.tabs.merry as any)
                : goToKyc()
            }
          />
        ) : (
          <View style={styles.merryCardsWrap}>
            {topMerryCards.map((item) => (
              <MerryDueCard key={`merry-${item.merry_id}`} item={item} />
            ))}
          </View>
        )}
      </Section>

      {notificationItems.length > 0 ? (
        <Section
          title="Action Needed"
          subtitle="Only important updates are shown here."
        >
          <View style={styles.notificationsWrap}>
            {notificationItems.map((item) => (
              <NotificationCard key={item.id} item={item} />
            ))}
          </View>
        </Section>
      ) : null}

      <Section
        title="Other Links"
        subtitle="Secondary areas stay small and out of the main dashboard flow."
      >
        <View style={styles.miniLinksWrap}>
          {groupAllowed ? (
            <MiniLink
              title="Groups"
              icon="people-outline"
              onPress={() => router.push(ROUTES.tabs.groups as any)}
            />
          ) : null}

          <MiniLink
            title="Profile"
            icon="person-outline"
            onPress={() => router.push(ROUTES.tabs.profile as any)}
          />

          <MiniLink
            title="Notifications"
            icon="notifications-outline"
            onPress={() => router.push("/(tabs)/notifications" as any)}
          />

          <MiniLink
            title="Loans"
            icon={loanAllowed ? "cash-outline" : "lock-closed-outline"}
            onPress={() =>
              loanAllowed
                ? router.push(ROUTES.tabs.loans as any)
                : goToKyc()
            }
          />

          {isAdmin ? (
            <MiniLink
              title="Admin"
              icon="shield-checkmark-outline"
              onPress={() => router.push(ROUTES.tabs.groups as any)}
            />
          ) : null}
        </View>
      </Section>

      {hasAmount(totalOutstandingLoans) ? (
        <View style={styles.loanNoteWrap}>
          <Text style={styles.loanNoteText}>
            Loan balance: {formatKes(totalOutstandingLoans)}
          </Text>
        </View>
      ) : null}

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
    paddingBottom: SPACING.xl,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  headerBrandText: {
    flex: 1,
  },

  headerBrandIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.soft,
  },

  headerTitle: {
    ...TYPE.title,
    color: COLORS.text,
    fontWeight: "900",
  },

  headerSubtitle: {
    ...TYPE.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  heroCard: {
    ...P.dashboardHero,
    overflow: "hidden",
    marginBottom: SPACING.lg,
    borderRadius: 30,
  },

  heroCircleOne: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -90,
    right: -40,
  },

  heroCircleTwo: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -40,
    left: -30,
  },

  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(140, 240, 199, 0.09)",
    top: 55,
    right: 15,
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroTextBlock: {
    flex: 1,
    paddingRight: SPACING.md,
  },

  heroEyebrow: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "900",
    letterSpacing: 1,
  },

  heroTitle: {
    ...TYPE.h1,
    color: COLORS.white,
    marginTop: 6,
    fontWeight: "900",
  },

  heroSubtitle: {
    ...TYPE.subtext,
    color: "rgba(255,255,255,0.88)",
    marginTop: 8,
    lineHeight: 20,
  },

  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  heroBalanceCard: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255,255,255,0.11)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  heroBalanceLabel: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.74)",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  heroBalanceValue: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    color: COLORS.white,
  },

  heroBalanceNote: {
    ...TYPE.subtext,
    color: "rgba(255,255,255,0.82)",
    marginTop: 6,
    lineHeight: 18,
  },

  heroButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
  },

  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
  },

  heroPillText: {
    ...TYPE.caption,
    color: COLORS.white,
    fontWeight: "800",
  },

  overviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    minHeight: 118,
  },

  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },

  statLabel: {
    ...TYPE.caption,
    color: COLORS.textMuted,
    fontWeight: "700",
  },

  statValue: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: COLORS.text,
  },

  priorityWrap: {
    gap: SPACING.md,
  },

  priorityCard: {
    padding: SPACING.md,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(14, 94, 111, 0.08)",
  },

  priorityTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  priorityIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  priorityTextWrap: {
    flex: 1,
  },

  priorityTitle: {
    ...TYPE.title,
    color: COLORS.text,
    fontWeight: "900",
  },

  prioritySubtitle: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  priorityAmountBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
  },

  priorityAmountLabel: {
    ...TYPE.caption,
    color: COLORS.textMuted,
  },

  priorityAmountValue: {
    marginTop: 4,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },

  priorityButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
  },

  merryCardsWrap: {
    gap: SPACING.md,
  },

  merryCard: {
    padding: SPACING.md,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(14, 94, 111, 0.08)",
  },

  merryCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  merryCardTitle: {
    ...TYPE.title,
    color: COLORS.text,
    fontWeight: "900",
  },

  merryCardSub: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  merryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },

  merryBadgeDanger: {
    backgroundColor: COLORS.dangerSoft,
  },

  merryBadgeWarning: {
    backgroundColor: COLORS.warningSoft,
  },

  merryBadgeSuccess: {
    backgroundColor: COLORS.successSoft,
  },

  merryBadgeText: {
    ...TYPE.caption,
    fontWeight: "900",
    color: COLORS.text,
  },

  merryAmountBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primarySoft,
  },

  merryAmountLabel: {
    ...TYPE.caption,
    color: COLORS.textMuted,
  },

  merryAmountValue: {
    ...TYPE.h2,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: "900",
  },

  merryMeta: {
    marginTop: SPACING.md,
    gap: 10,
  },

  merryMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  merryMetaLabel: {
    ...TYPE.caption,
    color: COLORS.textMuted,
  },

  merryMetaValue: {
    ...TYPE.bodyStrong,
    color: COLORS.text,
    flexShrink: 1,
    textAlign: "right",
  },

  merryActionRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  notificationsWrap: {
    gap: SPACING.sm,
  },

  notificationCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  notificationIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationTextWrap: {
    flex: 1,
  },

  notificationTitle: {
    ...TYPE.bodyStrong,
    color: COLORS.text,
    fontWeight: "800",
  },

  notificationSubtitle: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  notificationAction: {
    ...TYPE.caption,
    marginTop: 8,
    fontWeight: "900",
  },

  miniLinksWrap: {
    gap: SPACING.sm,
  },

  miniLinkCard: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(14, 94, 111, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  miniLinkInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  miniLinkIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14, 94, 111, 0.08)",
  },

  miniLinkText: {
    ...TYPE.bodyStrong,
    color: COLORS.text,
    fontWeight: "700",
  },

  loanNoteWrap: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },

  loanNoteText: {
    ...TYPE.caption,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});