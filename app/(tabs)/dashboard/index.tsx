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

type NoticeItem = {
  id: string;
  title: string;
  subtitle?: string;
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

function getPrimarySavingsAccount(accounts: SavingsAccount[]) {
  if (!Array.isArray(accounts) || accounts.length === 0) return null;
  return accounts[0];
}

function formatUserStatus(status?: string) {
  const value = String(status || "ACTIVE").replaceAll("_", " ").trim();
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getToneColors(
  tone: "primary" | "success" | "warning" | "info" = "primary"
) {
  const map = {
    primary: {
      iconBg: "rgba(14, 94, 111, 0.10)",
      icon: COLORS.primary,
      border: "rgba(14, 94, 111, 0.10)",
      accent: COLORS.primary,
    },
    success: {
      iconBg: "rgba(22, 163, 74, 0.10)",
      icon: COLORS.secondary,
      border: "rgba(22, 163, 74, 0.10)",
      accent: COLORS.secondary,
    },
    warning: {
      iconBg: "rgba(245, 158, 11, 0.12)",
      icon: COLORS.warning,
      border: "rgba(245, 158, 11, 0.10)",
      accent: COLORS.warning,
    },
    info: {
      iconBg: "rgba(37, 99, 235, 0.10)",
      icon: COLORS.info,
      border: "rgba(37, 99, 235, 0.10)",
      accent: COLORS.info,
    },
  };

  return map[tone];
}

function StatPill({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.86}
      style={styles.statPill}
    >
      <View style={styles.statPillIcon}>
        <Ionicons name={icon} size={15} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statPillLabel}>{label}</Text>
        <Text style={styles.statPillValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.9)" />
      ) : null}
    </Wrapper>
  );
}

function ActionCard({
  title,
  amount,
  subtitle,
  icon,
  tone = "primary",
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  title: string;
  amount?: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "warning" | "info";
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  const colors = getToneColors(tone);

  return (
    <Card
      style={[
        styles.actionCard,
        {
          borderColor: colors.border,
        },
      ]}
      variant="default"
    >
      <View style={styles.actionTop}>
        <View style={[styles.actionIconWrap, { backgroundColor: colors.iconBg }]}>
          <Ionicons name={icon} size={20} color={colors.icon} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionSubtitle}>{subtitle}</Text>
        </View>
      </View>

      {amount ? (
        <View style={styles.actionAmountBox}>
          <Text style={styles.actionAmountLabel}>Amount</Text>
          <Text style={[styles.actionAmountValue, { color: colors.accent }]}>
            {amount}
          </Text>
        </View>
      ) : null}

      <View style={styles.actionButtons}>
        <Button title={primaryLabel} onPress={onPrimary} style={{ flex: 1 }} />
        {secondaryLabel && onSecondary ? (
          <>
            <View style={{ width: SPACING.sm }} />
            <Button
              title={secondaryLabel}
              variant="secondary"
              onPress={onSecondary}
              style={{ flex: 1 }}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

function NoticeCard({ item }: { item: NoticeItem }) {
  const colors = getToneColors(item.tone);

  return (
    <Card
      onPress={item.onPress}
      style={[styles.noticeCard, { borderColor: colors.border }]}
      variant="default"
    >
      <View style={[styles.noticeIcon, { backgroundColor: colors.iconBg }]}>
        <Ionicons name={item.icon} size={18} color={colors.icon} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.noticeTitle}>{item.title}</Text>
        {item.subtitle ? (
          <Text style={styles.noticeSubtitle}>{item.subtitle}</Text>
        ) : null}
        {item.actionLabel ? (
          <Text style={[styles.noticeAction, { color: colors.accent }]}>
            {item.actionLabel}
          </Text>
        ) : null}
      </View>

      {item.onPress ? (
        <Ionicons name="chevron-forward" size={17} color={COLORS.textMuted} />
      ) : null}
    </Card>
  );
}

function SmallLink({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={styles.smallLink}
    >
      <View style={styles.smallLinkLeft}>
        <View style={styles.smallLinkIcon}>
          <Ionicons name={icon} size={15} color={COLORS.primary} />
        </View>
        <Text style={styles.smallLinkText}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
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

  const openFirstMerryFlow = useCallback(() => {
    const items = merrySummary?.items ?? [];
    const payable =
      items.find((item) => hasAmount(item.required_now)) ||
      items.find((item) => hasAmount(item.pay_with_next)) ||
      items[0];

    if (!payable) {
      router.push(ROUTES.tabs.merry as any);
      return;
    }

    router.push({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        source: "merry",
        merryId: String(payable.merry_id),
        amount: String(payable.required_now || payable.pay_with_next || 0),
        editableAmount: "true",
      },
    });
  }, [merrySummary]);

  const openSavingsDeposit = useCallback(
    (account?: SavingsAccount | null) => {
      router.push({
        pathname: "/(tabs)/payments/deposit" as any,
        params: {
          source: "savings",
          savingsId: account?.id ? String(account.id) : "",
          amount: "",
          editableAmount: "true",
        },
      });
    },
    []
  );

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

      const savings =
        savingsResult.status === "fulfilled" ? savingsResult.value : [];
      setSavingsAccounts(savings);
      setHeroSavings(formatKes(getSavingsTotal(savings)));

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
  const primarySavingsAccount = useMemo(
    () => getPrimarySavingsAccount(savingsAccounts),
    [savingsAccounts]
  );

  const noticeItems = useMemo<NoticeItem[]>(() => {
    const items: NoticeItem[] = [];

    if (!kycComplete) {
      items.push({
        id: "kyc-needed",
        title: "Complete KYC",
        subtitle: "Finish verification to continue using all services.",
        icon: "shield-checkmark-outline",
        tone: "info",
        actionLabel: "Open",
        onPress: () => router.push(ROUTES.tabs.profileKyc as any),
      });
    }

    if (guaranteeRequests.length > 0) {
      items.push({
        id: "guarantee-requests",
        title:
          guaranteeRequests.length === 1
            ? "1 guarantor request pending"
            : `${guaranteeRequests.length} guarantor requests pending`,
        icon: "people-outline",
        tone: "primary",
        actionLabel: "View",
        onPress: () => router.push("/(tabs)/loans/guarantee-requests" as any),
      });
    }

    const approvedLoan = loans.find(
      (l) => String(l.status).toUpperCase() === "APPROVED"
    );

    if (approvedLoan) {
      items.push({
        id: "loan-approved",
        title: "Loan approved",
        icon: "checkmark-circle-outline",
        tone: "success",
        actionLabel: "Open",
        onPress: () =>
          router.push({
            pathname: "/(tabs)/loans/[id]" as any,
            params: { id: String(approvedLoan.id) },
          }),
      });
    }

    return items.slice(0, 2);
  }, [guaranteeRequests, kycComplete, loans]);

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
          subtitle="Please login to continue."
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
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.brandIcon}>
            <Ionicons
              name="people-circle-outline"
              size={24}
              color={COLORS.white}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>United Care</Text>
            <Text style={styles.brandSubtitle}>Self Help Group</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          onPress={onRefresh}
          style={styles.refreshBtn}
        >
          <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => router.push(ROUTES.tabs.profile as any)}
      >
        <Card style={styles.heroCard} variant="elevated">
          <View style={styles.heroDecorOne} />
          <View style={styles.heroDecorTwo} />

          <View style={styles.heroHeaderRow}>
            <View>
              <Text style={styles.heroTag}>
                {isAdmin ? "COMMUNITY LEAD" : "MEMBER"}
              </Text>
              <Text style={styles.heroTitle}>
                {greetingText}, {greetingName}
              </Text>
            </View>

            <View style={styles.heroArrow}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Ionicons name="ellipse" size={8} color="#8CF0C7" />
              <Text style={styles.heroMetaText}>
                {formatUserStatus(user?.status)}
              </Text>
            </View>
          </View>

          <View style={styles.heroStatsWrap}>
            <StatPill
              label="Savings"
              value={heroSavings}
              icon="wallet-outline"
              onPress={() => router.push(ROUTES.tabs.savings as any)}
            />
            <StatPill
              label="Merry Due"
              value={fmtKES(merrySummary?.total_required_now)}
              icon="repeat-outline"
              onPress={() => {
                if (!merryAllowed) {
                  goToKyc();
                  return;
                }
                openFirstMerryFlow();
              }}
            />
            <StatPill
              label="Groups"
              value={String(merrySummary?.active_merries ?? 0)}
              icon="people-outline"
              onPress={() => router.push(ROUTES.tabs.groups as any)}
            />
          </View>
        </Card>
      </TouchableOpacity>

      <Section title="Quick Actions">
        <View style={styles.actionsWrap}>
          <ActionCard
            title="Save"
            subtitle="Add money to your savings account."
            amount={heroSavings}
            icon="wallet-outline"
            tone="primary"
            primaryLabel="Save Now"
            secondaryLabel="Open"
            onPrimary={() => {
              if (!kycComplete) {
                goToKyc();
                return;
              }
              openSavingsDeposit(primarySavingsAccount);
            }}
            onSecondary={() => router.push(ROUTES.tabs.savings as any)}
          />

          <ActionCard
            title="Merry"
            subtitle="Continue your contribution."
            amount={fmtKES(merrySummary?.total_required_now)}
            icon="repeat-outline"
            tone="success"
            primaryLabel={
              hasAmount(merrySummary?.total_required_now) ? "Contribute" : "Open"
            }
            secondaryLabel="Summary"
            onPrimary={() => {
              if (!merryAllowed) {
                goToKyc();
                return;
              }
              openFirstMerryFlow();
            }}
            onSecondary={() => {
              if (!merryAllowed) {
                goToKyc();
                return;
              }
              router.push(ROUTES.tabs.merry as any);
            }}
          />
        </View>
      </Section>

      {noticeItems.length > 0 ? (
        <Section title="Updates">
          <View style={styles.noticeWrap}>
            {noticeItems.map((item) => (
              <NoticeCard key={item.id} item={item} />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="More">
        <View style={styles.smallLinksWrap}>
          {groupAllowed ? (
            <SmallLink
              title="Groups"
              icon="people-outline"
              onPress={() => router.push(ROUTES.tabs.groups as any)}
            />
          ) : null}

          <SmallLink
            title="Profile"
            icon="person-outline"
            onPress={() => router.push(ROUTES.tabs.profile as any)}
          />

          <SmallLink
            title="Notifications"
            icon="notifications-outline"
            onPress={() => router.push("/(tabs)/notifications" as any)}
          />

          <SmallLink
            title="Loans"
            icon={loanAllowed ? "document-text-outline" : "lock-closed-outline"}
            onPress={() =>
              loanAllowed
                ? router.push(ROUTES.tabs.loans as any)
                : goToKyc()
            }
          />

          {isAdmin ? (
            <SmallLink
              title="Admin"
              icon="shield-checkmark-outline"
              onPress={() => router.push(ROUTES.tabs.groups as any)}
            />
          ) : null}
        </View>
      </Section>

      {hasAmount(totalOutstandingLoans) ? (
        <View style={styles.loanStrip}>
          <Text style={styles.loanStripText}>
            Active loan balance: {formatKes(totalOutstandingLoans)}
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

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  brandIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.soft,
  },

  brandTitle: {
    ...TYPE.title,
    color: COLORS.text,
    fontWeight: "900",
  },

  brandSubtitle: {
    ...TYPE.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(14, 94, 111, 0.08)",
  },

  heroCard: {
    ...P.dashboardHero,
    borderRadius: 30,
    overflow: "hidden",
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  heroDecorOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    top: -60,
    right: -35,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroDecorTwo: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 999,
    bottom: -30,
    left: -15,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  heroTag: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "900",
    letterSpacing: 1,
  },

  heroTitle: {
    ...TYPE.h1,
    color: COLORS.white,
    marginTop: 8,
    fontWeight: "900",
  },

  heroArrow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  heroMetaRow: {
    flexDirection: "row",
    marginTop: SPACING.md,
  },

  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroMetaText: {
    ...TYPE.caption,
    color: COLORS.white,
    fontWeight: "800",
  },

  heroStatsWrap: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },

  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },

  statPillIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  statPillLabel: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.82)",
  },

  statPillValue: {
    ...TYPE.bodyStrong,
    color: COLORS.white,
    fontWeight: "900",
    marginTop: 2,
  },

  actionsWrap: {
    gap: SPACING.md,
  },

  actionCard: {
    padding: SPACING.md,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: COLORS.white,
  },

  actionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  actionIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  actionTitle: {
    ...TYPE.title,
    color: COLORS.text,
    fontWeight: "900",
  },

  actionSubtitle: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  actionAmountBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primarySoft,
  },

  actionAmountLabel: {
    ...TYPE.caption,
    color: COLORS.textMuted,
  },

  actionAmountValue: {
    marginTop: 4,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },

  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
  },

  noticeWrap: {
    gap: SPACING.sm,
  },

  noticeCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  noticeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeTitle: {
    ...TYPE.bodyStrong,
    color: COLORS.text,
    fontWeight: "800",
  },

  noticeSubtitle: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  noticeAction: {
    ...TYPE.caption,
    marginTop: 8,
    fontWeight: "900",
  },

  smallLinksWrap: {
    gap: SPACING.sm,
  },

  smallLink: {
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

  smallLinkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  smallLinkIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14, 94, 111, 0.08)",
  },

  smallLinkText: {
    ...TYPE.bodyStrong,
    color: COLORS.text,
    fontWeight: "700",
  },

  loanStrip: {
    marginTop: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(14, 94, 111, 0.08)",
  },

  loanStripText: {
    ...TYPE.caption,
    color: COLORS.textMuted,
    textAlign: "center",
    fontWeight: "700",
  },
});