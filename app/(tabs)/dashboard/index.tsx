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
import {
  COLORS,
  SHADOW,
  SPACING,
  TYPE
} from "@/constants/theme";
import { getMyLoans } from "@/services/loans";
import { getMyMerries } from "@/services/merry";
import { getMyLedger } from "@/services/payments";
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

type ActionItem = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  go: () => void;
  tone?: "primary" | "success" | "warning" | "info";
  featured?: boolean;
};

type ShortcutItem = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: "primary" | "success" | "warning" | "info";
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
      soft: "#EAF6FF",
      softAlt: "#DFF1FF",
      iconBg: "rgba(14, 94, 111, 0.10)",
      icon: COLORS.primary,
      border: "rgba(14, 94, 111, 0.10)",
      title: COLORS.text,
      subtitle: COLORS.textMuted,
      accent: COLORS.primary,
      badgeBg: "rgba(14, 94, 111, 0.10)",
      badgeText: COLORS.primary,
    },
    success: {
      soft: "#EEF9F3",
      softAlt: "#E4F6EC",
      iconBg: "rgba(46, 125, 50, 0.10)",
      icon: COLORS.success,
      border: "rgba(46, 125, 50, 0.10)",
      title: COLORS.text,
      subtitle: COLORS.textMuted,
      accent: COLORS.success,
      badgeBg: "rgba(46, 125, 50, 0.10)",
      badgeText: COLORS.success,
    },
    warning: {
      soft: "#FFF8E8",
      softAlt: "#FFF3D9",
      iconBg: "rgba(245, 158, 11, 0.12)",
      icon: COLORS.warning,
      border: "rgba(245, 158, 11, 0.10)",
      title: COLORS.text,
      subtitle: COLORS.textMuted,
      accent: COLORS.warning,
      badgeBg: "rgba(245, 158, 11, 0.12)",
      badgeText: COLORS.warning,
    },
    info: {
      soft: "#EEF4FF",
      softAlt: "#E7F0FF",
      iconBg: "rgba(37, 99, 235, 0.10)",
      icon: COLORS.info,
      border: "rgba(37, 99, 235, 0.10)",
      title: COLORS.text,
      subtitle: COLORS.textMuted,
      accent: COLORS.info,
      badgeBg: "rgba(37, 99, 235, 0.10)",
      badgeText: COLORS.info,
    },
  };

  return map[tone];
}

function formatUserStatus(status?: string) {
  const value = String(status || "ACTIVE").replaceAll("_", " ").trim();
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function ActionTile({
  title,
  subtitle,
  icon,
  onPress,
  tone = "primary",
  featured = false,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: "primary" | "success" | "warning" | "info";
  featured?: boolean;
}) {
  const colors = getToneColors(tone);

  return (
    <Card
      onPress={onPress}
      style={[
        styles.actionCard,
        {
          backgroundColor: featured ? colors.softAlt : COLORS.white,
          borderColor: colors.border,
        },
        featured && styles.actionCardFeatured,
      ]}
      variant={featured ? "elevated" : "default"}
    >
      <View style={styles.actionCardTop}>
        <View style={[styles.actionIconWrap, { backgroundColor: colors.iconBg }]}>
          <Ionicons name={icon} size={20} color={colors.icon} />
        </View>

        <View style={[styles.actionBadge, { backgroundColor: colors.badgeBg }]}>
          <Text style={[styles.actionBadgeText, { color: colors.badgeText }]}>
            {featured ? "Popular" : "Open"}
          </Text>
        </View>
      </View>

      <View style={styles.actionCardBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle} numberOfLines={3}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.actionFooter}>
        <Text style={[styles.actionFooterText, { color: colors.accent }]}>
          Continue
        </Text>
        <View style={[styles.actionArrow, { backgroundColor: colors.iconBg }]}>
          <Ionicons name="arrow-forward" size={15} color={colors.icon} />
        </View>
      </View>
    </Card>
  );
}

function ShortcutCard({
  title,
  subtitle,
  icon,
  onPress,
  tone = "success",
}: ShortcutItem) {
  const colors = getToneColors(tone);

  return (
    <Card onPress={onPress} style={styles.shortcutCard} variant="default">
      <View style={styles.shortcutMain}>
        <View style={[styles.shortcutIconWrap, { backgroundColor: colors.iconBg }]}>
          <Ionicons name={icon} size={20} color={colors.icon} />
        </View>

        <View style={styles.shortcutTextWrap}>
          <Text style={styles.shortcutTitle}>{title}</Text>
          <Text style={styles.shortcutSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={[styles.shortcutArrow, { backgroundColor: colors.iconBg }]}>
        <Ionicons name="chevron-forward" size={18} color={colors.icon} />
      </View>
    </Card>
  );
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
          backgroundColor: COLORS.white,
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

function InfoBanner({
  title,
  subtitle,
  icon,
  tone = "info",
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "warning" | "info";
  onPress?: () => void;
}) {
  const colors = getToneColors(tone);

  return (
    <Card
      onPress={onPress}
      style={[
        styles.infoBanner,
        {
          backgroundColor: colors.soft,
          borderColor: colors.border,
        },
      ]}
      variant="soft"
    >
      <View style={[styles.infoBannerIcon, { backgroundColor: colors.iconBg }]}>
        <Ionicons name={icon} size={18} color={colors.icon} />
      </View>

      <View style={styles.infoBannerText}>
        <Text style={styles.infoBannerTitle}>{title}</Text>
        <Text style={styles.infoBannerSubtitle}>{subtitle}</Text>
      </View>

      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      ) : null}
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
    return (
      sum +
      toNumber(
        loan?.outstanding_balance ??
          loan?.balance ??
          loan?.remaining_balance ??
          loan?.amount ??
          0
      )
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

function normalizeMerryPayload(merryData: any) {
  const created = Array.isArray(merryData?.created) ? merryData.created : [];
  const memberships = Array.isArray(merryData?.memberships)
    ? merryData.memberships
    : [];
  return { created, memberships };
}

function getCommunityCount(merryData: any) {
  const { created, memberships } = normalizeMerryPayload(merryData);
  return created.length + memberships.length;
}

function getFirstMerryShortcut(merryData: any) {
  const { memberships, created } = normalizeMerryPayload(merryData);

  const firstMembership = memberships[0];
  if (firstMembership) {
    const merryId =
      Number(firstMembership?.merry_id) ||
      Number(firstMembership?.merry) ||
      Number(firstMembership?.id);

    const merryName =
      firstMembership?.merry_name ||
      firstMembership?.name ||
      firstMembership?.merry_detail?.name ||
      "My Merry";

    if (Number.isFinite(merryId)) {
      return {
        id: merryId,
        name: merryName,
        subtitle: "Continue with contributions and recent activity",
      };
    }
  }

  const firstCreated = created[0];
  if (firstCreated) {
    const merryId = Number(firstCreated?.id);
    const merryName = firstCreated?.name || "My Merry";

    if (Number.isFinite(merryId)) {
      return {
        id: merryId,
        name: merryName,
        subtitle: "Open your merry and manage member activity",
      };
    }
  }

  return null;
}

export default function DashboardScreen() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [heroSavings, setHeroSavings] = useState("—");
  const [stats, setStats] = useState({
    loans: "—",
    ledger: "—",
    community: "—",
  });

  const [merryShortcut, setMerryShortcut] = useState<{
    id: number;
    name: string;
    subtitle: string;
  } | null>(null);

  const [groupShortcut, setGroupShortcut] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);

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

      const communityCount =
        merryResult.status === "fulfilled"
          ? getCommunityCount(merryResult.value)
          : 0;

      setHeroSavings(formatKes(savingsTotal));

      setStats({
        loans: formatKes(loansTotal),
        ledger: `${ledgerCount} records`,
        community: `${communityCount} active`,
      });

      if (merryResult.status === "fulfilled") {
        setMerryShortcut(getFirstMerryShortcut(merryResult.value));
      } else {
        setMerryShortcut(null);
      }

      setGroupShortcut(
        groupAllowed
          ? {
              title: "Groups Hub",
              subtitle: "Open groups, memberships and contributions",
            }
          : null
      );
    } finally {
      setLoading(false);
    }
  }, [groupAllowed]);

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
    if (isAdmin) {
      return [
        {
          title: "Deposit",
          subtitle: "Add money quickly to savings accounts",
          icon: "arrow-down-circle-outline",
          go: () => router.push(ROUTES.tabs.paymentsDeposit as any),
          tone: "primary",
          featured: true,
        },
        {
          title: "Loans",
          subtitle: "Review loan requests and balances",
          icon: "cash-outline",
          go: () => router.push(ROUTES.tabs.loans as any),
          tone: "warning",
        },
        {
          title: "Groups",
          subtitle: "Manage memberships and requests",
          icon: "people-outline",
          go: () => router.push(ROUTES.tabs.groups as any),
          tone: "success",
        },
        {
          title: "Merry",
          subtitle: "Track merry contributions and activity",
          icon: "repeat-outline",
          go: () => router.push(ROUTES.tabs.merry as any),
          tone: "success",
        },
      ];
    }

    return [
      {
        title: "Deposit",
        subtitle: "Add money directly to your savings",
        icon: "arrow-down-circle-outline",
        go: () => router.push(ROUTES.tabs.paymentsDeposit as any),
        tone: "primary",
        featured: true,
      },
      {
        title: "Loans",
        subtitle: loanAllowed
          ? "Request a loan or manage existing ones"
          : "Complete KYC to access loans",
        icon: "cash-outline",
        go: () =>
          loanAllowed ? router.push(ROUTES.tabs.loans as any) : goToKyc(),
        tone: "warning",
      },
      {
        title: "Groups",
        subtitle: groupAllowed
          ? "Join and manage your self-help groups"
          : "Complete KYC to join groups",
        icon: "people-outline",
        go: () =>
          groupAllowed ? router.push(ROUTES.tabs.groups as any) : goToKyc(),
        tone: "success",
      },
      {
        title: "Merry",
        subtitle: merryAllowed
          ? "Continue with merry contributions"
          : "Open merry and review your status",
        icon: "repeat-outline",
        go: () => router.push(ROUTES.tabs.merry as any),
        tone: "success",
      },
    ];
  }, [goToKyc, groupAllowed, isAdmin, loanAllowed, merryAllowed]);

  const greetingName = useMemo(() => {
    const username =
      user?.username ||
      (typeof user?.phone === "string" ? user.phone : "") ||
      "Member";
    return username;
  }, [user]);

  const greetingText = useMemo(() => getGreetingByTime(), []);

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
            <Ionicons name="people-circle-outline" size={20} color={COLORS.white} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>United Care</Text>
            <Text style={styles.headerSubtitle}>Self-help group dashboard</Text>
          </View>
        </View>

        <Button
          variant="ghost"
          title="Refresh"
          onPress={onRefresh}
          leftIcon={
            <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
          }
        />
      </View>

      <Card style={styles.heroCard} variant="elevated">
        <View style={styles.heroCircleOne} />
        <View style={styles.heroCircleTwo} />

        <View style={styles.heroTop}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroEyebrow}>
              {isAdmin ? "ADMIN PANEL" : "COMMUNITY ACCOUNT"}
            </Text>
            <Text style={styles.heroTitle}>
              {greetingText}, {greetingName}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isAdmin
                ? "Manage members, savings activity, loans and community operations from one clean place."
                : kycComplete
                  ? "Welcome back. Keep your savings, groups, merry and loan activity moving smoothly."
                  : "Complete your verification to unlock full access to loans, groups and more member services."}
            </Text>
          </View>

          <View style={styles.heroAvatar}>
            <Ionicons
              name={isAdmin ? "shield-checkmark-outline" : "person-outline"}
              size={24}
              color={COLORS.white}
            />
          </View>
        </View>

        <View style={styles.heroBalanceCard}>
          <Text style={styles.heroBalanceLabel}>Total savings</Text>
          <Text style={styles.heroBalanceValue}>{heroSavings}</Text>
          <Text style={styles.heroBalanceNote}>
            Build steadily through savings, group support and consistent contribution.
          </Text>
        </View>

        <View style={styles.heroPills}>
          <View style={styles.heroPill}>
            <Ionicons name="ellipse" size={8} color="#8CF0C7" />
            <Text style={styles.heroPillText}>{formatUserStatus(user?.status)}</Text>
          </View>

          <View style={styles.heroPill}>
            <Ionicons
              name={isAdmin ? "shield-outline" : "people-outline"}
              size={14}
              color={COLORS.white}
            />
            <Text style={styles.heroPillText}>
              {isAdmin ? "Admin view" : "Member view"}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.overviewRow}>
        <StatTile
          label="Loan Balance"
          value={stats.loans}
          icon="cash-outline"
          tone="warning"
        />
        <StatTile
          label="Transactions"
          value={stats.ledger}
          icon="receipt-outline"
          tone="info"
        />
        <StatTile
          label="Community"
          value={stats.community}
          icon="people-outline"
          tone="success"
        />
      </View>

      {(merryShortcut || groupShortcut) && (
        <Section title="Continue" subtitle="Return to what matters most.">
          <View style={styles.continueWrap}>
            {merryShortcut ? (
              <ShortcutCard
                title={merryShortcut.name}
                subtitle={merryShortcut.subtitle}
                icon="repeat-outline"
                tone="success"
                onPress={() =>
                  router.push(ROUTES.dynamic.merryDetail(merryShortcut.id) as any)
                }
              />
            ) : null}

            {groupShortcut ? (
              <ShortcutCard
                title={groupShortcut.title}
                subtitle={groupShortcut.subtitle}
                icon="people-outline"
                tone="primary"
                onPress={() => router.push(ROUTES.tabs.groups as any)}
              />
            ) : null}
          </View>
        </Section>
      )}

      {!kycComplete ? (
        <Section title="Verification" subtitle="One more step to unlock full access.">
          <InfoBanner
            title="Complete your KYC"
            subtitle="Verification is required before you can access loans and some group features."
            icon="alert-circle-outline"
            tone="info"
            onPress={() => router.push(ROUTES.tabs.profileKyc as any)}
          />
        </Section>
      ) : null}

      <Section title="Quick Actions" subtitle="Move faster with the main services.">
        <View style={styles.actionsGrid}>
          {actions.map((a) => (
            <ActionTile
              key={a.title}
              title={a.title}
              subtitle={a.subtitle}
              icon={a.icon}
              onPress={a.go}
              tone={a.tone}
              featured={a.featured}
            />
          ))}
        </View>
      </Section>

      <Section
        title={isAdmin ? "Operations Note" : "Member Guidance"}
        subtitle={
          isAdmin
            ? "Keep the platform clean, organized and active."
            : "Small consistent steps strengthen your account."
        }
      >
        <InfoBanner
          title={isAdmin ? "Keep records aligned" : "Stay consistent"}
          subtitle={
            isAdmin
              ? "Review approvals, deposits, loan activity and member participation regularly."
              : kycComplete
                ? "Regular deposits and active participation help you get more value from the group."
                : "Finish verification first so you can access more services without restrictions."
          }
          icon={isAdmin ? "shield-outline" : "sparkles-outline"}
          tone={isAdmin ? "primary" : "success"}
        />
      </Section>

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F6FAF8",
  },

  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6FAF8",
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

  headerBrandIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
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
    backgroundColor: "#0D6E6E",
    borderRadius: 28,
    padding: SPACING.lg,
    borderWidth: 0,
    overflow: "hidden",
    marginBottom: SPACING.lg,
    ...SHADOW.strong,
  },

  heroCircleOne: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -90,
    right: -50,
  },

  heroCircleTwo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -40,
    left: -30,
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
    color: "rgba(255,255,255,0.86)",
    marginTop: 8,
    lineHeight: 20,
  },

  heroAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  heroBalanceCard: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
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
    borderRadius: 999,
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
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 122,
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

  continueWrap: {
    gap: SPACING.md,
  },

  shortcutCard: {
    padding: SPACING.md,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  shortcutMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    flex: 1,
  },

  shortcutIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  shortcutTextWrap: {
    flex: 1,
  },

  shortcutTitle: {
    ...TYPE.title,
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 16,
  },

  shortcutSubtitle: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  shortcutArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SPACING.md,
  },

  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: SPACING.md,
  },

  actionCard: {
    width: "48.2%",
    minHeight: 190,
    padding: SPACING.md,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "space-between",
  },

  actionCardFeatured: {
    ...SHADOW.strong,
  },

  actionCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },

  actionIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  actionBadgeText: {
    ...TYPE.caption,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  actionCardBody: {
    flex: 1,
  },

  actionTitle: {
    ...TYPE.title,
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 21,
  },

  actionSubtitle: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    marginTop: 7,
    lineHeight: 18,
    fontSize: 13,
  },

  actionFooter: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  actionFooterText: {
    ...TYPE.caption,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  actionArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: 22,
    borderWidth: 1,
  },

  infoBannerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  infoBannerText: {
    flex: 1,
  },

  infoBannerTitle: {
    ...TYPE.bodyStrong,
    color: COLORS.text,
    fontWeight: "800",
  },

  infoBannerSubtitle: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
});

// // app/(tabs)/dashboard/index.tsx
// import { Ionicons } from "@expo/vector-icons";
// import { router, useFocusEffect } from "expo-router";
// import React, { useCallback, useMemo, useState } from "react";
// import {
//   ActivityIndicator,
//   RefreshControl,
//   ScrollView,
//   StyleSheet,
//   Text,
//   View,
// } from "react-native";

// import Button from "@/components/ui/Button";
// import Card from "@/components/ui/Card";
// import EmptyState from "@/components/ui/EmptyState";
// import Section from "@/components/ui/Section";

// import { ROUTES } from "@/constants/routes";
// import {
//   COLORS,
//   RADIUS,
//   SHADOW,
//   SPACING,
//   STATUS,
//   TYPE,
// } from "@/constants/theme";
// import { getMyLoans } from "@/services/loans";
// import { getMyMerries } from "@/services/merry";
// import { getMyLedger } from "@/services/payments";
// import {
//   canJoinGroup,
//   canJoinMerry,
//   canRequestLoan,
//   getMe,
//   isAdminUser,
//   isKycComplete,
//   MeResponse,
// } from "@/services/profile";
// import { listMySavingsAccounts, SavingsAccount } from "@/services/savings";
// import { getSessionUser, SessionUser } from "@/services/session";

// type DashboardUser = Partial<MeResponse> & Partial<SessionUser>;

// type ActionItem = {
//   title: string;
//   subtitle: string;
//   icon: keyof typeof Ionicons.glyphMap;
//   go: () => void;
//   tone?: "primary" | "success" | "warning" | "info";
//   featured?: boolean;
// };

// type ShortcutItem = {
//   title: string;
//   subtitle: string;
//   icon: keyof typeof Ionicons.glyphMap;
//   onPress: () => void;
//   tone?: "primary" | "success" | "warning" | "info";
// };

// function getStatusTone(status?: string) {
//   const key = String(status || "").toUpperCase() as keyof typeof STATUS;
//   return (
//     STATUS[key] || {
//       text: COLORS.gray600,
//       bg: "rgba(107,114,128,0.12)",
//     }
//   );
// }

// function getGreetingByTime() {
//   const hour = new Date().getHours();
//   if (hour < 12) return "Good morning";
//   if (hour < 17) return "Good afternoon";
//   return "Good evening";
// }

// function getToneColors(
//   tone: "primary" | "success" | "warning" | "info" = "primary"
// ) {
//   const map = {
//     primary: {
//       bg: COLORS.primarySoft,
//       icon: COLORS.primary,
//       chipBg: "rgba(14, 94, 111, 0.12)",
//       chipText: COLORS.primary,
//       border: "rgba(14, 94, 111, 0.18)",
//       accent: COLORS.primary,
//       cardBg: "#EEF8FA",
//       title: COLORS.primaryDark ?? COLORS.primary,
//       subtitle: COLORS.textSoft ?? COLORS.textMuted,
//       footerBg: "rgba(14, 94, 111, 0.10)",
//     },
//     success: {
//       bg: COLORS.successSoft,
//       icon: COLORS.success,
//       chipBg: "rgba(46, 125, 50, 0.12)",
//       chipText: COLORS.success,
//       border: "rgba(46, 125, 50, 0.18)",
//       accent: COLORS.success,
//       cardBg: "#F1FAF2",
//       title: COLORS.text,
//       subtitle: COLORS.textSoft ?? COLORS.textMuted,
//       footerBg: "rgba(46, 125, 50, 0.10)",
//     },
//     warning: {
//       bg: COLORS.warningSoft,
//       icon: COLORS.warning,
//       chipBg: "rgba(245, 158, 11, 0.14)",
//       chipText: COLORS.warning,
//       border: "rgba(245, 158, 11, 0.18)",
//       accent: COLORS.warning,
//       cardBg: "#FFF8EB",
//       title: COLORS.text,
//       subtitle: COLORS.textSoft ?? COLORS.textMuted,
//       footerBg: "rgba(245, 158, 11, 0.10)",
//     },
//     info: {
//       bg: COLORS.infoSoft,
//       icon: COLORS.info,
//       chipBg: COLORS.infoSoft,
//       chipText: COLORS.info,
//       border: "rgba(37, 99, 235, 0.18)",
//       accent: COLORS.info,
//       cardBg: "#EFF6FF",
//       title: COLORS.text,
//       subtitle: COLORS.textSoft ?? COLORS.textMuted,
//       footerBg: "rgba(37, 99, 235, 0.10)",
//     },
//   };

//   return map[tone];
// }

// function ActionTile({
//   title,
//   subtitle,
//   icon,
//   onPress,
//   tone = "primary",
//   featured = false,
// }: {
//   title: string;
//   subtitle: string;
//   icon: keyof typeof Ionicons.glyphMap;
//   onPress: () => void;
//   tone?: "primary" | "success" | "warning" | "info";
//   featured?: boolean;
// }) {
//   const colors = getToneColors(tone);

//   return (
//     <Card
//       onPress={onPress}
//       style={[
//         styles.actionCard,
//         {
//           borderColor: colors.border,
//           backgroundColor: colors.cardBg,
//         },
//         featured && styles.actionCardFeatured,
//       ]}
//       variant={featured ? "elevated" : "default"}
//     >
//       <View style={styles.actionTop}>
//         <View style={[styles.actionIconWrap, { backgroundColor: colors.bg }]}>
//           <Ionicons name={icon} size={20} color={colors.icon} />
//         </View>

//         <View style={[styles.actionChip, { backgroundColor: colors.chipBg }]}>
//           <Text style={[styles.actionChipText, { color: colors.chipText }]}>
//             QUICK
//           </Text>
//         </View>
//       </View>

//       <View>
//         <Text
//           style={[
//             styles.actionTitle,
//             { color: colors.title },
//             featured && styles.actionTitleFeatured,
//           ]}
//         >
//           {title}
//         </Text>
//         <Text
//           style={[styles.actionSubtitle, { color: colors.subtitle }]}
//           numberOfLines={3}
//         >
//           {subtitle}
//         </Text>
//       </View>

//       <View style={styles.actionFooter}>
//         <Text style={[styles.actionLink, { color: colors.accent }]}>Open</Text>

//         <View
//           style={[
//             styles.actionArrow,
//             { backgroundColor: colors.footerBg || colors.bg },
//           ]}
//         >
//           <Ionicons name="arrow-forward" size={15} color={colors.icon} />
//         </View>
//       </View>
//     </Card>
//   );
// }

// function ShortcutCard({
//   title,
//   subtitle,
//   icon,
//   onPress,
//   tone = "success",
// }: ShortcutItem) {
//   const colors = getToneColors(tone);

//   return (
//     <Card onPress={onPress} style={styles.shortcutCard} variant="default">
//       <View style={styles.shortcutLeft}>
//         <View style={[styles.shortcutIcon, { backgroundColor: colors.bg }]}>
//           <Ionicons name={icon} size={18} color={colors.icon} />
//         </View>

//         <View style={{ flex: 1 }}>
//           <Text style={styles.shortcutTitle}>{title}</Text>
//           <Text style={styles.shortcutSubtitle} numberOfLines={2}>
//             {subtitle}
//           </Text>
//         </View>
//       </View>

//       <View style={[styles.shortcutArrow, { backgroundColor: colors.bg }]}>
//         <Ionicons name="chevron-forward" size={18} color={colors.icon} />
//       </View>
//     </Card>
//   );
// }

// function StatMini({
//   label,
//   value,
//   icon,
//   tone = "primary",
// }: {
//   label: string;
//   value: string;
//   icon: keyof typeof Ionicons.glyphMap;
//   tone?: "primary" | "success" | "warning" | "info";
// }) {
//   const colors = getToneColors(tone);

//   return (
//     <Card style={styles.statCard} variant="default">
//       <View style={styles.statHeader}>
//         <View style={[styles.statIcon, { backgroundColor: colors.bg }]}>
//           <Ionicons name={icon} size={17} color={colors.icon} />
//         </View>
//       </View>

//       <Text style={styles.statLabel}>{label}</Text>
//       <Text style={styles.statValue} numberOfLines={1}>
//         {value}
//       </Text>
//     </Card>
//   );
// }

// function toNumber(value: unknown): number {
//   if (typeof value === "number") return Number.isFinite(value) ? value : 0;
//   if (typeof value === "string") {
//     const n = Number(value.replace(/,/g, "").trim());
//     return Number.isFinite(n) ? n : 0;
//   }
//   return 0;
// }

// function formatKes(value: number): string {
//   return `KES ${value.toLocaleString(undefined, {
//     minimumFractionDigits: 0,
//     maximumFractionDigits: 0,
//   })}`;
// }

// function getSavingsTotal(accounts: SavingsAccount[]): number {
//   return accounts.reduce(
//     (sum, account) =>
//       sum + toNumber(account.available_balance ?? account.balance ?? 0),
//     0
//   );
// }

// function getLoansTotal(loansData: any): number {
//   const rows = Array.isArray(loansData)
//     ? loansData
//     : Array.isArray(loansData?.results)
//       ? loansData.results
//       : Array.isArray(loansData?.data)
//         ? loansData.data
//         : [];

//   return rows.reduce((sum: number, loan: any) => {
//     return (
//       sum +
//       toNumber(
//         loan?.outstanding_balance ??
//           loan?.balance ??
//           loan?.remaining_balance ??
//           loan?.amount ??
//           0
//       )
//     );
//   }, 0);
// }

// function getLedgerCount(ledgerData: any): number {
//   const rows = Array.isArray(ledgerData)
//     ? ledgerData
//     : Array.isArray(ledgerData?.results)
//       ? ledgerData.results
//       : Array.isArray(ledgerData?.data)
//         ? ledgerData.data
//         : [];

//   return rows.length;
// }

// function normalizeMerryPayload(merryData: any) {
//   const created = Array.isArray(merryData?.created) ? merryData.created : [];
//   const memberships = Array.isArray(merryData?.memberships)
//     ? merryData.memberships
//     : [];
//   return { created, memberships };
// }

// function getCommunityCount(merryData: any) {
//   const { created, memberships } = normalizeMerryPayload(merryData);
//   return created.length + memberships.length;
// }

// function getFirstMerryShortcut(merryData: any) {
//   const { memberships, created } = normalizeMerryPayload(merryData);

//   const firstMembership = memberships[0];
//   if (firstMembership) {
//     const merryId =
//       Number(firstMembership?.merry_id) ||
//       Number(firstMembership?.merry) ||
//       Number(firstMembership?.id);

//     const merryName =
//       firstMembership?.merry_name ||
//       firstMembership?.name ||
//       firstMembership?.merry_detail?.name ||
//       "My Merry";

//     if (Number.isFinite(merryId)) {
//       return {
//         id: merryId,
//         name: merryName,
//         subtitle: "Continue with dues, contributions and activity",
//       };
//     }
//   }

//   const firstCreated = created[0];
//   if (firstCreated) {
//     const merryId = Number(firstCreated?.id);
//     const merryName = firstCreated?.name || "My Merry";

//     if (Number.isFinite(merryId)) {
//       return {
//         id: merryId,
//         name: merryName,
//         subtitle: "Open your merry and review recent activity",
//       };
//     }
//   }

//   return null;
// }

// export default function DashboardScreen() {
//   const [user, setUser] = useState<DashboardUser | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);

//   const [heroSavings, setHeroSavings] = useState("—");
//   const [stats, setStats] = useState({
//     loans: "—",
//     ledger: "—",
//     community: "—",
//   });

//   const [merryShortcut, setMerryShortcut] = useState<{
//     id: number;
//     name: string;
//     subtitle: string;
//   } | null>(null);

//   const [groupShortcut, setGroupShortcut] = useState<{
//     title: string;
//     subtitle: string;
//   } | null>(null);

//   const isAdmin = isAdminUser(user);
//   const kycComplete = isKycComplete(user);
//   const loanAllowed = canRequestLoan(user);
//   const groupAllowed = canJoinGroup(user);
//   const merryAllowed = canJoinMerry(user);

//   const goToKyc = useCallback(() => {
//     router.push(ROUTES.tabs.profileKyc as any);
//   }, []);

//   const load = useCallback(async () => {
//     try {
//       setLoading(true);

//       const [
//         sessionResult,
//         meResult,
//         savingsResult,
//         loansResult,
//         ledgerResult,
//         merryResult,
//       ] = await Promise.allSettled([
//         getSessionUser(),
//         getMe(),
//         listMySavingsAccounts(),
//         getMyLoans(),
//         getMyLedger(),
//         getMyMerries(),
//       ]);

//       const sessionUser =
//         sessionResult.status === "fulfilled" ? sessionResult.value : null;
//       const meUser = meResult.status === "fulfilled" ? meResult.value : null;

//       const mergedUser: DashboardUser | null =
//         sessionUser || meUser
//           ? {
//               ...(sessionUser ?? {}),
//               ...(meUser ?? {}),
//             }
//           : null;

//       setUser(mergedUser);

//       const savingsTotal =
//         savingsResult.status === "fulfilled"
//           ? getSavingsTotal(savingsResult.value)
//           : 0;

//       const loansTotal =
//         loansResult.status === "fulfilled" ? getLoansTotal(loansResult.value) : 0;

//       const ledgerCount =
//         ledgerResult.status === "fulfilled"
//           ? getLedgerCount(ledgerResult.value)
//           : 0;

//       const communityCount =
//         merryResult.status === "fulfilled"
//           ? getCommunityCount(merryResult.value)
//           : 0;

//       setHeroSavings(formatKes(savingsTotal));

//       setStats({
//         loans: formatKes(loansTotal),
//         ledger: `${ledgerCount} records`,
//         community: `${communityCount} active`,
//       });

//       if (merryResult.status === "fulfilled") {
//         setMerryShortcut(getFirstMerryShortcut(merryResult.value));
//       } else {
//         setMerryShortcut(null);
//       }

//       setGroupShortcut(
//         groupAllowed
//           ? {
//               title: "Groups Hub",
//               subtitle: "Open groups and continue with memberships or contributions",
//             }
//           : null
//       );
//     } finally {
//       setLoading(false);
//     }
//   }, [groupAllowed]);

//   useFocusEffect(
//     useCallback(() => {
//       load();
//     }, [load])
//   );

//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);
//     try {
//       await load();
//     } finally {
//       setRefreshing(false);
//     }
//   }, [load]);

//   const actions = useMemo<ActionItem[]>(() => {
//     if (isAdmin) {
//       return [
//         {
//           title: "Deposit",
//           subtitle: "Add money quickly to savings",
//           icon: "arrow-down-circle-outline",
//           go: () => router.push(ROUTES.tabs.paymentsDeposit as any),
//           tone: "primary",
//           featured: true,
//         },
//         {
//           title: "Loans",
//           subtitle: "Review and manage loan activity",
//           icon: "cash-outline",
//           go: () => router.push(ROUTES.tabs.loans as any),
//           tone: "warning",
//         },
//         {
//           title: "Groups",
//           subtitle: "Manage memberships and requests",
//           icon: "people-outline",
//           go: () => router.push(ROUTES.tabs.groups as any),
//           tone: "success",
//         },
//         {
//           title: "Merry",
//           subtitle: "Open merry activity and contributions",
//           icon: "repeat-outline",
//           go: () => router.push(ROUTES.tabs.merry as any),
//           tone: "success",
//         },
//       ];
//     }

//     return [
//       {
//         title: "Deposit",
//         subtitle: "Add money straight to your savings",
//         icon: "arrow-down-circle-outline",
//         go: () => router.push(ROUTES.tabs.paymentsDeposit as any),
//         tone: "primary",
//         featured: true,
//       },
//       {
//         title: "Loans",
//         subtitle: loanAllowed
//           ? "Request or manage your loans"
//           : "Complete KYC before requesting loans",
//         icon: "cash-outline",
//         go: () =>
//           loanAllowed ? router.push(ROUTES.tabs.loans as any) : goToKyc(),
//         tone: "warning",
//       },
//       {
//         title: "Groups",
//         subtitle: groupAllowed
//           ? "Browse and join community groups"
//           : "Complete KYC before joining groups",
//         icon: "people-outline",
//         go: () =>
//           groupAllowed ? router.push(ROUTES.tabs.groups as any) : goToKyc(),
//         tone: "success",
//       },
//       {
//         title: "Merry",
//         subtitle: merryAllowed
//           ? "Go to merry contributions and activity"
//           : "Open merry and check your status",
//         icon: "repeat-outline",
//         go: () => router.push(ROUTES.tabs.merry as any),
//         tone: "success",
//       },
//     ];
//   }, [goToKyc, groupAllowed, isAdmin, loanAllowed, merryAllowed]);

//   const greetingName = useMemo(() => {
//     const username =
//       user?.username ||
//       (typeof user?.phone === "string" ? user.phone : "") ||
//       "Member";
//     return username;
//   }, [user]);

//   const greetingText = useMemo(() => getGreetingByTime(), []);
//   const statusColors = getStatusTone(user?.status);

//   if (loading) {
//     return (
//       <View style={styles.loadingWrap}>
//         <ActivityIndicator color={COLORS.primary} />
//       </View>
//     );
//   }

//   if (!user) {
//     return (
//       <View style={styles.page}>
//         <EmptyState
//           title="Not signed in"
//           subtitle="Please login to access your dashboard."
//           actionLabel="Go to Login"
//           onAction={() => router.replace(ROUTES.auth.login as any)}
//         />
//       </View>
//     );
//   }

//   return (
//     <ScrollView
//       style={styles.page}
//       contentContainerStyle={styles.content}
//       refreshControl={
//         <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//       }
//       showsVerticalScrollIndicator={false}
//     >
//       <View style={styles.topBar}>
//         <View style={styles.brandRow}>
//           <View style={styles.brandIcon}>
//             <Ionicons
//               name="shield-checkmark-outline"
//               size={18}
//               color={COLORS.white}
//             />
//           </View>

//           <View>
//             <Text style={styles.brandName}>United Care</Text>
//             <Text style={styles.brandSub}>Member dashboard</Text>
//           </View>
//         </View>

//         <Button
//           variant="ghost"
//           title="Refresh"
//           onPress={onRefresh}
//           leftIcon={
//             <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
//           }
//         />
//       </View>

//       <View style={styles.heroShell}>
//         <Card style={styles.heroCard} variant="elevated">
//           <View style={styles.heroGlowOne} />
//           <View style={styles.heroGlowTwo} />

//           <View style={styles.heroTop}>
//             <View style={{ flex: 1, paddingRight: SPACING.md }}>
//               <Text style={styles.heroEyebrow}>
//                 {isAdmin ? "ADMIN OVERVIEW" : "MEMBER OVERVIEW"}
//               </Text>
//               <Text style={styles.heroTitle}>
//                 {greetingText}, {greetingName}
//               </Text>
//               <Text style={styles.heroSubtitle}>
//                 {isAdmin
//                   ? "Keep operations, reviews and service activity moving from one place."
//                   : kycComplete
//                     ? "Track your savings, payments, loans, groups and merry activity from one place."
//                     : "Complete your KYC to unlock more account features and community access."}
//               </Text>
//             </View>

//             <View style={styles.heroAvatar}>
//               <Ionicons name="person-outline" size={24} color={COLORS.white} />
//             </View>
//           </View>

//           <View style={styles.heroBalanceBlock}>
//             <Text style={styles.heroBalanceLabel}>Savings balance</Text>
//             <Text style={styles.heroBalanceValue}>{heroSavings}</Text>
//             <Text style={styles.heroBalanceMeta}>
//               Your savings remain the strongest starting point for the rest of your account activity.
//             </Text>
//           </View>

//           <View style={styles.heroFooter}>
//             <View
//               style={[
//                 styles.statusPill,
//                 { backgroundColor: "rgba(255,255,255,0.14)" },
//               ]}
//             >
//               <Text style={[styles.statusPillText, { color: COLORS.white }]}>
//                 {String(user?.status || "ACTIVE").replaceAll("_", " ")}
//               </Text>
//             </View>

//             <View style={styles.rolePill}>
//               <Ionicons
//                 name={isAdmin ? "shield-outline" : "checkmark-circle-outline"}
//                 size={14}
//                 color={COLORS.white}
//               />
//               <Text style={styles.rolePillText}>
//                 {isAdmin ? "Admin view" : "Member view"}
//               </Text>
//             </View>
//           </View>
//         </Card>
//       </View>

//       {(merryShortcut || groupShortcut) && (
//         <Section title="Continue" subtitle="Pick up where you left off.">
//           <View style={styles.shortcutsWrap}>
//             {merryShortcut ? (
//               <ShortcutCard
//                 title={merryShortcut.name}
//                 subtitle={merryShortcut.subtitle}
//                 icon="repeat-outline"
//                 tone="success"
//                 onPress={() =>
//                   router.push(ROUTES.dynamic.merryDetail(merryShortcut.id) as any)
//                 }
//               />
//             ) : null}

//             {groupShortcut ? (
//               <ShortcutCard
//                 title={groupShortcut.title}
//                 subtitle={groupShortcut.subtitle}
//                 icon="people-outline"
//                 tone="primary"
//                 onPress={() => router.push(ROUTES.tabs.groups as any)}
//               />
//             ) : null}
//           </View>
//         </Section>
//       )}

//       {!kycComplete ? (
//         <Section
//           title="Verification"
//           subtitle="Complete verification to unlock more account features."
//         >
//           <Card
//             onPress={() => router.push(ROUTES.tabs.profileKyc as any)}
//             style={styles.noticeCard}
//             variant="soft"
//           >
//             <View style={styles.noticeIcon}>
//               <Ionicons
//                 name="alert-circle-outline"
//                 size={18}
//                 color={COLORS.info}
//               />
//             </View>

//             <View style={{ flex: 1 }}>
//               <Text style={styles.noticeTitle}>Finish account verification</Text>
//               <Text style={styles.noticeText}>
//                 Loans and groups require completed KYC before access is granted.
//               </Text>
//             </View>

//             <Ionicons
//               name="chevron-forward"
//               size={18}
//               color={COLORS.textMuted}
//             />
//           </Card>
//         </Section>
//       ) : null}

//       <Section title="Quick Actions">
//         <View style={styles.actionsGrid}>
//           {actions.map((a) => (
//             <ActionTile
//               key={a.title}
//               title={a.title}
//               subtitle={a.subtitle}
//               icon={a.icon}
//               onPress={a.go}
//               tone={a.tone}
//               featured={a.featured}
//             />
//           ))}
//         </View>
//       </Section>

//       <Section
//         title="Activity"
//         subtitle="Keep an eye on the parts of your account that move most."
//       >
//         <View style={styles.statsGrid}>
//           <StatMini
//             label="Loan Balance"
//             value={stats.loans}
//             icon="cash-outline"
//             tone="warning"
//           />
//           <StatMini
//             label="Transactions"
//             value={stats.ledger}
//             icon="receipt-outline"
//             tone="info"
//           />
//           <StatMini
//             label="Community"
//             value={stats.community}
//             icon="people-outline"
//             tone="success"
//           />
//         </View>
//       </Section>

//       <Section
//         title={isAdmin ? "Operations Guidance" : "Guidance"}
//         subtitle={
//           isAdmin
//             ? "Keep reviews and records organized."
//             : "A practical reminder based on your account state."
//         }
//       >
//         <Card style={styles.infoCard} variant="soft">
//           <View style={styles.infoIcon}>
//             <Ionicons
//               name={isAdmin ? "shield-outline" : "sparkles-outline"}
//               size={18}
//               color={COLORS.info}
//             />
//           </View>

//           <View style={{ flex: 1 }}>
//             <Text style={styles.infoTitle}>
//               {isAdmin ? "Operational note" : "Member tip"}
//             </Text>
//             <Text style={styles.infoText}>
//               {isAdmin
//                 ? "Keep approvals, payments and member activity aligned so the platform remains clean and auditable."
//                 : kycComplete
//                   ? "Consistent deposits and good community participation help keep your account healthy."
//                   : "Completing KYC is the next best step to unlock more account functions."}
//             </Text>
//           </View>
//         </Card>
//       </Section>

//       <View style={{ height: 10 }} />
//     </ScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   page: {
//     flex: 1,
//     backgroundColor: COLORS.background,
//   },

//   content: {
//     padding: SPACING.md,
//     paddingBottom: SPACING.xl,
//   },

//   loadingWrap: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: COLORS.background,
//   },

//   topBar: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     marginBottom: SPACING.md,
//     gap: SPACING.sm,
//   },

//   brandRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.sm,
//     flex: 1,
//   },

//   brandIcon: {
//     width: 42,
//     height: 42,
//     borderRadius: RADIUS.md,
//     backgroundColor: COLORS.primary,
//     alignItems: "center",
//     justifyContent: "center",
//     ...SHADOW.soft,
//   },

//   brandName: {
//     ...TYPE.title,
//     color: COLORS.text,
//     fontWeight: "800",
//   },

//   brandSub: {
//     ...TYPE.caption,
//     color: COLORS.textMuted,
//     marginTop: 2,
//     letterSpacing: 0.2,
//   },

//   heroShell: {
//     marginBottom: SPACING.lg,
//   },

//   heroCard: {
//     backgroundColor: COLORS.primary,
//     borderRadius: RADIUS.xl,
//     padding: SPACING.lg,
//     borderWidth: 0,
//     overflow: "hidden",
//     ...SHADOW.strong,
//   },

//   heroGlowOne: {
//     position: "absolute",
//     width: 180,
//     height: 180,
//     borderRadius: 999,
//     backgroundColor: "rgba(255,255,255,0.08)",
//     top: -60,
//     right: -40,
//   },

//   heroGlowTwo: {
//     position: "absolute",
//     width: 120,
//     height: 120,
//     borderRadius: 999,
//     backgroundColor: "rgba(255,255,255,0.06)",
//     bottom: -30,
//     left: -20,
//   },

//   heroTop: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     justifyContent: "space-between",
//   },

//   heroEyebrow: {
//     ...TYPE.caption,
//     color: "rgba(255,255,255,0.78)",
//     fontWeight: "800",
//     letterSpacing: 1,
//   },

//   heroTitle: {
//     ...TYPE.h1,
//     color: COLORS.white,
//     marginTop: 6,
//     fontWeight: "900",
//   },

//   heroSubtitle: {
//     ...TYPE.subtext,
//     color: "rgba(255,255,255,0.84)",
//     marginTop: 8,
//     lineHeight: 20,
//   },

//   heroAvatar: {
//     width: 52,
//     height: 52,
//     borderRadius: RADIUS.round,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: "rgba(255,255,255,0.16)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.20)",
//   },

//   heroBalanceBlock: {
//     marginTop: SPACING.lg,
//     paddingTop: SPACING.md,
//     borderTopWidth: 1,
//     borderTopColor: "rgba(255,255,255,0.12)",
//   },

//   heroBalanceLabel: {
//     ...TYPE.caption,
//     color: "rgba(255,255,255,0.72)",
//     letterSpacing: 0.7,
//     textTransform: "uppercase",
//     fontWeight: "700",
//   },

//   heroBalanceValue: {
//     marginTop: 6,
//     fontSize: 30,
//     lineHeight: 36,
//     fontWeight: "900",
//     color: COLORS.white,
//   },

//   heroBalanceMeta: {
//     ...TYPE.subtext,
//     color: "rgba(255,255,255,0.80)",
//     marginTop: 6,
//   },

//   heroFooter: {
//     marginTop: SPACING.md,
//     flexDirection: "row",
//     flexWrap: "wrap",
//     gap: SPACING.sm,
//   },

//   statusPill: {
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: RADIUS.round,
//   },

//   statusPillText: {
//     ...TYPE.caption,
//     fontWeight: "800",
//     letterSpacing: 0.4,
//   },

//   rolePill: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: RADIUS.round,
//     backgroundColor: "rgba(255,255,255,0.12)",
//   },

//   rolePillText: {
//     ...TYPE.caption,
//     color: COLORS.white,
//     fontWeight: "800",
//   },

//   shortcutsWrap: {
//     gap: SPACING.md,
//   },

//   shortcutCard: {
//     padding: SPACING.md,
//     borderRadius: RADIUS.xl,
//     backgroundColor: COLORS.white,
//   },

//   shortcutLeft: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.md,
//     flex: 1,
//   },

//   shortcutIcon: {
//     width: 46,
//     height: 46,
//     borderRadius: RADIUS.lg,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   shortcutTitle: {
//     ...TYPE.title,
//     color: COLORS.text,
//     fontWeight: "800",
//     fontSize: 16,
//   },

//   shortcutSubtitle: {
//     ...TYPE.subtext,
//     marginTop: 4,
//     lineHeight: 18,
//   },

//   shortcutArrow: {
//     width: 34,
//     height: 34,
//     borderRadius: RADIUS.round,
//     alignItems: "center",
//     justifyContent: "center",
//     marginLeft: SPACING.md,
//   },

//   noticeCard: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.md,
//     padding: SPACING.md,
//     backgroundColor: COLORS.white,
//   },

//   noticeIcon: {
//     width: 40,
//     height: 40,
//     borderRadius: RADIUS.md,
//     backgroundColor: COLORS.infoSoft,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   noticeTitle: {
//     ...TYPE.bodyStrong,
//     color: COLORS.text,
//     fontWeight: "800",
//   },

//   noticeText: {
//     ...TYPE.subtext,
//     marginTop: 4,
//   },

//   actionsGrid: {
//     flexDirection: "row",
//     flexWrap: "wrap",
//     justifyContent: "space-between",
//     rowGap: SPACING.md,
//   },

//   actionCard: {
//     width: "48.2%",
//     minHeight: 188,
//     padding: SPACING.md,
//     borderRadius: RADIUS.xl,
//     justifyContent: "space-between",
//   },

//   actionCardFeatured: {
//     ...SHADOW.strong,
//   },

//   actionTop: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     marginBottom: SPACING.md,
//   },

//   actionIconWrap: {
//     width: 50,
//     height: 50,
//     borderRadius: RADIUS.lg,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   actionChip: {
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: RADIUS.round,
//   },

//   actionChipText: {
//     ...TYPE.caption,
//     fontWeight: "900",
//     letterSpacing: 0.5,
//   },

//   actionTitle: {
//     ...TYPE.title,
//     fontSize: 16,
//     lineHeight: 21,
//     fontWeight: "900",
//   },

//   actionTitleFeatured: {
//     fontSize: 17,
//   },

//   actionSubtitle: {
//     ...TYPE.subtext,
//     marginTop: 7,
//     lineHeight: 18,
//     fontSize: 13,
//   },

//   actionFooter: {
//     marginTop: SPACING.md,
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//   },

//   actionLink: {
//     ...TYPE.caption,
//     fontWeight: "900",
//     letterSpacing: 0.35,
//     fontSize: 12,
//   },

//   actionArrow: {
//     width: 34,
//     height: 34,
//     borderRadius: RADIUS.round,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   statsGrid: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     gap: SPACING.sm,
//   },

//   statCard: {
//     flex: 1,
//     padding: SPACING.md,
//     borderRadius: RADIUS.lg,
//     backgroundColor: COLORS.white,
//   },

//   statHeader: {
//     marginBottom: SPACING.sm,
//   },

//   statIcon: {
//     width: 38,
//     height: 38,
//     borderRadius: RADIUS.md,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   statLabel: {
//     ...TYPE.caption,
//     color: COLORS.textMuted,
//     fontWeight: "700",
//     letterSpacing: 0.2,
//   },

//   statValue: {
//     marginTop: 7,
//     fontSize: 16,
//     lineHeight: 22,
//     fontWeight: "900",
//     color: COLORS.text,
//   },

//   infoCard: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     gap: SPACING.md,
//     padding: SPACING.md,
//     backgroundColor: COLORS.white,
//   },

//   infoIcon: {
//     width: 40,
//     height: 40,
//     borderRadius: RADIUS.md,
//     backgroundColor: COLORS.infoSoft,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   infoTitle: {
//     ...TYPE.bodyStrong,
//     color: COLORS.text,
//     fontWeight: "800",
//   },

//   infoText: {
//     ...TYPE.subtext,
//     marginTop: 4,
//     lineHeight: 19,
//   },
// });