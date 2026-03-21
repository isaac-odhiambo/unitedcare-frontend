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

import { ROUTES } from "@/constants/routes";
import { COLORS, RADIUS, SPACING, TYPE } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  fmtKES,
  getApiErrorMessage,
  getMyAllMerryDueSummary,
  getMyMerries,
  MerryDueSummaryItem,
  MyAllMerryDueSummaryResponse,
  MyMerriesResponse,
} from "@/services/merry";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryUser = Partial<MeResponse> & Partial<SessionUser>;

function hasAmount(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0;
}

function StatCard({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "warning" | "success";
}) {
  const tones = {
    primary: {
      bg: COLORS.primarySoft,
      icon: COLORS.primary,
      border: "rgba(14, 94, 111, 0.10)",
    },
    warning: {
      bg: COLORS.warningSoft,
      icon: COLORS.warning,
      border: "rgba(245, 158, 11, 0.10)",
    },
    success: {
      bg: COLORS.successSoft,
      icon: COLORS.success,
      border: "rgba(34, 197, 94, 0.10)",
    },
  };

  const t = tones[tone];

  return (
    <Card style={[styles.statCard, { borderColor: t.border }]} variant="default">
      <View style={[styles.statIconWrap, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={18} color={t.icon} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
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
          <Ionicons name={icon} size={15} color={COLORS.primary} />
        </View>
        <Text style={styles.miniLinkText}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </Card>
  );
}

function DueCard({ item }: { item: MerryDueSummaryItem }) {
  const hasOverdue = hasAmount(item.overdue);
  const hasCurrent = hasAmount(item.current_due);
  const hasNext = hasAmount(item.next_due);

  const statusLabel = hasOverdue
    ? "Overdue"
    : hasCurrent
      ? "Due now"
      : hasNext
        ? "Next due"
        : "Up to date";

  const statusTone = hasOverdue
    ? styles.badgeDanger
    : hasCurrent
      ? styles.badgeWarning
      : styles.badgeSuccess;

  return (
    <Card style={styles.dueCard} variant="default">
      <View style={styles.dueCardTop}>
        <View style={{ flex: 1, paddingRight: SPACING.sm }}>
          <Text style={styles.dueCardTitle}>{item.merry_name}</Text>
          <Text style={styles.dueCardSubtitle}>
            {item.seat_count} seat{item.seat_count === 1 ? "" : "s"}
            {item.seat_numbers?.length ? ` • ${item.seat_numbers.join(", ")}` : ""}
          </Text>
        </View>

        <View style={[styles.badgeBase, statusTone]}>
          <Text style={styles.badgeText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.amountBox}>
        <Text style={styles.amountBoxLabel}>Required now</Text>
        <Text style={styles.amountBoxValue}>{fmtKES(item.required_now)}</Text>
      </View>

      <View style={styles.metaList}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Overdue</Text>
          <Text style={styles.metaValue}>{fmtKES(item.overdue)}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Current due</Text>
          <Text style={styles.metaValue}>{fmtKES(item.current_due)}</Text>
        </View>

        {hasNext ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Next due</Text>
            <Text style={styles.metaValue}>
              {fmtKES(item.next_due)}
              {item.next_due_date ? ` • ${item.next_due_date}` : ""}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <Button
          title={hasAmount(item.required_now) ? "Contribute" : "Open"}
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
          title="Details"
          variant="secondary"
          onPress={() =>
            router.push(ROUTES.dynamic.merryDetail(item.merry_id) as any)
          }
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

export default function MerryIndexScreen() {
  const [user, setUser] = useState<MerryUser | null>(null);
  const [summary, setSummary] = useState<MyAllMerryDueSummaryResponse | null>(
    null
  );
  const [myMerries, setMyMerries] = useState<MyMerriesResponse>({
    created: [],
    memberships: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, summaryRes, merryRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyAllMerryDueSummary(),
        getMyMerries(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: MerryUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value);
      } else {
        setSummary(null);
        setError(
          getApiErrorMessage(summaryRes.reason) ||
            getErrorMessage(summaryRes.reason)
        );
      }

      if (merryRes.status === "fulfilled") {
        setMyMerries(merryRes.value ?? { created: [], memberships: [] });
      } else {
        setMyMerries({ created: [], memberships: [] });
        setError((prev) =>
          prev ||
          getApiErrorMessage(merryRes.reason) ||
          getErrorMessage(merryRes.reason)
        );
      }
    } catch (e: any) {
      setSummary(null);
      setMyMerries({ created: [], memberships: [] });
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

  const firstPayableMerry = useMemo(() => {
    const items = summary?.items ?? [];
    return (
      items.find((item) => hasAmount(item.required_now)) ||
      items.find((item) => hasAmount(item.pay_with_next)) ||
      items[0] ||
      null
    );
  }, [summary]);

  const totalRequiredNow = summary?.total_required_now ?? 0;
  const totalOverdue = summary?.total_overdue ?? 0;
  const totalCurrentDue = summary?.total_current_due ?? 0;
  const totalNextDue = summary?.total_next_due ?? 0;

  const activeCount = summary?.active_merries ?? myMerries.memberships.length;
  const totalSeats = summary?.total_seats ?? 0;

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
          subtitle="Please login to access merry."
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
      <Card style={styles.heroCard} variant="elevated">
        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: SPACING.md }}>
            <Text style={styles.heroEyebrow}>MERRY</Text>
            <Text style={styles.heroTitle}>My contributions</Text>
            <Text style={styles.heroSubtitle}>
              Quick view of what is due and where to continue.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="repeat-outline" size={22} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatLabel}>Active</Text>
            <Text style={styles.heroStatValue}>{activeCount}</Text>
          </View>

          <View style={styles.heroStatDivider} />

          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatLabel}>Seats</Text>
            <Text style={styles.heroStatValue}>{totalSeats}</Text>
          </View>
        </View>

        <View style={styles.heroAmountWrap}>
          <Text style={styles.heroAmountLabel}>Required now</Text>
          <Text style={styles.heroAmountValue}>{fmtKES(totalRequiredNow)}</Text>
        </View>

        <View style={{ marginTop: SPACING.md }}>
          <Button
            title={hasAmount(totalRequiredNow) ? "Contribute Now" : "Open Merry"}
            onPress={() => {
              const merryId =
                firstPayableMerry?.merry_id ?? myMerries.memberships[0]?.merry_id;

              if (merryId) {
                router.push({
                  pathname: "/(tabs)/merry/contribute" as any,
                  params: { merryId: String(merryId) },
                });
              } else {
                router.push(ROUTES.tabs.merryJoinRequests as any);
              }
            }}
          />
        </View>
      </Card>

      {error ? (
        <Card style={styles.errorCard} variant="default">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Section title="Totals">
        <View style={styles.statsRow}>
          <StatCard
            label="Overdue"
            value={fmtKES(totalOverdue)}
            icon="warning-outline"
            tone="warning"
          />
          <View style={{ width: SPACING.sm }} />
          <StatCard
            label="Due now"
            value={fmtKES(totalCurrentDue)}
            icon="calendar-outline"
            tone="primary"
          />
        </View>

        <View style={{ height: SPACING.sm }} />

        <View style={styles.statsRow}>
          <StatCard
            label="Next due"
            value={fmtKES(totalNextDue)}
            icon="arrow-forward-circle-outline"
            tone="success"
          />
          <View style={{ width: SPACING.sm }} />
          <StatCard
            label="Required"
            value={fmtKES(totalRequiredNow)}
            icon="cash-outline"
            tone="primary"
          />
        </View>
      </Section>

      <Section title="My Active Merries">
        {dueItems.length === 0 ? (
          <EmptyState
            icon="repeat-outline"
            title="No active merry yet"
            subtitle="Your merry summary will appear here after joining."
          />
        ) : (
          dueItems.map((item) => (
            <DueCard key={`due-${item.merry_id}`} item={item} />
          ))
        )}
      </Section>

      <Section title="More">
        <View style={styles.miniLinksWrap}>
          <MiniLink
            title="Payment History"
            icon="receipt-outline"
            onPress={() => router.push(ROUTES.tabs.merryPayments as any)}
          />
          <MiniLink
            title="Join Requests"
            icon="git-pull-request-outline"
            onPress={() => router.push(ROUTES.tabs.merryJoinRequests as any)}
          />
          <MiniLink
            title="Browse Merries"
            icon="grid-outline"
            onPress={() => router.push(ROUTES.tabs.merry as any)}
          />
        </View>
      </Section>

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
    borderWidth: 0,
    marginBottom: SPACING.lg,
    overflow: "hidden",
    borderRadius: 28,
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroEyebrow: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.76)",
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  heroTitle: {
    ...TYPE.h2,
    color: COLORS.white,
    marginTop: 6,
    fontWeight: "900",
  },

  heroSubtitle: {
    ...TYPE.subtext,
    color: "rgba(255,255,255,0.84)",
    marginTop: 8,
    lineHeight: 19,
  },

  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroStatsRow: {
    marginTop: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },

  heroStatBox: {
    flex: 1,
  },

  heroStatDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginHorizontal: SPACING.sm,
  },

  heroStatLabel: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.74)",
  },

  heroStatValue: {
    ...TYPE.title,
    color: COLORS.white,
    marginTop: 4,
    fontWeight: "900",
  },

  heroAmountWrap: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroAmountLabel: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.74)",
    fontWeight: "700",
  },

  heroAmountValue: {
    marginTop: 6,
    color: COLORS.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
  },

  errorText: {
    flex: 1,
    ...TYPE.subtext,
    color: COLORS.danger,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderRadius: 22,
  },

  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
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
    ...TYPE.title,
    marginTop: 4,
    fontWeight: "900",
    color: COLORS.text,
  },

  dueCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(14, 94, 111, 0.08)",
  },

  dueCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  dueCardTitle: {
    ...TYPE.title,
    fontWeight: "900",
    color: COLORS.text,
  },

  dueCardSubtitle: {
    ...TYPE.subtext,
    marginTop: 4,
    color: COLORS.textSoft,
  },

  badgeBase: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },

  badgeDanger: {
    backgroundColor: COLORS.dangerSoft,
  },

  badgeWarning: {
    backgroundColor: COLORS.warningSoft,
  },

  badgeSuccess: {
    backgroundColor: COLORS.successSoft,
  },

  badgeText: {
    ...TYPE.caption,
    fontWeight: "800",
    color: COLORS.text,
  },

  amountBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
  },

  amountBoxLabel: {
    ...TYPE.caption,
    color: COLORS.textMuted,
  },

  amountBoxValue: {
    ...TYPE.h3,
    marginTop: 4,
    color: COLORS.primary,
    fontWeight: "900",
  },

  metaList: {
    marginTop: SPACING.md,
    gap: 10,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  metaLabel: {
    ...TYPE.caption,
    color: COLORS.textMuted,
  },

  metaValue: {
    flexShrink: 1,
    textAlign: "right",
    ...TYPE.bodyStrong,
    color: COLORS.text,
  },

  actionRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
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
});