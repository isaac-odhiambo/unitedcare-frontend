// app/(tabs)/dashboard/index.tsx

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
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

import { ROUTES } from "@/constants/routes";
import { SPACING } from "@/constants/theme";
import {
  getGroupIdFromMembership,
  getGroupNameFromMembership,
  getMyGroupSavingsSummary,
  GroupMembership,
  listGroupMemberships,
} from "@/services/groups";
import {
  buildLoanRepaymentNarration,
  buildLoanRepaymentReference,
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
  MeResponse,
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

type SpaceTone = "savings" | "merry" | "groups" | "support";

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
    const totalBalance = toNumber(account.balance ?? 0);
    if (totalBalance > 0) {
      return sum + totalBalance;
    }

    const available = toNumber(account.available_balance ?? 0);
    const reserved = toNumber((account as any)?.reserved_amount ?? 0);
    return sum + available + reserved;
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

function getGroupMeta(membership: any) {
  const group = membership?.group && typeof membership.group === "object" ? membership.group : null;
  const contributionAmount = toNumber(
    membership?.contribution_amount ??
      group?.contribution_amount ??
      membership?.monthly_contribution ??
      0
  );
  const requiresContributions = Boolean(
    membership?.requires_contributions ??
      group?.requires_contributions ??
      contributionAmount > 0
  );
  const paymentCode = String(
    membership?.payment_code ?? group?.payment_code ?? ""
  ).trim();

  return {
    contributionAmount,
    requiresContributions,
    paymentCode,
  };
}

function getGroupSummaryRow(rows: any[], groupId?: number | null) {
  if (!Array.isArray(rows) || !groupId) return null;
  return (
    rows.find((item: any) => {
      const id = item?.group?.id ?? item?.group_id ?? item?.group;
      return Number(id) === Number(groupId);
    }) || null
  );
}

function getGroupSummaryValue(summary: any, fallbackAmount: number) {
  const contributed = toNumber(summary?.my_share?.total_contributed ?? 0);
  if (contributed > 0) return formatKes(contributed);
  if (fallbackAmount > 0) return formatKes(fallbackAmount);
  return "Active";
}

function getGroupSummarySubtitle(summary: any, fallbackAmount: number) {
  const reserved = toNumber(summary?.my_share?.reserved_share ?? 0);
  const available = toNumber(summary?.my_share?.available_share ?? 0);

  if (fallbackAmount > 0) return `Contribution ${formatKes(fallbackAmount)}`;
  if (reserved > 0) return `Reserved ${formatKes(reserved)}`;
  if (available > 0) return `Available ${formatKes(available)}`;
  return "Active contribution space";
}

function getSpaceTonePalette(tone: SpaceTone) {
  const map = {
    savings: {
      card: "rgba(29, 196, 182, 0.22)",
      border: "rgba(129, 244, 231, 0.15)",
      iconBg: "rgba(220, 255, 250, 0.75)",
      icon: "#0B6A80",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
    merry: {
      card: "rgba(98, 192, 98, 0.23)",
      border: "rgba(194, 255, 188, 0.16)",
      iconBg: "rgba(236, 255, 235, 0.76)",
      icon: "#379B4A",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
    groups: {
      card: "rgba(49, 180, 217, 0.22)",
      border: "rgba(189, 244, 255, 0.15)",
      iconBg: "rgba(236, 251, 255, 0.76)",
      icon: "#0A6E8A",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
    support: {
      card: "rgba(52, 198, 191, 0.22)",
      border: "rgba(195, 255, 250, 0.16)",
      iconBg: "rgba(236, 255, 252, 0.76)",
      icon: "#148C84",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
  };

  return map[tone];
}

function getOverviewTonePalette(tone: NoticeItem["tone"]) {
  const map = {
    primary: {
      iconBg: "rgba(12,106,128,0.12)",
      icon: "#0C6A80",
      buttonBg: "#197D71",
      buttonBorder: "#197D71",
      soft: "rgba(12,106,128,0.05)",
    },
    success: {
      iconBg: "rgba(65,163,87,0.12)",
      icon: "#379B4A",
      buttonBg: "#197D71",
      buttonBorder: "#197D71",
      soft: "rgba(65,163,87,0.05)",
    },
    warning: {
      iconBg: "rgba(24,140,132,0.12)",
      icon: "#148C84",
      buttonBg: "#FFFFFF",
      buttonBorder: "rgba(12,106,128,0.20)",
      soft: "rgba(20,140,132,0.05)",
    },
    info: {
      iconBg: "rgba(12,106,128,0.12)",
      icon: "#0C6A80",
      buttonBg: "#FFFFFF",
      buttonBorder: "rgba(12,106,128,0.20)",
      soft: "rgba(12,106,128,0.05)",
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

function SocialSpaceCard({
  title,
  membersLabel,
  valueLabel,
  amountLabel,
  icon,
  tone,
  onPress,
  compact = false,
}: {
  title: string;
  membersLabel: string;
  valueLabel: string;
  amountLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: SpaceTone;
  onPress: () => void;
  compact?: boolean;
}) {
  const palette = getSpaceTonePalette(tone);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.spaceCard,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.spaceGlowTop} />
      <View style={styles.spaceGlowBottom} />

      <View style={styles.spaceHeader}>
        <View style={[styles.spaceIconWrap, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={icon} size={22} color={palette.icon} />
        </View>

        <View style={styles.spaceHeaderText}>
          <Text numberOfLines={compact ? 2 : 1} style={[styles.spaceTitle, compact && styles.spaceTitleCompact]}>
            {title}
          </Text>
          <Text numberOfLines={compact ? 2 : 1} style={[styles.spaceMembers, compact && styles.spaceMembersCompact]}>
            {membersLabel}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.spaceFooterRow,
          compact && styles.spaceFooterRowCompact,
          { backgroundColor: palette.amountBg },
        ]}
      >
        <Text
          numberOfLines={compact ? 2 : 1}
          style={[styles.spaceMetricLabel, compact && styles.spaceMetricLabelCompact]}
        >
          {valueLabel}
        </Text>
        <Text
          numberOfLines={compact ? 2 : 1}
          style={[styles.spaceMetricAmount, compact && styles.spaceMetricAmountCompact]}
        >
          {amountLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function OverviewCard({
  title,
  subtitle,
  value,
  icon,
  tone,
  primaryLabel,
  onPress,
  actionIcon,
}: {
  title: string;
  subtitle: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: NoticeItem["tone"];
  primaryLabel: string;
  onPress: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const palette = getOverviewTonePalette(tone);

  return (
    <View style={[styles.overviewCard, { backgroundColor: "#FFFFFF" }]}>
      <View
        style={[
          styles.overviewGlow,
          {
            backgroundColor: palette.soft,
          },
        ]}
      />

      <View style={styles.overviewHeader}>
        <View style={[styles.overviewIconWrap, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={icon} size={22} color={palette.icon} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.overviewTitle}>{title}</Text>
          <Text style={styles.overviewSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <Text style={styles.overviewValue}>{value}</Text>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={[
          styles.overviewActionBtn,
          {
            backgroundColor: palette.buttonBg,
            borderColor: palette.buttonBorder,
          },
        ]}
      >
        <Ionicons
          name={
            actionIcon ||
            (primaryLabel.toLowerCase().includes("create")
              ? "add"
              : primaryLabel.toLowerCase().includes("pay")
              ? "card-outline"
              : primaryLabel.toLowerCase().includes("save")
              ? "wallet-outline"
              : primaryLabel.toLowerCase().includes("contribute")
              ? "arrow-forward-circle-outline"
              : "compass-outline")
          }
          size={18}
          color={palette.buttonBg === "#FFFFFF" ? "#0C6A80" : "#FFFFFF"}
        />
        <Text
          style={[
            styles.overviewActionText,
            {
              color: palette.buttonBg === "#FFFFFF" ? "#0C6A80" : "#FFFFFF",
            },
          ]}
        >
          {primaryLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function NoticeRow({ item }: { item: NoticeItem }) {
  const palette = getOverviewTonePalette(item.tone);

  return (
    <TouchableOpacity
      activeOpacity={item.onPress ? 0.9 : 1}
      onPress={item.onPress}
      disabled={!item.onPress}
      style={styles.noticeRow}
    >
      <View style={[styles.noticeRowIcon, { backgroundColor: palette.iconBg }]}>
        <Ionicons name={item.icon} size={18} color={palette.icon} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.noticeRowTitle}>{item.title}</Text>
        {!!item.subtitle && <Text style={styles.noticeRowSubtitle}>{item.subtitle}</Text>}
      </View>

      {!!item.actionLabel && (
        <Text style={[styles.noticeRowAction, { color: palette.icon }]}>
          {item.actionLabel}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function QuickLink({
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
        styles.quickLink,
        danger && styles.quickLinkDanger,
      ]}
    >
      <View style={styles.quickLinkLeft}>
        <View
          style={[
            styles.quickLinkIcon,
            danger ? styles.quickLinkIconDanger : null,
          ]}
        >
          <Ionicons
            name={icon}
            size={16}
            color={danger ? "#B91C1C" : "#0C6A80"}
          />
        </View>
        <Text style={[styles.quickLinkText, danger && styles.quickLinkTextDanger]}>
          {title}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={danger ? "#B91C1C" : "rgba(255,255,255,0.70)"}
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
  const [hasBootstrapped, setHasBootstrapped] = useState(false);

  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [heroSavings, setHeroSavings] = useState("—");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [guaranteeRequests, setGuaranteeRequests] = useState<LoanGuarantor[]>([]);
  const [merrySummary, setMerrySummary] =
    useState<MyAllMerryDueSummaryResponse | null>(null);
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([]);
  const [groupSavingsSummaries, setGroupSavingsSummaries] = useState<any[]>([]);

  const isAdmin = isAdminUser(user as any);
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

    const borrowerUserId =
      toNumber((loan as any)?.borrower_user_id) ||
      toNumber((loan as any)?.borrower?.id) ||
      toNumber((loan as any)?.user_id) ||
      toNumber((loan as any)?.user?.id) ||
      toNumber((loan as any)?.borrower);

    if (!borrowerUserId) {
      router.push({
        pathname: "/(tabs)/loans/[id]" as any,
        params: { id: String(loan.id) },
      });
      return;
    }

    const outstandingAmount = toNumber((loan as any)?.outstanding_balance);
    const suggestedAmount =
      toNumber((loan as any)?.amount_due) ||
      toNumber((loan as any)?.installment_amount) ||
      toNumber((loan as any)?.weekly_installment) ||
      outstandingAmount;

    router.replace({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        title: "Support Repayment",
        source: "loan",
        purpose: "LOAN_REPAYMENT",
        loanId: String(loan.id),
        borrowerUserId: String(borrowerUserId),
        reference: buildLoanRepaymentReference(borrowerUserId),
        narration: buildLoanRepaymentNarration({
          borrowerUserId,
          loanId: toNumber((loan as any)?.id),
        }),
        amount: suggestedAmount > 0 ? String(suggestedAmount) : "",
        editableAmount: "true",
        returnTo: ROUTES.dynamic.loanDetail(toNumber((loan as any)?.id)),
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

  const openDirectGroupPaymentFlow = useCallback((groupItem?: any | null) => {
    const groupId = Number(groupItem?.id ?? 0);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      router.push(ROUTES.tabs.groups as any);
      return;
    }

    const groupName = String(groupItem?.name || "Community space").trim();
    const narration = groupName ? `${groupName} contribution` : "Community contribution";
    const amount = toNumber(groupItem?.contributionAmount ?? 0);

    router.replace({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        title: "Community Contribution",
        purpose: "GROUP_CONTRIBUTION",
        reference: `GROUP${groupId}`,
        groupCode: String(groupItem?.paymentCode || ""),
        narration,
        amount: amount > 0 ? String(amount) : "",
        groupId: String(groupId),
        returnTo: ROUTES.dynamic.groupDetail(groupId),
      },
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
        groupSavingsSummaryResult,
      ] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listMySavingsAccounts(),
        getMyLoans(),
        getMyAllMerryDueSummary(),
        getMyGuaranteeRequests(),
        listGroupMemberships(),
        getMyGroupSavingsSummary(),
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
        membershipsResult.status === "fulfilled" &&
          Array.isArray(membershipsResult.value)
          ? membershipsResult.value
          : []
      );
      setGroupSavingsSummaries(
        groupSavingsSummaryResult.status === "fulfilled" &&
          Array.isArray(groupSavingsSummaryResult.value)
          ? groupSavingsSummaryResult.value
          : []
      );
    } finally {
      setLoading(false);
      setHasBootstrapped(true);
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

  const activeContributionGroups = useMemo(() => {
    return activeGroupMemberships
      .map((membership: any) => {
        const id = Number(getGroupIdFromMembership(membership));
        const name = getGroupNameFromMembership(membership) || "Community group";
        const meta = getGroupMeta(membership);
        const summary = getGroupSummaryRow(groupSavingsSummaries, id);

        return {
          id,
          name,
          contributionAmount: meta.contributionAmount,
          paymentCode: meta.paymentCode,
          requiresContributions: meta.requiresContributions,
          summaryValue: getGroupSummaryValue(summary, meta.contributionAmount),
          subtitle: getGroupSummarySubtitle(summary, meta.contributionAmount),
        };
      })
      .filter((item) => item.id > 0 && item.requiresContributions);
  }, [activeGroupMemberships, groupSavingsSummaries]);

  const firstActiveContributionGroup = useMemo(() => {
    return activeContributionGroups[0] ?? null;
  }, [activeContributionGroups]);

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

    
    if (hasActiveMerry && merryDueNow > 0) {
      items.push({
        id: "merry-due",
        title: "Merry contribution waiting",
        subtitle: `${fmtKES(
          merrySummary?.total_required_now
        )} is ready for contribution.`,
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
    
    loans,
    merryDueNow,
    merrySummary,
    openFirstMerryFlow,
  ]);

  const spaceCards = useMemo(() => {
    const cards: Array<{
      key: string;
      title: string;
      membersLabel: string;
      valueLabel: string;
      amountLabel: string;
      icon: keyof typeof Ionicons.glyphMap;
      tone: SpaceTone;
      onPress: () => void;
    }> = [];

    cards.push({
      key: "savings",
      title: "Contribution Club",
      membersLabel: savingsAccounts.length > 0 ? "1 active wallet" : "Start saving",
      valueLabel: "Total Contribution",
      amountLabel: heroSavings,
      icon: "wallet-outline",
      tone: "savings",
      onPress: () => router.push(ROUTES.tabs.savings as any),
    });

    if (hasActiveMerry) {
      cards.push({
        key: "merry",
        title: "Merry Circle",
        membersLabel:
          merrySummary?.items?.length && merrySummary.items.length > 1
            ? `${merrySummary.items.length} merry spaces`
            : "Active member space",
        valueLabel: merryDueNow > 0 ? "Due now" : "Rotating savings",
        amountLabel: merryAmountValue,
        icon: "people-outline",
        tone: "merry",
        onPress: () => router.push(ROUTES.tabs.merry as any),
      });
    }

    if (hasActiveGroups) {
      cards.push({
        key: "groups",
        title: firstActiveGroupName || "Community Group",
        membersLabel:
          activeGroupMemberships.length === 1
            ? "1 active group"
            : `${activeGroupMemberships.length} active groups`,
        valueLabel: "Community spaces",
        amountLabel:
          activeGroupMemberships.length === 1
            ? "Open"
            : `${activeGroupMemberships.length} spaces`,
        icon: "people-outline",
        tone: "groups",
        onPress: () => router.push(ROUTES.tabs.groupsMemberships as any),
      });
    }

    if (activeLoan) {
      cards.push({
        key: "support",
        title: "Support Circle",
        membersLabel: "Active support",
        valueLabel: "Outstanding",
        amountLabel: formatKes(totalOutstandingLoans),
        icon: "heart-outline",
        tone: "support",
        onPress: () =>
          router.push({
            pathname: "/(tabs)/loans/[id]" as any,
            params: { id: String(activeLoan.id) },
          }),
      });
    }

    return cards.slice(0, 4);
  }, [
    savingsAccounts.length,
    heroSavings,
    hasActiveMerry,
    merrySummary,
    merryDueNow,
    merryAmountValue,
    hasActiveGroups,
    activeGroupMemberships.length,
    firstActiveGroupName,
    activeLoan,
    totalOutstandingLoans,
    openGroupContributionFlow,
    firstActiveGroupId,
    openLoanPaymentFlow,
  ]);

  if (!hasBootstrapped) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.backgroundBlobTop} />
          <View style={styles.backgroundBlobMiddle} />
          <View style={styles.backgroundBlobBottom} />
          <View style={styles.backgroundGlowOne} />
          <View style={styles.backgroundGlowTwo} />

          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.brandWordmark}>
                  UNITED <Text style={styles.brandWordmarkGreen}>CARE</Text>
                </Text>
                <Text style={styles.brandSub}>Community self-help home</Text>
              </View>
            </View>

            <View style={styles.topBarActions}>
              <View style={[styles.iconBtn, styles.bootIconBtn]} />
              <View style={[styles.iconBtn, styles.bootIconBtn]} />
            </View>
          </View>

          <View style={styles.bootHeroCard}>
            <Text style={styles.bootEyebrow}>Preparing your dashboard</Text>
            <Text style={styles.bootTitle}>Welcome back</Text>
            <Text style={styles.bootSubtitle}>
              Loading your spaces, savings, merry, groups and support summary.
            </Text>

            <View style={styles.bootAmountPill}>
              <Text style={styles.bootAmountText}>Please wait a moment</Text>
            </View>
          </View>

          <View style={styles.bootGrid}>
            {[0, 1, 2, 3].map((item) => (
              <View key={item} style={styles.bootCard}>
                <View style={styles.bootCardTop}>
                  <View style={styles.bootCircle} />
                  <View style={{ flex: 1 }}>
                    <View style={[styles.bootLine, styles.bootLineShort]} />
                    <View style={[styles.bootLine, styles.bootLineMedium]} />
                  </View>
                </View>
                <View style={styles.bootCardFooter}>
                  <View style={[styles.bootLine, styles.bootLineTiny]} />
                  <View style={[styles.bootLine, styles.bootLineShort]} />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.bootNoticeCard}>
            <View style={styles.bootNoticeRow}>
              <View style={styles.bootNoticeIcon} />
              <View style={{ flex: 1 }}>
                <View style={[styles.bootLine, styles.bootLineMedium]} />
                <View style={[styles.bootLine, styles.bootLineLong]} />
              </View>
            </View>

            <View style={styles.bootNoticeRow}>
              <View style={styles.bootNoticeIcon} />
              <View style={{ flex: 1 }}>
                <View style={[styles.bootLine, styles.bootLineShort]} />
                <View style={[styles.bootLine, styles.bootLineMedium]} />
              </View>
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Not signed in</Text>
          <Text style={styles.emptySubtitle}>Please log in to continue.</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.replace(ROUTES.auth.login as any)}
          >
            <Text style={styles.emptyButtonText}>Go to Login</Text>
          </TouchableOpacity>
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
            tintColor="#8CF0C7"
            colors={["#8CF0C7", "#0CC0B7"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={{ flex: 1 }}>
              <Text style={styles.brandWordmark}>
                UNITED <Text style={styles.brandWordmarkGreen}>CARE</Text>
              </Text>
              <Text style={styles.brandSub}>Community self-help home</Text>
            </View>
          </View>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={onRefresh}
              style={styles.iconBtn}
            >
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
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
                color={loggingOut ? "rgba(255,255,255,0.55)" : "#FFFFFF"}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroOrbThree} />

          <Text style={styles.heroTag}>
            {isAdmin ? "COMMUNITY LEAD" : "COMMUNITY MEMBER"}
          </Text>

          <Text style={styles.heroTitle}>
            {greetingText}, {memberName}
          </Text>

          <Text style={styles.heroCaption}>
            Save together, support each other, and keep your community active.
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroPill}>
              <Ionicons name="ellipse" size={8} color="#DFFFE8" />
              <Text style={styles.heroPillText}>{formatUserStatus(user?.status)}</Text>
            </View>

            {memberNumber ? (
              <View style={styles.heroPill}>
                <Ionicons name="card-outline" size={14} color="#FFFFFF" />
                <Text style={styles.heroPillText}>#{memberNumber}</Text>
              </View>
            ) : null}

            <View style={styles.heroPill}>
              <Ionicons name="people-outline" size={15} color="#FFFFFF" />
              <Text style={styles.heroPillText}>
                {communityCount} active area{communityCount === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your spaces</Text>
        <View style={[styles.spacesGrid, isWideScreen && styles.spacesGridWide]}>
          {spaceCards.map(({ key, ...card }) => (
            <View
              key={key}
              style={[styles.spaceItem, isWideScreen && styles.spaceItemWide]}
            >
              <SocialSpaceCard {...card} compact={!isWideScreen && width < 390} />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Continue with your active spaces</Text>
        <View style={[styles.overviewGrid, isWideScreen && styles.overviewGridWide]}>
          <View style={[styles.overviewItem, isWideScreen && styles.overviewItemWide]}>
            <OverviewCard
              title="Rescue Plan"
              subtitle={
                savingsAccounts.length > 0
                  ? "Your total contributions"
                  : "Start your savings journey"
              }
              value={heroSavings}
              icon="wallet-outline"
              tone="primary"
              primaryLabel={savingsAccounts.length > 0 ? "Save now" : "Create space"}
              onPress={() => openSavingsFlow(primarySavingsAccount)}
            />
          </View>

          <View style={[styles.overviewItem, isWideScreen && styles.overviewItemWide]}>
            <OverviewCard
              title={
                firstActiveContributionGroup?.name ||
                (hasActiveGroups ? firstActiveGroupName : "Community spaces")
              }
              subtitle={
                firstActiveContributionGroup?.subtitle ||
                (hasActiveGroups
                  ? "Open your active community space"
                  : "Find and join community spaces")
              }
              value={
                firstActiveContributionGroup?.summaryValue ||
                (hasActiveGroups ? `${activeGroupMemberships.length} active` : "Start here")
              }
              icon="people-outline"
              tone="info"
              primaryLabel={hasActiveGroups ? "Contribute" : "Explore spaces"}
              actionIcon={hasActiveGroups ? "arrow-forward-circle-outline" : "compass-outline"}
              onPress={() =>
                firstActiveContributionGroup
                  ? openDirectGroupPaymentFlow(firstActiveContributionGroup)
                  : hasActiveGroups
                  ? openGroupContributionFlow(firstActiveGroupId)
                  : router.push(ROUTES.tabs.groups as any)
              }
            />
          </View>

          {hasActiveMerry ? (
            <View style={[styles.overviewItem, isWideScreen && styles.overviewItemWide]}>
              <OverviewCard
                title="Merry"
                subtitle={merrySubtitle}
                value={merryAmountValue}
                icon="repeat-outline"
                tone="success"
                primaryLabel="Contribute"
                onPress={openFirstMerryFlow}
              />
            </View>
          ) : null}

          {activeLoan ? (
            <View style={[styles.overviewItem, isWideScreen && styles.overviewItemWide]}>
              <OverviewCard
                title="Support"
                subtitle="Continue helping your support space"
                value={formatKes(totalOutstandingLoans)}
                icon="heart-outline"
                tone="warning"
                primaryLabel="Continue support"
                actionIcon="card-outline"
                onPress={() => openLoanPaymentFlow(activeLoan)}
              />
            </View>
          ) : null}
        </View>

        {activeContributionGroups.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Group contribution shortcuts</Text>
            <View style={styles.groupShortcutList}>
              {activeContributionGroups.map((group) => (
                <View key={group.id} style={styles.groupShortcutCard}>
                  <View style={styles.groupShortcutTop}>
                    <View style={styles.groupShortcutIcon}>
                      <Ionicons name="people-outline" size={18} color="#0A6E8A" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.groupShortcutTitle} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <Text style={styles.groupShortcutSubtitle} numberOfLines={2}>
                        {group.subtitle}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.groupShortcutValue}>{group.summaryValue}</Text>

                  <View style={styles.groupShortcutActions}>
                    <TouchableOpacity
                      activeOpacity={0.92}
                      onPress={() => router.push(ROUTES.dynamic.groupDetail(group.id) as any)}
                      style={[styles.groupShortcutBtn, styles.groupShortcutBtnSecondary]}
                    >
                      <Ionicons name="eye-outline" size={16} color="#0C6A80" />
                      <Text style={[styles.groupShortcutBtnText, styles.groupShortcutBtnTextSecondary]}>
                        View
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.92}
                      onPress={() => openDirectGroupPaymentFlow(group)}
                      style={[styles.groupShortcutBtn, styles.groupShortcutBtnPrimary]}
                    >
                      <Ionicons name="card-outline" size={16} color="#FFFFFF" />
                      <Text style={[styles.groupShortcutBtnText, styles.groupShortcutBtnTextPrimary]}>
                        Contribute
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Community updates</Text>
        <View style={styles.noticeWrap}>
          {noticeItems.length > 0 ? (
            noticeItems.map((item) => <NoticeRow key={item.id} item={item} />)
          ) : (
            <View style={styles.noticeEmpty}>
              <View style={styles.noticeRowIcon}>
                <Ionicons name="notifications-outline" size={18} color="#0C6A80" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeRowTitle}>No new updates</Text>
                <Text style={styles.noticeRowSubtitle}>
                  Your latest community updates will appear here.
                </Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Community tools</Text>
        <View style={styles.quickLinksWrap}>
          <QuickLink
            title="Notifications"
            icon="notifications-outline"
            onPress={() => router.push("/(tabs)/notifications" as any)}
          />

          <QuickLink
            title="Contribution activity"
            icon="card-outline"
            onPress={() => router.push(ROUTES.tabs.payments as any)}
          />

          <QuickLink
            title="Profile"
            icon="person-outline"
            onPress={() => router.push(ROUTES.tabs.profile as any)}
          />

          {hasActiveGroups ? (
            <QuickLink
              title="Open group contribution"
              icon="people-outline"
              onPress={() => openGroupContributionFlow(firstActiveGroupId)}
            />
          ) : null}

          {hasActiveMerry ? (
            <QuickLink
              title="Open merry circle"
              icon="repeat-outline"
              onPress={() => router.push(ROUTES.tabs.merry as any)}
            />
          ) : null}

          {activeLoan ? (
            <QuickLink
              title={loanAllowed ? "Add to support" : "Open support"}
              icon="heart-outline"
              onPress={() => {
                if (!loanAllowed) {
                  router.push(ROUTES.tabs.profile as any);
                  return;
                }
                openLoanPaymentFlow(activeLoan);
              }}
            />
          ) : null}

          {isAdmin ? (
            <QuickLink
              title="Admin tools"
              icon="shield-checkmark-outline"
              onPress={() => router.push(ROUTES.tabs.groups as any)}
            />
          ) : null}

          <QuickLink
            title={loggingOut ? "Logging out..." : "Log out"}
            icon="log-out-outline"
            onPress={handleLogout}
            danger
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#062C49",
  },

  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    position: "relative",
  },


  bootIconBtn: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.12)",
  },

  bootHeroCard: {
    marginTop: 14,
    borderRadius: 28,
    padding: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },

  bootEyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  bootTitle: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },

  bootSubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 21,
  },

  bootAmountPill: {
    marginTop: 16,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  bootAmountText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  bootGrid: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  bootCard: {
    width: "48%",
    minHeight: 132,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    justifyContent: "space-between",
  },

  bootCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  bootCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  bootCardFooter: {
    gap: 8,
    marginTop: 18,
  },

  bootLine: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginTop: 8,
  },

  bootLineTiny: {
    width: "34%",
  },

  bootLineShort: {
    width: "52%",
  },

  bootLineMedium: {
    width: "72%",
  },

  bootLineLong: {
    width: "88%",
  },

  bootNoticeCard: {
    marginTop: 18,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    gap: 14,
  },

  bootNoticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  bootNoticeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.16)",
  },


  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#062C49",
  },

  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },

  emptySubtitle: {
    color: "rgba(255,255,255,0.75)",
    marginTop: 8,
    textAlign: "center",
  },

  emptyButton: {
    marginTop: 16,
    backgroundColor: "#0C6A80",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -60,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(19, 195, 178, 0.10)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 260,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(52, 174, 213, 0.08)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: 80,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(112, 208, 115, 0.09)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 100,
    left: 40,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    top: 180,
    right: 60,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  logo: {
    width: 86,
    height: 56,
  },

  brandWordmark: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  brandWordmarkGreen: {
    color: "#74D16C",
  },

  brandSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    marginTop: 2,
  },

  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(12,106,128,0.48)",
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(176, 243, 234, 0.10)",
  },

  heroOrbOne: {
    position: "absolute",
    right: -36,
    top: -20,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(38, 208, 214, 0.18)",
  },

  heroOrbTwo: {
    position: "absolute",
    left: -12,
    bottom: -35,
    width: 145,
    height: 145,
    borderRadius: 999,
    backgroundColor: "rgba(42, 206, 180, 0.16)",
  },

  heroOrbThree: {
    position: "absolute",
    right: 60,
    bottom: -55,
    width: 210,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(102, 212, 109, 0.15)",
  },

  heroTag: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 12,
  },

  heroCaption: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: "95%",
    fontWeight: "600",
  },

  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },

  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 2,
  },

  spacesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
    marginBottom: SPACING.lg,
  },

  spacesGridWide: {
    marginHorizontal: -8,
  },

  spaceItem: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 12,
  },

  spaceItemWide: {
    width: "25%",
    paddingHorizontal: 8,
  },

  spaceCard: {
    minHeight: 150,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    overflow: "hidden",
  },

  spaceGlowTop: {
    position: "absolute",
    top: -18,
    right: -10,
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  spaceGlowBottom: {
    position: "absolute",
    bottom: -24,
    left: -8,
    width: 120,
    height: 70,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  spaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  spaceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  spaceHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  spaceTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  spaceTitleCompact: {
    lineHeight: 20,
    paddingRight: 4,
  },

  spaceMembers: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  spaceMembersCompact: {
    lineHeight: 17,
    paddingRight: 4,
  },

  spaceFooterRow: {
    marginTop: "auto",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  spaceFooterRowCompact: {
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  spaceMetricLabel: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    flex: 1,
    fontWeight: "600",
  },

  spaceMetricLabelCompact: {
    minWidth: "100%",
    lineHeight: 18,
  },

  spaceMetricAmount: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  spaceMetricAmountCompact: {
    lineHeight: 19,
  },

  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
    marginBottom: SPACING.lg,
  },

  overviewGridWide: {
    marginHorizontal: -8,
  },

  overviewItem: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 12,
  },

  overviewItemWide: {
    width: "25%",
    paddingHorizontal: 8,
  },

  overviewCard: {
    minHeight: 148,
    borderRadius: 22,
    padding: 14,
    overflow: "hidden",
  },

  overviewGlow: {
    position: "absolute",
    right: -20,
    bottom: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
  },

  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  overviewIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  overviewTitle: {
    color: "#183042",
    fontSize: 16,
    fontWeight: "900",
  },

  overviewSubtitle: {
    color: "#60717D",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  overviewValue: {
    color: "#173041",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 12,
  },

  overviewActionBtn: {
    marginTop: "auto",
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },

  overviewActionText: {
    fontWeight: "800",
    fontSize: 13,
  },

  noticeWrap: {
    gap: 10,
    marginBottom: SPACING.lg,
  },

  noticeRow: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  noticeEmpty: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  noticeRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12,106,128,0.10)",
  },

  noticeRowTitle: {
    color: "#173041",
    fontSize: 14,
    fontWeight: "800",
  },

  noticeRowSubtitle: {
    color: "#61717D",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    fontWeight: "500",
  },

  noticeRowAction: {
    fontSize: 12,
    fontWeight: "900",
  },

  quickLinksWrap: {
    gap: 10,
  },

  quickLink: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  quickLinkDanger: {
    backgroundColor: "rgba(220,38,38,0.10)",
    borderColor: "rgba(220,38,38,0.12)",
  },

  quickLinkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  quickLinkIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },

  quickLinkIconDanger: {
    backgroundColor: "rgba(255,255,255,0.88)",
  },

  quickLinkText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },


  groupShortcutList: {
    gap: 0,
  },

  groupShortcutCard: {
    position: "relative",
    overflow: "hidden",
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(49, 180, 217, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.14)",
  },

  groupShortcutTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  groupShortcutIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.88)",
  },

  groupShortcutTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  groupShortcutSubtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    lineHeight: 18,
  },

  groupShortcutValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },

  groupShortcutActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },

  groupShortcutBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  groupShortcutBtnPrimary: {
    backgroundColor: "#197D71",
  },

  groupShortcutBtnSecondary: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  groupShortcutBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },

  groupShortcutBtnTextPrimary: {
    color: "#FFFFFF",
  },

  groupShortcutBtnTextSecondary: {
    color: "#0C6A80",
  },

  quickLinkTextDanger: {
    color: "#FFD4D4",
  },
});