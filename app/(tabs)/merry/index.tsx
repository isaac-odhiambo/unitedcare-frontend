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

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const BRAND_DARK = "#09586A";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.90)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.74)";
const SOFT_WHITE = "rgba(255,255,255,0.10)";
const SOFT_WHITE_2 = "rgba(255,255,255,0.14)";
const SURFACE_LIGHT = "rgba(255,255,255,0.72)";
const MERRY_CARD = "rgba(98, 192, 98, 0.23)";
const MERRY_BORDER = "rgba(194, 255, 188, 0.16)";
const MERRY_ICON_BG = "rgba(236, 255, 235, 0.76)";
const MERRY_ICON = "#379B4A";
const SUCCESS_BG = "rgba(34,197,94,0.16)";
const SUCCESS_TEXT = "#DCFCE7";
const WARNING_BG = "rgba(245,158,11,0.18)";
const WARNING_TEXT = "#FEF3C7";
const ACCENT_BG = "rgba(12,106,128,0.20)";
const ACCENT_TEXT = "#D9F3F9";

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

function getUserId(user?: MerryUser | null) {
  const raw =
    (user as any)?.id ??
    (user as any)?.user_id ??
    (user as any)?.pk ??
    null;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getMerryReferenceByUser(user?: MerryUser | null) {
  const userId = getUserId(user);
  return userId ? `MUS${userId}` : "MUS";
}

function SummaryTile({
  label,
  value,
  icon,
  onPress,
  actionLabel,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  actionLabel?: string;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      {...(onPress
        ? {
            activeOpacity: 0.92,
            onPress,
          }
        : {})}
      style={[
        styles.summaryTile,
        onPress ? styles.summaryTilePressable : null,
      ]}
    >
      <View style={styles.summaryIconWrap}>
        <Ionicons name={icon} size={16} color={BRAND} />
      </View>

      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>

      {actionLabel ? (
        <View style={styles.summaryActionRow}>
          <Text style={styles.summaryActionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={13} color={WHITE} />
        </View>
      ) : null}
    </Wrapper>
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
      <View style={styles.spaceGlowTop} />
      <View style={styles.spaceGlowBottom} />

      <View style={styles.heroTop}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="people-outline" size={20} color={MERRY_ICON} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.heroTitle}>Your merry contribution</Text>
          <Text style={styles.heroSubtitle}>
            Keep your circle active by contributing your share for this period.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        style={styles.heroAmountBox}
      >
        <View style={styles.heroAmountTopRow}>
          <Text style={styles.heroAmountLabel}>Ready now</Text>
          <View style={styles.heroAmountAction}>
            <Text style={styles.heroAmountActionText}>Contribute</Text>
            <Ionicons name="chevron-forward" size={14} color={WHITE} />
          </View>
        </View>

        <Text style={styles.heroAmountValue}>{fmtKES(amount)}</Text>
      </TouchableOpacity>

      <View style={styles.heroPillsRow}>
        <View style={styles.heroPill}>
          <Ionicons name="heart-outline" size={13} color={WHITE} />
          <Text style={styles.heroPillText}>Community first</Text>
        </View>

        <View style={styles.heroPill}>
          <Ionicons name="repeat-outline" size={13} color={WHITE} />
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
  onOpenDetail,
}: {
  item: MerryDueSummaryItem;
  onContribute: (item: MerryDueSummaryItem) => void;
  onOpenDetail: (item: MerryDueSummaryItem) => void;
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
    <Card style={styles.merryCard} variant="default">
      <View style={styles.spaceGlowTop} />
      <View style={styles.spaceGlowBottom} />

      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="people-outline" size={17} color={MERRY_ICON} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.merry_name}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={2}>
              {getSeatSummary(item)}
            </Text>
          </View>
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
          title="Details"
          variant="secondary"
          onPress={() => onOpenDetail(item)}
          style={{ flex: 1 }}
        />
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onOpenDetail(item)}
        style={styles.inlineAction}
      >
        <Text style={styles.inlineActionText}>View members and merry details</Text>
        <Ionicons name="chevron-forward" size={15} color={WHITE} />
      </TouchableOpacity>
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
    <Card style={styles.merryCard} variant="default">
      <View style={styles.spaceGlowTop} />
      <View style={styles.spaceGlowBottom} />

      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="sparkles-outline" size={17} color={MERRY_ICON} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={2}>
              {getFrequencyLabel(item)} • {item.seats_count} seat
              {Number(item.seats_count) === 1 ? "" : "s"}
            </Text>
          </View>
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
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.quickLinkCard}>
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

      <Ionicons name="chevron-forward" size={16} color={TEXT_ON_DARK_SOFT} />
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
  const [availableMerries, setAvailableMerries] = useState<AvailableMerryRow[]>([]);
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
    () => (Array.isArray(summary?.items) ? summary.items.slice(0, 4) : []),
    [summary]
  );

  const availablePreview = useMemo<AvailableMerryRow[]>(
    () => (Array.isArray(availableMerries) ? availableMerries.slice(0, 4) : []),
    [availableMerries]
  );

  const firstJoinableMerry = useMemo(
    () =>
      availableMerries.find((item) => {
        const requestStatus = String(item.my_join_request?.status || "").toUpperCase();

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

  const merryReference = useMemo(() => getMerryReferenceByUser(user), [user]);

  const onContribute = useCallback((item: MerryDueSummaryItem) => {
    router.push({
      pathname: "/(tabs)/merry/contribute" as any,
      params: { merryId: String(item.merry_id) },
    });
  }, []);

  const openMerryDetail = useCallback((item: MerryDueSummaryItem) => {
    router.push(`/(tabs)/merry/${item.merry_id}` as any);
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

  const openReadyNowContribution = useCallback(() => {
    const items = summary?.items ?? [];
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
        purpose: "MERRY_CONTRIBUTION",
        source: "merry",
        reference: merryReference,
        merryId: String(payable.merry_id),
        merry_id: String(payable.merry_id),
        amount: String(payable.required_now || payable.pay_with_next || 0),
        editableAmount: "true",
        title: "Merry Contribution",
        narration: `Merry contribution - ${payable.merry_name || "Merry"}`,
        subtitle: payable.merry_name || "Merry",
        returnTo: ROUTES.tabs.merry,
        backLabel: "Back to Merry",
        landingTitle: "Merry",
      },
    });
  }, [merryReference, summary]);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8CF0C7" />
        </View>
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
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 28, 36) },
        ]}
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
            <View style={styles.logoBadge}>
              <Ionicons name="people-outline" size={22} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.brandWordmark}>
                MERRY <Text style={styles.brandWordmarkGreen}>CIRCLE</Text>
              </Text>
              <Text style={styles.brandSub}>Community sharing space</Text>
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
              onPress={() => router.back()}
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroShell}>
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroOrbThree} />

          <Text style={styles.heroTag}>COMMUNITY MERRY</Text>

          <Text style={styles.pageTitle}>Grow together through merry</Text>

          <Text style={styles.pageSubtitle}>
            Join a circle, keep contributions flowing, and stay connected with your
            community in one simple space.
          </Text>

          <View style={styles.summaryRow}>
            <SummaryTile
              label="My merry"
              value={String(activeMerryCount)}
              icon="repeat-outline"
            />
            <SummaryTile
              label="Open spaces"
              value={String(totalOpenMerries)}
              icon="compass-outline"
            />
            <SummaryTile
              label="Ready now"
              value={fmtKES(totalRequiredNow)}
              icon="wallet-outline"
              onPress={openReadyNowContribution}
              actionLabel="Contribute"
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

        <Text style={styles.sectionTitle}>Your merry groups</Text>
        <Text style={styles.sectionSubtitle}>
          See your active merry spaces and continue contributing when ready.
        </Text>

        {myGroupsPreview.length === 0 ? (
          <View style={styles.emptyCardWrap}>
            <Card style={styles.emptyCard} variant="default">
              <EmptyState
                icon="people-outline"
                title="No merry groups yet"
                subtitle="Once you join a merry circle, your active groups will be shown here."
              />
            </Card>
          </View>
        ) : (
          <View style={styles.cardList}>
            {myGroupsPreview.map((item) => (
              <MyMerryCard
                key={`due-${item.merry_id}`}
                item={item}
                onContribute={onContribute}
                onOpenDetail={openMerryDetail}
              />
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Open merry spaces</Text>
        <Text style={styles.sectionSubtitle}>
          Explore community merry circles and join the one that fits you.
        </Text>

        {availablePreview.length === 0 ? (
          <View style={styles.emptyCardWrap}>
            <Card style={styles.emptyCard} variant="default">
              <EmptyState
                icon="grid-outline"
                title="No open merry spaces right now"
                subtitle="New community merry opportunities will show here as soon as they become available."
              />
            </Card>
          </View>
        ) : (
          <View style={styles.cardList}>
            {availablePreview.map((item) => (
              <AvailableMerryCard key={`available-${item.id}`} item={item} />
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Quick access</Text>
        <Text style={styles.sectionSubtitle}>
          Move to the next merry step with one tap.
        </Text>

        <View style={styles.quickLinksWrap}>
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

        <Card style={styles.communityCard} variant="default">
          <View style={styles.communityTop}>
            <View style={styles.communityIconWrap}>
              <Ionicons name="sparkles-outline" size={18} color={BRAND} />
            </View>
            <Text style={styles.communityTitle}>Why merry matters</Text>
          </View>

          <Text style={styles.communityText}>
            Merry helps members support one another through regular contribution,
            shared responsibility, and a stronger community bond.
          </Text>
        </Card>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    position: "relative",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: PAGE_BG,
  },

  emptyTitle: {
    color: WHITE,
    fontSize: 20,
    fontFamily: FONT.bold,
  },

  emptySubtitle: {
    color: TEXT_ON_DARK_SOFT,
    marginTop: 8,
    textAlign: "center",
    fontFamily: FONT.regular,
  },

  emptyButton: {
    marginTop: 16,
    backgroundColor: BRAND,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  emptyButtonText: {
    color: WHITE,
    fontFamily: FONT.bold,
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

  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  brandWordmark: {
    color: WHITE,
    fontSize: 17,
    fontFamily: FONT.bold,
    letterSpacing: 0.8,
  },

  brandWordmarkGreen: {
    color: "#74D16C",
  },

  brandSub: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 11,
    marginTop: 2,
    fontFamily: FONT.regular,
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

  heroShell: {
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
    backgroundColor: "rgba(42, 191, 120, 0.18)",
  },

  heroOrbThree: {
    position: "absolute",
    right: 70,
    bottom: -60,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  heroTag: {
    color: "#D8FFF0",
    fontSize: 11,
    letterSpacing: 1.1,
    marginBottom: 8,
    fontFamily: FONT.bold,
  },

  pageTitle: {
    color: WHITE,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONT.bold,
  },

  pageSubtitle: {
    color: TEXT_ON_DARK,
    marginTop: 8,
    lineHeight: 20,
    fontSize: 13,
    fontFamily: FONT.regular,
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
    backgroundColor: SOFT_WHITE_2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  summaryTilePressable: {
    borderColor: "rgba(255,255,255,0.22)",
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
    color: WHITE,
  },

  summaryActionRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  summaryActionText: {
    color: WHITE,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.lg,
    backgroundColor: MERRY_CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: MERRY_BORDER,
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
    backgroundColor: MERRY_ICON_BG,
  },

  heroTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  heroSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK,
    marginTop: 4,
  },

  heroAmountBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: SOFT_WHITE,
  },

  heroAmountTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  heroAmountLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK,
  },

  heroAmountAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  heroAmountActionText: {
    color: WHITE,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
  },

  heroAmountValue: {
    fontSize: 24,
    lineHeight: 30,
    marginTop: 4,
    fontFamily: FONT.bold,
    color: WHITE,
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
    backgroundColor: SOFT_WHITE,
  },

  heroPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
    color: WHITE,
  },

  sectionTitle: {
    color: WHITE,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  sectionSubtitle: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    marginBottom: SPACING.sm,
  },

  cardList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  merryCard: {
    position: "relative",
    overflow: "hidden",
    padding: 14,
    minHeight: 150,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: MERRY_BORDER,
    backgroundColor: MERRY_CARD,
    ...SHADOW.card,
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

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
    paddingRight: SPACING.sm,
  },

  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MERRY_ICON_BG,
  },

  cardTitle: {
    color: WHITE,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT.bold,
  },

  cardSubtitle: {
    color: TEXT_ON_DARK,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontFamily: FONT.medium,
  },

  badgeBase: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: "flex-start",
    maxWidth: "42%",
  },

  badgeAccent: {
    backgroundColor: ACCENT_BG,
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
    color: ACCENT_TEXT,
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
    borderRadius: 14,
    backgroundColor: SOFT_WHITE,
  },

  amountPanelLabel: {
    color: TEXT_ON_DARK,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
  },

  amountPanelValue: {
    marginTop: 4,
    color: WHITE,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FONT.bold,
  },

  helperText: {
    color: TEXT_ON_DARK,
    fontSize: 12,
    lineHeight: 18,
    marginTop: SPACING.sm,
    fontFamily: FONT.regular,
  },

  cardActions: {
    flexDirection: "row",
    marginTop: SPACING.md,
  },

  inlineAction: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  inlineActionText: {
    color: WHITE,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.medium,
  },

  amountBadge: {
    maxWidth: "42%",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SURFACE_LIGHT,
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
    backgroundColor: SURFACE_LIGHT,
  },

  metaPillAccent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SOFT_WHITE,
  },

  metaPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
    color: WHITE,
  },

  quickLinksWrap: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  quickLinkCard: {
    minHeight: 68,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
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
    backgroundColor: SURFACE_LIGHT,
  },

  quickLinkTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  quickLinkSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_SOFT,
  },

  communityCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: SPACING.md,
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
    backgroundColor: SURFACE_LIGHT,
  },

  communityTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  communityText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK,
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

  emptyCardWrap: {
    marginBottom: SPACING.lg,
  },

  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
});