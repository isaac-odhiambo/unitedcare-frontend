// app/(tabs)/merry/index.tsx
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  AvailableMerryRow,
  fmtKES,
  getApiErrorMessage,
  getAvailableMerries,
  getMyAllMerryDueSummary,
  getMyMerries,
  MerryDueSummaryItem,
  MyAllMerryDueSummaryResponse,
  MyMerriesResponse,
} from "@/services/merry";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryUser = Partial<MeResponse> & Partial<SessionUser>;

const BRAND = "#0C6A80";
const MUTED_BG = "rgba(255,255,255,0.60)";
const BRAND_DARK = "#09586A";
const PAGE_BG = "#0C6A80";
const CARD_BG = "#EEF7F9";
const SURFACE_SOFT = "rgba(255,255,255,0.72)";
const BRAND_SOFT = "rgba(12,106,128,0.10)";
const BRAND_SOFT_2 = "rgba(12,106,128,0.16)";
const SUCCESS_BG = "rgba(55,155,74,0.12)";
const SUCCESS_TEXT = "#2F7A43";
const WARNING_BG = "rgba(245,158,11,0.12)";
const WARNING_TEXT = "#9A6700";
const TEXT = COLORS.text || "#17323B";
const TEXT_MUTED = COLORS.textMuted || "#6E7F89";

function moneyNumber(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function hasAmount(value?: string | number | null) {
  return moneyNumber(value) > 0;
}

function getFrequencyLabel(item: AvailableMerryRow) {
  const freq = String(item.payout_frequency || "").toUpperCase();
  const perPeriod = Number(item.payouts_per_period || 1);

  if (freq === "MONTHLY") {
    return perPeriod > 1 ? `${perPeriod} times monthly` : "Monthly";
  }

  return perPeriod > 1 ? `${perPeriod} times weekly` : "Weekly";
}

function getJoinStatusText(item: AvailableMerryRow) {
  const status = String(item.my_join_request?.status || "").toUpperCase();

  if (item.is_member) return "Joined";
  if (status === "PENDING") return "Request pending";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Request rejected";
  if (!item.is_open) return "Closed";
  if (item.available_seats !== null && Number(item.available_seats) <= 0) {
    return "Full";
  }
  if (item.can_request_join) return "Open to join";
  return "View merry";
}

function getSeatSummary(item: MerryDueSummaryItem) {
  const count = Number(item.seat_count ?? 0);
  const numbers = Array.isArray(item.seat_numbers) ? item.seat_numbers : [];

  if (numbers.length > 0) {
    return `Seats: ${count} • ${numbers.join(", ")}`;
  }

  return `Seats: ${count}`;
}

function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryTile}>
      <View style={styles.summaryIconWrap}>
        <Ionicons name={icon} size={16} color={BRAND} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function DueSummaryHero({
  amount,
  onPress,
}: {
  amount: number;
  onPress: () => void;
}) {
  return (
    <Card style={styles.heroCard} variant="default">
      <View style={styles.heroTop}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="people-outline" size={20} color={BRAND} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.heroTitle}>Your merry contribution</Text>
          <Text style={styles.heroSubtitle}>
            Support your merry space by contributing your share for this period.
          </Text>
        </View>
      </View>

      <View style={styles.heroAmountBox}>
        <Text style={styles.heroAmountLabel}>Ready for contribution</Text>
        <Text style={styles.heroAmountValue}>{fmtKES(amount)}</Text>
      </View>

      <View style={styles.heroPillsRow}>
        <View style={styles.heroPill}>
          <Ionicons name="heart-outline" size={13} color={BRAND} />
          <Text style={styles.heroPillText}>Community first</Text>
        </View>

        <View style={styles.heroPill}>
          <Ionicons name="repeat-outline" size={13} color={BRAND} />
          <Text style={styles.heroPillText}>Shared support</Text>
        </View>
      </View>

      <View style={{ marginTop: SPACING.md }}>
        <Button title="Contribute to Merry" onPress={onPress} />
      </View>
    </Card>
  );
}

function MyMerryCard({
  item,
  onContribute,
}: {
  item: MerryDueSummaryItem;
  onContribute: (item: MerryDueSummaryItem) => void;
}) {
  const hasOverdue = hasAmount(item.overdue);
  const hasCurrent = hasAmount(item.current_due);
  const hasRequired = hasAmount(item.required_now);

  const badgeLabel = hasOverdue
    ? "Needs attention"
    : hasCurrent
    ? "Due this period"
    : "Up to date";

  const badgeStyle = hasOverdue
    ? styles.badgeWarning
    : hasCurrent
    ? styles.badgeAccent
    : styles.badgeSuccess;

  const badgeTextStyle = hasOverdue
    ? styles.badgeTextWarning
    : hasCurrent
    ? styles.badgeTextAccent
    : styles.badgeTextSuccess;

  return (
    <Card style={styles.myMerryCard} variant="default">
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.merry_name}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={2}>
            {getSeatSummary(item)}
          </Text>
        </View>

        <View style={[styles.badgeBase, badgeStyle]}>
          <Text style={[styles.badgeText, badgeTextStyle]} numberOfLines={1}>
            {badgeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.amountPanel}>
        <Text style={styles.amountPanelLabel}>Your share for now</Text>
        <Text
          style={styles.amountPanelValue}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {fmtKES(item.required_now)}
        </Text>
      </View>

      {hasAmount(item.overdue) ? (
        <Text style={styles.helperText}>
          Pending from earlier: {fmtKES(item.overdue)}
        </Text>
      ) : null}

      {!hasRequired && hasAmount(item.next_due) ? (
        <Text style={styles.helperText}>
          Next contribution
          {item.next_due_date ? ` on ${item.next_due_date}` : ""} •{" "}
          {fmtKES(item.next_due)}
        </Text>
      ) : null}

      <View style={styles.cardActions}>
        <Button
          title="Contribute"
          onPress={() => onContribute(item)}
          style={{ flex: 1 }}
        />
        <View style={{ width: SPACING.sm }} />
        <Button
          title="Open"
          variant="secondary"
          onPress={() => router.push(`/(tabs)/merry/${item.merry_id}` as any)}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

function AvailableMerryCard({ item }: { item: AvailableMerryRow }) {
  const joinStatus = getJoinStatusText(item);
  const requestStatus = String(item.my_join_request?.status || "").toUpperCase();

  const canJoinDirect =
    !item.is_member &&
    item.can_request_join &&
    item.is_open !== false &&
    (item.available_seats == null || Number(item.available_seats) > 0) &&
    requestStatus !== "PENDING" &&
    requestStatus !== "APPROVED";

  const primaryTitle = item.is_member
    ? "Open Merry"
    : requestStatus === "PENDING"
    ? "Open Request"
    : canJoinDirect
    ? "Join Merry"
    : "Open Merry";

  const onPrimaryPress = () => {
    if (item.is_member) {
      router.push(`/(tabs)/merry/${item.id}` as any);
      return;
    }

    if (requestStatus === "PENDING") {
      router.push(`/(tabs)/merry/${item.id}` as any);
      return;
    }

    if (canJoinDirect) {
      router.push({
        pathname: "/(tabs)/merry/join-request" as any,
        params: { merryId: String(item.id) },
      });
      return;
    }

    router.push(`/(tabs)/merry/${item.id}` as any);
  };

  return (
    <Card style={styles.availableCard} variant="default">
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={2}>
            {getFrequencyLabel(item)} • {item.seats_count} seat
            {Number(item.seats_count) === 1 ? "" : "s"}
          </Text>
        </View>

        <View style={styles.amountBadge}>
          <Text style={styles.amountBadgeText} numberOfLines={1}>
            {fmtKES(item.contribution_amount)}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaPillNeutral}>
          <Text style={styles.metaPillText} numberOfLines={1}>
            {item.available_seats == null
              ? "Unlimited seats"
              : `${item.available_seats} seat${
                  Number(item.available_seats) === 1 ? "" : "s"
                } left`}
          </Text>
        </View>

        <View style={styles.metaPillAccent}>
          <Text style={styles.metaPillText} numberOfLines={1}>
            {joinStatus}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Button
          title={primaryTitle}
          onPress={onPrimaryPress}
          style={{ flex: 1 }}
        />
        <View style={{ width: SPACING.sm }} />
        <Button
          title="View"
          variant="secondary"
          onPress={() => router.push(`/(tabs)/merry/${item.id}` as any)}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

function QuickLink({
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
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.quickLinkCard}>
      <View style={styles.quickLinkLeft}>
        <View style={styles.quickLinkIcon}>
          <Ionicons name={icon} size={18} color={BRAND} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.quickLinkTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.quickLinkSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
    </TouchableOpacity>
  );
}

export default function MerryIndexScreen() {
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<MerryUser | null>(null);
  const [summary, setSummary] =
    useState<MyAllMerryDueSummaryResponse | null>(null);
  const [myMerries, setMyMerries] = useState<MyMerriesResponse>({
    created: [],
    memberships: [],
  });
  const [availableMerries, setAvailableMerries] = useState<AvailableMerryRow[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, summaryRes, myMerriesRes, availableRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getMyAllMerryDueSummary(),
          getMyMerries(),
          getAvailableMerries(),
        ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      setUser(
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null
      );

      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value);
      } else {
        setSummary(null);
      }

      if (myMerriesRes.status === "fulfilled") {
        setMyMerries(myMerriesRes.value ?? { created: [], memberships: [] });
      } else {
        setMyMerries({ created: [], memberships: [] });
      }

      if (availableRes.status === "fulfilled") {
        setAvailableMerries(availableRes.value ?? []);
      } else {
        setAvailableMerries([]);
      }

      const errors: string[] = [];

      if (summaryRes.status === "rejected") {
        errors.push(
          getApiErrorMessage(summaryRes.reason) ||
            getErrorMessage(summaryRes.reason)
        );
      }

      if (availableRes.status === "rejected") {
        errors.push(
          getApiErrorMessage(availableRes.reason) ||
            getErrorMessage(availableRes.reason)
        );
      }

      setError(errors.filter(Boolean).join(" • "));
    } catch (e: any) {
      setSummary(null);
      setMyMerries({ created: [], memberships: [] });
      setAvailableMerries([]);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, []);

  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);
      await load();
    } finally {
      setLoading(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      initialLoad();
    }, [initialLoad])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const myGroupsPreview = useMemo<MerryDueSummaryItem[]>(
    () => (Array.isArray(summary?.items) ? summary?.items.slice(0, 4) : []),
    [summary]
  );

  const availablePreview = useMemo<AvailableMerryRow[]>(
    () => (Array.isArray(availableMerries) ? availableMerries.slice(0, 4) : []),
    [availableMerries]
  );

  const firstJoinableMerry = useMemo(
    () =>
      availableMerries.find((item) => {
        const requestStatus = String(
          item.my_join_request?.status || ""
        ).toUpperCase();

        return (
          !item.is_member &&
          item.can_request_join &&
          item.is_open !== false &&
          (item.available_seats == null || Number(item.available_seats) > 0) &&
          requestStatus !== "PENDING" &&
          requestStatus !== "APPROVED"
        );
      }) || null,
    [availableMerries]
  );

  const totalRequiredNow = useMemo(
    () => moneyNumber(summary?.total_required_now),
    [summary]
  );

  const activeMerryCount = useMemo(
    () => (Array.isArray(summary?.items) ? summary.items.length : 0),
    [summary]
  );

  const totalOpenMerries = useMemo(
    () => availableMerries.length,
    [availableMerries]
  );

  const onContribute = useCallback((item: MerryDueSummaryItem) => {
    router.push({
      pathname: "/(tabs)/merry/contribute" as any,
      params: { merryId: String(item.merry_id) },
    });
  }, []);

  const openHeroContribution = useCallback(() => {
    const items = summary?.items ?? [];
    const payable =
      items.find((item) => hasAmount(item.required_now)) ||
      items.find((item) => hasAmount(item.pay_with_next)) ||
      items[0];

    if (!payable) {
      router.push(ROUTES.tabs.merry as any);
      return;
    }

    router.push({
      pathname: "/(tabs)/merry/contribute" as any,
      params: { merryId: String(payable.merry_id) },
    });
  }, [summary]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={BRAND} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <EmptyState
            title="Not signed in"
            subtitle="Login to continue"
            actionLabel="Login"
            onAction={() => router.replace(ROUTES.auth.login as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 28, 36) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND}
            colors={[BRAND]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroShell}>
          <View style={styles.heroShellTop}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color={BRAND} />
            </TouchableOpacity>

            <View style={styles.heroBadge}>
              <Ionicons name="people-outline" size={14} color={BRAND} />
              <Text style={styles.heroBadgeText}>Community merry space</Text>
            </View>
          </View>

          <Text style={styles.pageTitle}>Merry</Text>
          <Text style={styles.pageSubtitle}>
            Join, contribute, and keep your merry circle active with simple shared
            participation.
          </Text>

          <View style={styles.summaryRow}>
            <SummaryTile
              label="My active merry"
              value={String(activeMerryCount)}
              icon="repeat-outline"
            />
            <SummaryTile
              label="Open merry"
              value={String(totalOpenMerries)}
              icon="compass-outline"
            />
            <SummaryTile
              label="Ready now"
              value={fmtKES(totalRequiredNow)}
              icon="wallet-outline"
            />
          </View>
        </View>

        {error ? (
          <Card style={styles.errorCard} variant="default">
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.danger || "#DC2626"}
            />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <DueSummaryHero amount={totalRequiredNow} onPress={openHeroContribution} />

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Your merry groups</Text>
          <Text style={styles.sectionSubtitle}>
            See your active merry spaces and continue contributing when ready.
          </Text>

          {myGroupsPreview.length === 0 ? (
            <Card style={styles.emptyCard} variant="default">
              <EmptyState
                icon="people-outline"
                title="No merry groups yet"
                subtitle="When you join a merry, it will appear here."
              />
            </Card>
          ) : (
            <View style={styles.cardList}>
              {myGroupsPreview.map((item) => (
                <MyMerryCard
                  key={`due-${item.merry_id}`}
                  item={item}
                  onContribute={onContribute}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Open merry spaces</Text>
          <Text style={styles.sectionSubtitle}>
            Explore community merry circles and join the one that fits you.
          </Text>

          {availablePreview.length === 0 ? (
            <Card style={styles.emptyCard} variant="default">
              <EmptyState
                icon="grid-outline"
                title="No open merry now"
                subtitle="New merry opportunities will appear here."
              />
            </Card>
          ) : (
            <View style={styles.cardList}>
              {availablePreview.map((item) => (
                <AvailableMerryCard key={`available-${item.id}`} item={item} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Quick access</Text>
          <Text style={styles.sectionSubtitle}>
            Open the next merry step in one tap.
          </Text>

          <View style={styles.quickLinksList}>
            <QuickLink
              title="Your Contributions"
              subtitle="See how you’ve been supporting your merry"
              icon="time-outline"
              onPress={() => router.push("/(tabs)/merry/history" as any)}
            />

            {firstJoinableMerry ? (
              <QuickLink
                title="Join a Merry"
                subtitle="Open a merry and send your join request"
                icon="person-add-outline"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/merry/join-request" as any,
                    params: { merryId: String(firstJoinableMerry.id) },
                  })
                }
              />
            ) : null}
          </View>
        </View>

        <Card style={styles.communityCard} variant="default">
          <View style={styles.communityTop}>
            <View style={styles.communityIconWrap}>
              <Ionicons name="sparkles-outline" size={18} color={BRAND} />
            </View>
            <Text style={styles.communityTitle}>Why merry matters</Text>
          </View>

          <Text style={styles.communityText}>
            Merry makes it easier for members to support one another through
            consistent contribution, shared responsibility, and a strong sense of
            community.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    padding: SPACING.md,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
  },

  heroShell: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: BRAND,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  heroShellTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },

  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    maxWidth: "72%",
  },

  heroBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
    color: COLORS.white,
    flexShrink: 1,
  },

  pageTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONT.bold,
    color: COLORS.white,
  },

  pageSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
    color: "rgba(255,255,255,0.90)",
  },

  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
    marginTop: SPACING.md,
  },

  summaryTile: {
    flexGrow: 1,
    minWidth: 94,
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  summaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    marginBottom: 8,
  },

  summaryLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: FONT.regular,
    color: "rgba(255,255,255,0.80)",
  },

  summaryValue: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: FONT.bold,
    color: COLORS.white,
  },

  heroCard: {
    marginBottom: SPACING.md,
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
    ...SHADOW.card,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_SOFT,
  },

  heroTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  heroSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_MUTED,
    marginTop: 4,
  },

  heroAmountBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: SURFACE_SOFT,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
  },

  heroAmountLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    color: TEXT_MUTED,
  },

  heroAmountValue: {
    fontSize: 24,
    lineHeight: 30,
    marginTop: 4,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  heroPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
    marginTop: SPACING.md,
  },

  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: BRAND_SOFT,
  },

  heroPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
    color: BRAND,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    backgroundColor: "#FFF1F2",
    borderRadius: RADIUS.xl,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.danger || "#DC2626",
  },

  sectionBlock: {
    marginTop: SPACING.md,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  sectionSubtitle: {
    marginTop: 4,
    marginBottom: SPACING.sm,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_MUTED,
  },

  cardList: {
    gap: SPACING.sm,
  },

  myMerryCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
    borderRadius: RADIUS.xl,
    ...SHADOW.card,
  },

  availableCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
    borderRadius: RADIUS.xl,
    ...SHADOW.card,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: SPACING.sm,
  },

  cardTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  cardSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_MUTED,
    marginTop: 4,
  },

  badgeBase: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: "flex-start",
    maxWidth: "42%",
  },

  badgeAccent: {
    backgroundColor: BRAND_SOFT,
  },

  badgeSuccess: {
    backgroundColor: SUCCESS_BG,
  },

  badgeWarning: {
    backgroundColor: WARNING_BG,
  },

  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
  },

  badgeTextAccent: {
    color: BRAND,
  },

  badgeTextSuccess: {
    color: SUCCESS_TEXT,
  },

  badgeTextWarning: {
    color: WARNING_TEXT,
  },

  amountPanel: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: SURFACE_SOFT,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
  },

  amountPanelLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    color: TEXT_MUTED,
  },

  amountPanelValue: {
    marginTop: 4,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  helperText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_MUTED,
  },

  cardActions: {
    flexDirection: "row",
    marginTop: SPACING.md,
  },

  amountBadge: {
    maxWidth: "42%",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: SURFACE_SOFT,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
    alignSelf: "flex-start",
  },

  amountBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
    marginTop: SPACING.md,
  },

  metaPillNeutral: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: MUTED_BG,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
  },

  metaPillAccent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BRAND_SOFT,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
  },

  metaPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
    color: TEXT,
  },

  quickLinksList: {
    gap: SPACING.sm,
  },

  quickLinkCard: {
    minHeight: 68,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    ...SHADOW.card,
  },

  quickLinkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
    minWidth: 0,
  },

  quickLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_SOFT,
  },

  quickLinkTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  quickLinkSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.regular,
    color: TEXT_MUTED,
  },

  communityCard: {
    marginTop: SPACING.md,
    backgroundColor: CARD_BG,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
    ...SHADOW.card,
  },

  communityTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  communityIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_SOFT,
  },

  communityTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  communityText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
    color: TEXT,
  },

  emptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
    ...SHADOW.card,
  },
});