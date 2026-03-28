import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  getGroupIdFromMembership,
  getGroupNameFromMembership,
  GroupMembership,
  listGroupMemberships,
} from "@/services/groups";
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
  canRequestLoan,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse
} from "@/services/profile";
import { listMySavingsAccounts, SavingsAccount } from "@/services/savings";
import { getSessionUser, SessionUser } from "@/services/session";

type DashboardUser = Partial<MeResponse> &
  Partial<SessionUser> & {
    member_number?: string | number;
    full_name?: string;
    name?: string;
  };

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
    const n = Number(String(value).replace(/,/g, "").trim());
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
  return accounts.reduce((sum, account) => {
    return sum + toNumber(account.available_balance ?? account.balance ?? 0);
  }, 0);
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

function getActiveLoan(loansData: Loan[]) {
  if (!Array.isArray(loansData) || loansData.length === 0) return null;

  return (
    loansData.find((loan) => {
      const status = String(loan?.status || "").toUpperCase();
      return ["APPROVED", "ACTIVE", "DISBURSED", "UNDER_REPAYMENT"].includes(
        status
      );
    }) || null
  );
}

function formatUserStatus(status?: string) {
  const value = String(status || "ACTIVE").replaceAll("_", " ").trim();
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getMemberIdentity(user: DashboardUser | null) {
  return (
    user?.full_name ||
    user?.name ||
    user?.username ||
    (typeof user?.phone === "string" ? user.phone : "") ||
    "Member"
  );
}

function getToneColors(
  tone: "primary" | "success" | "warning" | "info" = "primary"
) {
  const map = {
    primary: {
      iconBg: COLORS.primaryLight,
      icon: COLORS.primary,
      border: "rgba(14, 94, 111, 0.12)",
      accent: COLORS.primary,
      cardTint: "rgba(14, 94, 111, 0.03)",
      valueBg: "rgba(14, 94, 111, 0.06)",
    },
    success: {
      iconBg: COLORS.secondaryLight,
      icon: COLORS.secondary,
      border: "rgba(22, 163, 74, 0.12)",
      accent: COLORS.secondary,
      cardTint: "rgba(22, 163, 74, 0.03)",
      valueBg: "rgba(22, 163, 74, 0.06)",
    },
    warning: {
      iconBg: COLORS.accentLight,
      icon: COLORS.accentDark,
      border: "rgba(242, 140, 40, 0.14)",
      accent: COLORS.accentDark,
      cardTint: "rgba(242, 140, 40, 0.03)",
      valueBg: "rgba(242, 140, 40, 0.07)",
    },
    info: {
      iconBg: COLORS.primaryLight,
      icon: COLORS.primary,
      border: "rgba(14, 94, 111, 0.10)",
      accent: COLORS.primary,
      cardTint: "rgba(14, 94, 111, 0.025)",
      valueBg: "rgba(14, 94, 111, 0.05)",
    },
  };

  return map[tone];
}

async function clearDashboardSession() {
  const possibleKeys = [
    "access",
    "refresh",
    "access_token",
    "refresh_token",
    "ACCESS_TOKEN",
    "REFRESH_TOKEN",
    "user",
    "session_user",
    "SESSION_USER",
    "me",
  ];

  try {
    if (Platform.OS === "web") {
      possibleKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {}
      });
    } else {
      await Promise.allSettled(
        possibleKeys.map((key) => SecureStore.deleteItemAsync(key))
      );
    }
  } catch {}
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  tone = "primary",
  onPress,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "warning" | "info";
  onPress?: () => void;
}) {
  const colors = getToneColors(tone);

  return (
    <TouchableOpacity
      activeOpacity={0.94}
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.summaryCard,
        {
          borderColor: colors.border,
          backgroundColor: COLORS.white,
        },
      ]}
    >
      <View
        style={[
          styles.summaryCardGlow,
          { backgroundColor: colors.cardTint },
        ]}
      />

      <View style={styles.summaryTop}>
        <View style={[styles.summaryIconWrap, { backgroundColor: colors.iconBg }]}>
          <Ionicons name={icon} size={18} color={colors.icon} />
        </View>

        {onPress ? (
          <View style={styles.summaryChevronWrap}>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.textMuted}
            />
          </View>
        ) : null}
      </View>

      <Text style={styles.summaryTitle}>{title}</Text>

      <View
        style={[
          styles.summaryValueWrap,
          { backgroundColor: colors.valueBg },
        ]}
      >
        <Text style={[styles.summaryValue, { color: colors.accent }]}>{value}</Text>
      </View>

      <Text style={styles.summarySubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

function SpaceCard({
  title,
  subtitle,
  icon,
  tone = "primary",
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  title: string;
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
        styles.spaceCard,
        {
          borderColor: colors.border,
          backgroundColor: COLORS.white,
        },
      ]}
      variant="default"
    >
      <View
        style={[
          styles.spaceCardGlow,
          { backgroundColor: colors.cardTint },
        ]}
      />

      <View style={styles.spaceHead}>
        <View style={[styles.spaceIcon, { backgroundColor: colors.iconBg }]}>
          <Ionicons name={icon} size={20} color={colors.icon} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.spaceTitle}>{title}</Text>
          <Text style={styles.spaceSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.spaceActions}>
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
      style={[
        styles.noticeCard,
        {
          borderColor: colors.border,
          backgroundColor: COLORS.white,
        },
      ]}
      variant="default"
    >
      <View
        style={[
          styles.noticeStripe,
          { backgroundColor: colors.accent },
        ]}
      />

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
  danger = false,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.smallLink,
        danger && {
          borderColor: "rgba(220, 38, 38, 0.12)",
          backgroundColor: "rgba(220, 38, 38, 0.04)",
        },
      ]}
    >
      <View style={styles.smallLinkLeft}>
        <View
          style={[
            styles.smallLinkIcon,
            danger
              ? { backgroundColor: "rgba(220, 38, 38, 0.10)" }
              : { backgroundColor: COLORS.primaryLight },
          ]}
        >
          <Ionicons
            name={icon}
            size={15}
            color={danger ? COLORS.error : COLORS.primary}
          />
        </View>
        <Text
          style={[
            styles.smallLinkText,
            danger && { color: "#B91C1C" },
          ]}
        >
          {title}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={danger ? COLORS.error : COLORS.textMuted}
      />
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 760;

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [heroSavings, setHeroSavings] = useState("—");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [guaranteeRequests, setGuaranteeRequests] = useState<LoanGuarantor[]>([]);
  const [merrySummary, setMerrySummary] =
    useState<MyAllMerryDueSummaryResponse | null>(null);
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([]);

  const isAdmin = isAdminUser(user as any);
  const kycComplete = isKycComplete(user as any);
  const loanAllowed = canRequestLoan(user as any);

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

    router.replace({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        source: "merry",
        merryId: String(payable.merry_id),
        amount: String(payable.required_now || payable.pay_with_next || 0),
        editableAmount: "true",
      },
    });
  }, [merrySummary]);

  const openSavingsFlow = useCallback((account?: SavingsAccount | null) => {
    if (!account) {
      router.push(ROUTES.tabs.savings as any);
      return;
    }

    router.replace({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        source: "savings",
        savingsId: String(account.id),
        amount: "",
        editableAmount: "true",
      },
    });
  }, []);

  const openLoanPaymentFlow = useCallback((loan?: Loan | null) => {
    if (!loan) {
      router.push(ROUTES.tabs.loans as any);
      return;
    }

    router.replace({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        source: "loan",
        loanId: String(loan.id),
        amount: "",
        editableAmount: "true",
      },
    });
  }, []);

  const openGroupContributionFlow = useCallback((groupId?: number | null) => {
    if (!groupId) {
      router.push(ROUTES.tabs.groups as any);
      return;
    }

    router.push({
      pathname: "/(tabs)/groups/contribute" as any,
      params: { groupId: String(groupId) },
    });
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
        membershipsResult,
      ] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listMySavingsAccounts(),
        getMyLoans(),
        getMyAllMerryDueSummary(),
        getMyGuaranteeRequests(),
        listGroupMemberships(),
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
        merrySummaryResult.status === "fulfilled"
          ? merrySummaryResult.value
          : null
      );
      setGroupMemberships(
        membershipsResult.status === "fulfilled" && Array.isArray(membershipsResult.value)
          ? membershipsResult.value
          : []
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

  const handleLogout = useCallback(() => {
    Alert.alert("Log out", "Do you want to leave your account for now?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            setLoggingOut(true);
            await clearDashboardSession();
            router.replace(ROUTES.auth.login as any);
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }, []);

  const memberName = useMemo(() => getMemberIdentity(user), [user]);
  const greetingText = useMemo(() => getGreetingByTime(), []);
  const totalOutstandingLoans = useMemo(() => getLoansTotal(loans), [loans]);
  const primarySavingsAccount = useMemo(
    () => getPrimarySavingsAccount(savingsAccounts),
    [savingsAccounts]
  );
  const activeLoan = useMemo(() => getActiveLoan(loans), [loans]);

  const activeGroupMemberships = useMemo(
    () => groupMemberships.filter((m: any) => !!m?.is_active),
    [groupMemberships]
  );

  const firstActiveGroupId = useMemo(() => {
    const first = activeGroupMemberships[0];
    return first ? Number(getGroupIdFromMembership(first)) : null;
  }, [activeGroupMemberships]);

  const firstActiveGroupName = useMemo(() => {
    const first = activeGroupMemberships[0];
    return first ? getGroupNameFromMembership(first) : "Community group";
  }, [activeGroupMemberships]);

  const memberNumber = useMemo(() => {
    const raw = user?.member_number;
    if (raw === undefined || raw === null || raw === "") return "";
    return String(raw);
  }, [user]);

  const merryDueNow = useMemo(
    () => toNumber(merrySummary?.total_required_now),
    [merrySummary]
  );

  const merryWalletBalance = useMemo(() => {
    const raw =
      (merrySummary as any)?.wallet_balance ??
      (merrySummary as any)?.total_wallet_balance ??
      0;
    return toNumber(raw);
  }, [merrySummary]);

  const hasActiveMerry = useMemo(() => {
    const items = merrySummary?.items ?? [];
    return items.length > 0;
  }, [merrySummary]);

  const merryAmountValue = useMemo(() => {
    if (merryWalletBalance > 0 && merryDueNow <= 0) {
      return formatKes(merryWalletBalance);
    }

    if (merryDueNow > 0) {
      return fmtKES(merrySummary?.total_required_now);
    }

    return "Active";
  }, [merryWalletBalance, merryDueNow, merrySummary]);

  const merrySubtitle = useMemo(() => {
    if (merryDueNow > 0) return "Contribution waiting";
    if (merryWalletBalance > 0) return "Positive merry wallet";
    return "Your merry space is active";
  }, [merryDueNow, merryWalletBalance]);

  const hasActiveGroups = activeGroupMemberships.length > 0;

  const groupSummaryValue = useMemo(() => {
    if (!hasActiveGroups) return "—";
    return `${activeGroupMemberships.length}`;
  }, [activeGroupMemberships.length, hasActiveGroups]);

  const groupSummarySubtitle = useMemo(() => {
    if (!hasActiveGroups) return "";
    if (activeGroupMemberships.length === 1) {
      return `${firstActiveGroupName}`;
    }
    return `${activeGroupMemberships.length} active group spaces`;
  }, [activeGroupMemberships.length, firstActiveGroupName, hasActiveGroups]);

  const communityCount = useMemo(() => {
    const merryCount = hasActiveMerry ? 1 : 0;
    const savingsCount = savingsAccounts.length > 0 ? 1 : 0;
    const groupCount = hasActiveGroups ? 1 : 0;
    const supportCount = activeLoan ? 1 : 0;
    return merryCount + savingsCount + groupCount + supportCount;
  }, [hasActiveMerry, savingsAccounts.length, hasActiveGroups, activeLoan]);

  const noticeItems = useMemo<NoticeItem[]>(() => {
    const items: NoticeItem[] = [];

    if (!kycComplete) {
      items.push({
        id: "kyc-needed",
        title: "Complete your profile",
        subtitle: "Finish verification to unlock full access.",
        icon: "shield-checkmark-outline",
        tone: "info",
        actionLabel: "Open",
        onPress: () => router.push(ROUTES.tabs.profile as any),
      });
    }

    if (hasActiveMerry && merryDueNow > 0) {
      items.push({
        id: "merry-due",
        title: "Merry contribution waiting",
        subtitle: `${fmtKES(merrySummary?.total_required_now)} is ready for contribution.`,
        icon: "repeat-outline",
        tone: "success",
        actionLabel: "Contribute",
        onPress: openFirstMerryFlow,
      });
    }

    if (hasActiveGroups) {
      items.push({
        id: "group-space",
        title:
          activeGroupMemberships.length === 1
            ? "Group contribution space"
            : `${activeGroupMemberships.length} group spaces active`,
        subtitle:
          activeGroupMemberships.length === 1
            ? `Open ${firstActiveGroupName} and continue contributing.`
            : "Open your groups and continue participating.",
        icon: "people-outline",
        tone: "primary",
        actionLabel: "Open",
        onPress: () => router.push(ROUTES.tabs.groupsMemberships as any),
      });
    }

    if (guaranteeRequests.length > 0) {
      items.push({
        id: "guarantee-requests",
        title:
          guaranteeRequests.length === 1
            ? "1 support request waiting"
            : `${guaranteeRequests.length} support requests waiting`,
        subtitle: "Review and respond.",
        icon: "people-outline",
        tone: "primary",
        actionLabel: "View",
        onPress: () => router.push("/(tabs)/loans/guarantee-requests" as any),
      });
    }

    const approvedLoan = loans.find(
      (l) => String(l.status || "").toUpperCase() === "APPROVED"
    );

    if (approvedLoan) {
      items.push({
        id: "support-ready",
        title: "Support ready",
        subtitle: "Your support request is ready to view.",
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

    return items.slice(0, 4);
  }, [
    activeGroupMemberships.length,
    firstActiveGroupName,
    guaranteeRequests.length,
    hasActiveGroups,
    hasActiveMerry,
    kycComplete,
    loans,
    merryDueNow,
    merrySummary,
    openFirstMerryFlow,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.page}>
          <EmptyState
            title="Not signed in"
            subtitle="Please log in to continue."
            actionLabel="Go to Login"
            onAction={() => router.replace(ROUTES.auth.login as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary, COLORS.secondary]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
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
              <Text style={styles.brandSubtitle}>
                Community self-help home
              </Text>
            </View>
          </View>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={onRefresh}
              style={styles.iconBtn}
            >
              <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={handleLogout}
              disabled={loggingOut}
              style={styles.iconBtn}
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                color={loggingOut ? COLORS.textMuted : COLORS.error}
              />
            </TouchableOpacity>
          </View>
        </View>

        <Card style={styles.heroCard} variant="elevated">
          <View style={styles.heroDecorOne} />
          <View style={styles.heroDecorTwo} />
          <View style={styles.heroDecorThree} />

          <View style={styles.heroHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTag}>
                {isAdmin ? "COMMUNITY LEAD" : "COMMUNITY MEMBER"}
              </Text>
              <Text style={styles.heroTitle}>
                {greetingText}, {memberName}
              </Text>
              <Text style={styles.heroCaption}>
                Save together, support each other, and keep your community active.
              </Text>
            </View>
          </View>

          <View style={styles.heroIdentityRow}>
            <View style={styles.heroMetaPill}>
              <Ionicons name="ellipse" size={8} color="#8CF0C7" />
              <Text style={styles.heroMetaText}>
                {formatUserStatus(user?.status)}
              </Text>
            </View>

            {memberNumber ? (
              <View style={styles.heroMetaPill}>
                <Ionicons
                  name="card-outline"
                  size={14}
                  color="rgba(255,255,255,0.92)"
                />
                <Text style={styles.heroMetaText}>#{memberNumber}</Text>
              </View>
            ) : null}

            <View style={styles.heroMetaPill}>
              <Ionicons
                name="people-outline"
                size={14}
                color="rgba(255,255,255,0.92)"
              />
              <Text style={styles.heroMetaText}>
                {communityCount} active area{communityCount === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
        </Card>

        <Section title="Overview">
          <View
            style={[styles.summaryGrid, isWideScreen && styles.summaryGridWide]}
          >
            {hasActiveMerry ? (
              <View
                style={[styles.summaryItem, isWideScreen && styles.summaryItemWide]}
              >
                <SummaryCard
                  title="Merry"
                  value={merryAmountValue}
                  subtitle={merrySubtitle}
                  icon="repeat-outline"
                  tone="success"
                  onPress={() => router.push(ROUTES.tabs.merry as any)}
                />
              </View>
            ) : null}

            <View
              style={[styles.summaryItem, isWideScreen && styles.summaryItemWide]}
            >
              <SummaryCard
                title="Savings"
                value={heroSavings}
                subtitle={
                  savingsAccounts.length > 0
                    ? "Your available savings"
                    : "Start your savings journey"
                }
                icon="wallet-outline"
                tone="primary"
                onPress={() => router.push(ROUTES.tabs.savings as any)}
              />
            </View>

            {hasActiveGroups ? (
              <View
                style={[styles.summaryItem, isWideScreen && styles.summaryItemWide]}
              >
                <SummaryCard
                  title="Groups"
                  value={groupSummaryValue}
                  subtitle={groupSummarySubtitle}
                  icon="people-outline"
                  tone="info"
                  onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
                />
              </View>
            ) : null}

            {activeLoan ? (
              <View
                style={[styles.summaryItem, isWideScreen && styles.summaryItemWide]}
              >
                <SummaryCard
                  title="Support"
                  value={formatKes(totalOutstandingLoans)}
                  subtitle="Current active support"
                  icon="heart-outline"
                  tone="warning"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/loans/[id]" as any,
                      params: { id: String(activeLoan.id) },
                    })
                  }
                />
              </View>
            ) : null}
          </View>
        </Section>

        <Section title="Continue">
          <View style={[styles.spaceGrid, isWideScreen && styles.spaceGridWide]}>
            {hasActiveMerry ? (
              <View style={[styles.spaceItem, isWideScreen && styles.spaceItemWide]}>
                <SpaceCard
                  title="Merry space"
                  subtitle={
                    merryDueNow > 0
                      ? `${fmtKES(merrySummary?.total_required_now)} is ready for contribution.`
                      : "Open your merry space and keep participating."
                  }
                  icon="repeat-outline"
                  tone="success"
                  primaryLabel="Contribute"
                  secondaryLabel="Open"
                  onPrimary={openFirstMerryFlow}
                  onSecondary={() => router.push(ROUTES.tabs.merry as any)}
                />
              </View>
            ) : null}

            <View style={[styles.spaceItem, isWideScreen && styles.spaceItemWide]}>
              <SpaceCard
                title="Savings space"
                subtitle={
                  savingsAccounts.length > 0
                    ? "Keep growing your savings balance."
                    : "Start setting something aside for your future."
                }
                icon="wallet-outline"
                tone="primary"
                primaryLabel="Save"
                secondaryLabel="Open"
                onPrimary={() => openSavingsFlow(primarySavingsAccount)}
                onSecondary={() => router.push(ROUTES.tabs.savings as any)}
              />
            </View>

            {hasActiveGroups ? (
              <View style={[styles.spaceItem, isWideScreen && styles.spaceItemWide]}>
                <SpaceCard
                  title="Group space"
                  subtitle={
                    activeGroupMemberships.length === 1
                      ? `Continue with ${firstActiveGroupName}.`
                      : "Open your group spaces and continue participating."
                  }
                  icon="people-outline"
                  tone="info"
                  primaryLabel="Contribute"
                  secondaryLabel="Open"
                  onPrimary={() => openGroupContributionFlow(firstActiveGroupId)}
                  onSecondary={() => router.push(ROUTES.tabs.groupsMemberships as any)}
                />
              </View>
            ) : null}

            {activeLoan ? (
              <View style={[styles.spaceItem, isWideScreen && styles.spaceItemWide]}>
                <SpaceCard
                  title="Support space"
                  subtitle="View your active support details or make a contribution."
                  icon="heart-outline"
                  tone="warning"
                  primaryLabel="Add"
                  secondaryLabel="View"
                  onPrimary={() => {
                    if (!loanAllowed) {
                      router.push(ROUTES.tabs.profile as any);
                      return;
                    }
                    openLoanPaymentFlow(activeLoan);
                  }}
                  onSecondary={() =>
                    router.push({
                      pathname: "/(tabs)/loans/[id]" as any,
                      params: { id: String(activeLoan.id) },
                    })
                  }
                />
              </View>
            ) : null}
          </View>
        </Section>

        <Section title="Updates">
          <View style={styles.noticeWrap}>
            {noticeItems.length > 0 ? (
              noticeItems.map((item) => <NoticeCard key={item.id} item={item} />)
            ) : (
              <Card style={styles.noticeCard} variant="default">
                <View
                  style={[
                    styles.noticeStripe,
                    { backgroundColor: COLORS.primary },
                  ]}
                />
                <View
                  style={[
                    styles.noticeIcon,
                    { backgroundColor: COLORS.primaryLight },
                  ]}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.noticeTitle}>No new updates</Text>
                  <Text style={styles.noticeSubtitle}>
                    Your latest account updates will appear here.
                  </Text>
                </View>
              </Card>
            )}
          </View>
        </Section>

        <Section title="Account">
          <View style={styles.smallLinksWrap}>
            <SmallLink
              title="Notifications"
              icon="notifications-outline"
              onPress={() => router.push("/(tabs)/notifications" as any)}
            />

            <SmallLink
              title="Profile"
              icon="person-outline"
              onPress={() => router.push(ROUTES.tabs.profile as any)}
            />

            {isAdmin ? (
              <SmallLink
                title="Admin tools"
                icon="shield-checkmark-outline"
                onPress={() => router.push(ROUTES.tabs.groups as any)}
              />
            ) : null}

            <SmallLink
              title={loggingOut ? "Logging out..." : "Log out"}
              icon="log-out-outline"
              onPress={handleLogout}
              danger
            />
          </View>
        </Section>

        <View style={{ height: 12 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: SPACING.md,
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
    paddingTop: SPACING.xs,
  },

  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
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

  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(14, 94, 111, 0.10)",
    ...SHADOW.soft,
  },

  heroCard: {
    ...P.dashboardHero,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    minHeight: 196,
  },

  heroDecorOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    top: -58,
    right: -30,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroDecorTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    bottom: -24,
    left: -8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  heroDecorThree: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 999,
    bottom: -120,
    right: -20,
    backgroundColor: "rgba(22, 163, 74, 0.16)",
  },

  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  heroTag: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  heroTitle: {
    ...TYPE.title,
    color: COLORS.white,
    marginTop: 8,
    fontWeight: "900",
  },

  heroCaption: {
    ...TYPE.subtext,
    color: "rgba(255,255,255,0.88)",
    marginTop: 6,
    fontWeight: "700",
    lineHeight: 20,
    maxWidth: "96%",
  },

  heroIdentityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroMetaText: {
    ...TYPE.caption,
    color: COLORS.white,
    fontWeight: "800",
  },

  summaryGrid: {
    gap: SPACING.md,
  },

  summaryGridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  summaryItem: {
    width: "100%",
  },

  summaryItemWide: {
    flex: 1,
    minWidth: 220,
  },

  summaryCard: {
    minHeight: 154,
    borderWidth: 1,
    borderRadius: 24,
    padding: SPACING.md,
    justifyContent: "space-between",
    overflow: "hidden",
    ...SHADOW.soft,
  },

  summaryCardGlow: {
    position: "absolute",
    right: -24,
    top: -24,
    width: 110,
    height: 110,
    borderRadius: 999,
  },

  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  summaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },

  summaryTitle: {
    ...TYPE.caption,
    color: COLORS.textMuted,
    fontWeight: "800",
    marginTop: SPACING.md,
  },

  summaryValueWrap: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginTop: 8,
  },

  summaryValue: {
    ...TYPE.title,
    fontWeight: "900",
  },

  summarySubtitle: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },

  spaceGrid: {
    gap: SPACING.md,
  },

  spaceGridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  spaceItem: {
    width: "100%",
  },

  spaceItemWide: {
    flex: 1,
    minWidth: 280,
  },

  spaceCard: {
    padding: SPACING.md,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: COLORS.white,
    minHeight: 170,
    overflow: "hidden",
    ...SHADOW.soft,
  },

  spaceCardGlow: {
    position: "absolute",
    top: -28,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
  },

  spaceHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  spaceIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  spaceTitle: {
    ...TYPE.title,
    color: COLORS.text,
    fontWeight: "900",
  },

  spaceSubtitle: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  spaceActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
  },

  noticeWrap: {
    gap: SPACING.sm,
  },

  noticeCard: {
    padding: SPACING.md,
    paddingLeft: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    overflow: "hidden",
    ...SHADOW.soft,
  },

  noticeStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
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
    minHeight: 54,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(14, 94, 111, 0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.soft,
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
  },

  smallLinkText: {
    ...TYPE.bodyStrong,
    color: COLORS.text,
    fontWeight: "700",
  },
});