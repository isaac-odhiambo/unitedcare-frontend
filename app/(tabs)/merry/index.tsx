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
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { RADIUS, SPACING, TYPE } from "@/constants/theme";
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

const UI = {
  bg: "#EDF2F6",
  surface: "#F7FAFC",
  surfaceAlt: "#F1F5F8",
  card: "#F8FBFD",
  border: "#D8E1E8",
  text: "#334155",
  textSoft: "#64748B",
  textMuted: "#7C8A9A",
  accent: "#4C6A7A",
  accentSoft: "#E4EDF2",
  successBg: "#EAF6EF",
  successText: "#3B6B53",
  warningBg: "#FFF4E8",
  warningText: "#9A6530",
  dangerBg: "#FDEEEE",
  dangerText: "#A05252",
};

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
          <Ionicons name="cash-outline" size={20} color={UI.accent} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Contribution due</Text>
          <Text style={styles.heroSubtitle}>
            Complete your current merry contribution from here.
          </Text>
        </View>
      </View>

      <View style={styles.heroAmountBox}>
        <Text style={styles.heroAmountLabel}>Amount to pay now</Text>
        <Text style={styles.heroAmountValue}>{fmtKES(amount)}</Text>
      </View>

      <View style={{ marginTop: SPACING.md }}>
        <Button title="Contribute Now" onPress={onPress} />
      </View>
    </Card>
  );
}

function MyMerryCard({ item }: { item: MerryDueSummaryItem }) {
  const hasOverdue = hasAmount(item.overdue);
  const hasCurrent = hasAmount(item.current_due);
  const hasRequired = hasAmount(item.required_now);

  const badgeLabel = hasOverdue
    ? "Overdue"
    : hasCurrent
      ? "Due now"
      : "Up to date";

  const badgeStyle = hasOverdue
    ? styles.badgeDanger
    : hasCurrent
      ? styles.badgeAccent
      : styles.badgeSuccess;

  const badgeTextStyle = hasOverdue
    ? styles.badgeTextDanger
    : hasCurrent
      ? styles.badgeTextAccent
      : styles.badgeTextSuccess;

  return (
    <Card style={styles.myMerryCard} variant="default">
      <View style={styles.cardTop}>
        <View style={{ flex: 1, paddingRight: SPACING.sm }}>
          <Text style={styles.cardTitle}>{item.merry_name}</Text>
          <Text style={styles.cardSubtitle}>{getSeatSummary(item)}</Text>
        </View>

        <View style={[styles.badgeBase, badgeStyle]}>
          <Text style={[styles.badgeText, badgeTextStyle]}>{badgeLabel}</Text>
        </View>
      </View>

      <View style={styles.amountPanel}>
        <Text style={styles.amountPanelLabel}>Required now</Text>
        <Text style={styles.amountPanelValue}>{fmtKES(item.required_now)}</Text>
      </View>

      {hasAmount(item.overdue) ? (
        <Text style={styles.helperText}>Overdue: {fmtKES(item.overdue)}</Text>
      ) : null}

      {!hasRequired && hasAmount(item.next_due) ? (
        <Text style={styles.helperText}>
          Next due
          {item.next_due_date ? ` on ${item.next_due_date}` : ""} •{" "}
          {fmtKES(item.next_due)}
        </Text>
      ) : null}

      <View style={styles.cardActions}>
        <Button
          title="Contribute"
          onPress={() =>
            router.push({
              pathname: "/(tabs)/merry/contribute" as any,
              params: { merryId: String(item.merry_id) },
            })
          }
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
        ? "Join"
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
        <View style={{ flex: 1, paddingRight: SPACING.sm }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>
            {getFrequencyLabel(item)} • {item.seats_count} seat
            {Number(item.seats_count) === 1 ? "" : "s"}
          </Text>
        </View>

        <View style={styles.amountBadge}>
          <Text style={styles.amountBadgeText}>
            {fmtKES(item.contribution_amount)}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaPillNeutral}>
          <Text style={styles.metaPillText}>
            {item.available_seats == null
              ? "Unlimited seats"
              : `${item.available_seats} seat${
                  Number(item.available_seats) === 1 ? "" : "s"
                } left`}
          </Text>
        </View>

        <View style={styles.metaPillAccent}>
          <Text style={styles.metaPillText}>{joinStatus}</Text>
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
    <Card onPress={onPress} style={styles.quickLinkCard} variant="default">
      <View style={styles.quickLinkLeft}>
        <View style={styles.quickLinkIcon}>
          <Ionicons name={icon} size={18} color={UI.accent} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.quickLinkTitle}>{title}</Text>
          <Text style={styles.quickLinkSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={UI.textMuted} />
    </Card>
  );
}

export default function MerryIndexScreen() {
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

  const dueItems = useMemo(() => summary?.items ?? [], [summary]);
  const totalRequiredNow = moneyNumber(summary?.total_required_now);

  const firstPayableMerry = useMemo(() => {
    return (
      dueItems.find((item) => hasAmount(item.required_now)) ||
      dueItems.find((item) => hasAmount(item.current_due)) ||
      dueItems[0] ||
      null
    );
  }, [dueItems]);

  const myGroupsPreview = useMemo(() => dueItems.slice(0, 3), [dueItems]);

  const joinedMerryIds = useMemo(() => {
    const ids = new Set<number>();
    for (const item of dueItems) ids.add(Number(item.merry_id));
    for (const m of myMerries.memberships ?? []) ids.add(Number(m.merry_id));
    return ids;
  }, [dueItems, myMerries.memberships]);

  const availablePreview = useMemo(() => {
    return availableMerries
      .filter((item) => !joinedMerryIds.has(Number(item.id)))
      .slice(0, 4);
  }, [availableMerries, joinedMerryIds]);

  const firstJoinableMerry = useMemo(() => {
    return (
      availablePreview.find((item) => {
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
      }) || null
    );
  }, [availablePreview]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={UI.accent} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to access merry."
          actionLabel="Go to Login"
          onAction={() => router.replace("/(auth)/login" as any)}
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
      <View style={styles.headerBlock}>
        <Text style={styles.pageTitle}>Merry</Text>
        <Text style={styles.pageSubtitle}>
          View your groups, contribution status, and open merries to join.
        </Text>
      </View>

      {hasAmount(totalRequiredNow) && firstPayableMerry ? (
        <DueSummaryHero
          amount={totalRequiredNow}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/merry/contribute" as any,
              params: { merryId: String(firstPayableMerry.merry_id) },
            })
          }
        />
      ) : null}

      {error ? (
        <Card style={styles.errorCard} variant="default">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={UI.dangerText}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Section title="My Merry Groups">
        {myGroupsPreview.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No merry groups yet"
            subtitle="Join an open merry to start contributing with your group."
          />
        ) : (
          <>
            {myGroupsPreview.map((item) => (
              <MyMerryCard key={`due-${item.merry_id}`} item={item} />
            ))}
          </>
        )}
      </Section>

      <Section title="Available Merries">
        {availablePreview.length === 0 ? (
          <EmptyState
            icon="grid-outline"
            title="No open merries now"
            subtitle="Available merry groups will appear here."
          />
        ) : (
          <>
            {availablePreview.map((item) => (
              <AvailableMerryCard key={`available-${item.id}`} item={item} />
            ))}
          </>
        )}
      </Section>

      <Section title="Quick Access">
        <View style={styles.quickLinksList}>
          <QuickLink
            title="Contribution History"
            subtitle="View your merry payment activity"
            icon="time-outline"
            onPress={() => router.push("/(tabs)/merry/history" as any)}
          />

          {firstJoinableMerry ? (
            <QuickLink
              title="Join a Merry"
              subtitle="Go straight to join request"
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
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: 28,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.bg,
  },

  headerBlock: {
    marginBottom: SPACING.md,
  },

  pageTitle: {
    ...TYPE.h2,
    color: UI.text,
    fontWeight: "900",
  },

  pageSubtitle: {
    ...TYPE.subtext,
    color: UI.textSoft,
    marginTop: 4,
  },

  heroCard: {
    marginBottom: SPACING.lg,
    backgroundColor: UI.surfaceAlt,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: UI.border,
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
    backgroundColor: UI.accentSoft,
  },

  heroTitle: {
    ...TYPE.title,
    color: UI.text,
    fontWeight: "900",
  },

  heroSubtitle: {
    ...TYPE.subtext,
    color: UI.textSoft,
    marginTop: 4,
  },

  heroAmountBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.border,
  },

  heroAmountLabel: {
    ...TYPE.caption,
    color: UI.textMuted,
  },

  heroAmountValue: {
    ...TYPE.h2,
    marginTop: 4,
    color: UI.text,
    fontWeight: "900",
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "#EBCACA",
    backgroundColor: UI.dangerBg,
    borderRadius: RADIUS.xl,
  },

  errorText: {
    flex: 1,
    ...TYPE.subtext,
    color: UI.dangerText,
  },

  myMerryCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: UI.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: UI.border,
  },

  availableCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: UI.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: UI.border,
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  cardTitle: {
    ...TYPE.bodyStrong,
    color: UI.text,
    fontWeight: "800",
  },

  cardSubtitle: {
    ...TYPE.subtext,
    color: UI.textSoft,
    marginTop: 4,
    lineHeight: 18,
  },

  amountPanel: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.border,
  },

  amountPanelLabel: {
    ...TYPE.caption,
    color: UI.textMuted,
  },

  amountPanelValue: {
    ...TYPE.h3,
    marginTop: 4,
    color: UI.text,
    fontWeight: "900",
  },

  helperText: {
    ...TYPE.subtext,
    color: UI.textSoft,
    marginTop: SPACING.sm,
  },

  badgeBase: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },

  badgeAccent: {
    backgroundColor: UI.accentSoft,
  },

  badgeSuccess: {
    backgroundColor: UI.successBg,
  },

  badgeDanger: {
    backgroundColor: UI.warningBg,
  },

  badgeText: {
    ...TYPE.caption,
    fontWeight: "800",
  },

  badgeTextAccent: {
    color: UI.accent,
  },

  badgeTextSuccess: {
    color: UI.successText,
  },

  badgeTextDanger: {
    color: UI.warningText,
  },

  amountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.border,
  },

  amountBadgeText: {
    ...TYPE.caption,
    color: UI.text,
    fontWeight: "900",
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  metaPillNeutral: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: UI.surfaceAlt,
  },

  metaPillAccent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: UI.accentSoft,
  },

  metaPillText: {
    ...TYPE.caption,
    color: UI.text,
    fontWeight: "700",
  },

  cardActions: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  quickLinksList: {
    gap: SPACING.sm,
  },

  quickLinkCard: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: UI.card,
    borderWidth: 1,
    borderColor: UI.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  quickLinkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  quickLinkIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.accentSoft,
  },

  quickLinkTitle: {
    ...TYPE.bodyStrong,
    color: UI.text,
    fontWeight: "700",
  },

  quickLinkSubtitle: {
    ...TYPE.caption,
    color: UI.textSoft,
    marginTop: 2,
  },
});