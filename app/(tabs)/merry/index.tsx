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
  AvailableMerryRow,
  fmtKES,
  getApiErrorMessage,
  getAvailableMerries,
  getMyMerries,
  MyMerriesResponse,
  requestToJoinMerry,
} from "@/services/merry";
import {
  canJoinMerry,
  canWithdraw,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryUser = Partial<MeResponse> & Partial<SessionUser>;

const MERRY_EXTRA_ROUTES = {
  members: "/(tabs)/merry/members",
  payoutsSchedule: "/(tabs)/merry/payouts-schedule",
  adminJoinRequests: "/(tabs)/merry/admin-join-requests",
  adminPayoutCreate: "/(tabs)/merry/admin-payout-create",
} as const;

function toNum(x?: string | number) {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function statusText(status?: string | null) {
  if (!status) return "None";
  return String(status).replaceAll("_", " ");
}

function MetricCard({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "warning" | "info";
}) {
  const tones = {
    primary: { bg: COLORS.primarySoft, icon: COLORS.primary },
    success: { bg: COLORS.successSoft, icon: COLORS.success },
    warning: { bg: COLORS.warningSoft, icon: COLORS.warning },
    info: { bg: COLORS.infoSoft, icon: COLORS.info },
  };

  const t = tones[tone];

  return (
    <Card style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={18} color={t.icon} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{String(value)}</Text>
    </Card>
  );
}

function QuickLink({
  title,
  subtitle,
  icon,
  onPress,
  tone = "primary",
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: "primary" | "success" | "warning" | "info";
}) {
  const tones = {
    primary: { bg: "#EEF8FA", iconBg: COLORS.primarySoft, icon: COLORS.primary },
    success: { bg: "#F1FAF2", iconBg: COLORS.successSoft, icon: COLORS.success },
    warning: { bg: "#FFF8EB", iconBg: COLORS.warningSoft, icon: COLORS.warning },
    info: { bg: "#EFF6FF", iconBg: COLORS.infoSoft, icon: COLORS.info },
  };

  const t = tones[tone];

  return (
    <Card onPress={onPress} style={[styles.quickCard, { backgroundColor: t.bg }]}>
      <View style={styles.quickTop}>
        <View style={[styles.quickIcon, { backgroundColor: t.iconBg }]}>
          <Ionicons name={icon} size={18} color={t.icon} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />
      </View>

      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSubtitle}>{subtitle}</Text>
    </Card>
  );
}

function NoticeCard({
  icon,
  title,
  text,
  buttonLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  buttonLabel?: string;
  onPress?: () => void;
}) {
  return (
    <Card style={styles.noticeCard} variant="soft">
      <View style={styles.noticeTop}>
        <View style={styles.noticeIconWrap}>
          <Ionicons name={icon} size={18} color={COLORS.info} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>{title}</Text>
          <Text style={styles.noticeText}>{text}</Text>
        </View>
      </View>

      {buttonLabel && onPress ? (
        <View style={{ marginTop: SPACING.md }}>
          <Button title={buttonLabel} variant="secondary" onPress={onPress} />
        </View>
      ) : null}
    </Card>
  );
}

function MiniAction({
  title,
  onPress,
  tone = "primary",
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  tone?: "primary" | "success" | "warning" | "info" | "danger";
  disabled?: boolean;
}) {
  const tones = {
    primary: {
      bg: COLORS.primarySoft,
      text: COLORS.primary,
      border: "rgba(14, 94, 111, 0.18)",
    },
    success: {
      bg: COLORS.successSoft,
      text: COLORS.success,
      border: "rgba(46, 125, 50, 0.18)",
    },
    warning: {
      bg: COLORS.warningSoft,
      text: COLORS.warning,
      border: "rgba(245, 158, 11, 0.18)",
    },
    info: {
      bg: COLORS.infoSoft,
      text: COLORS.info,
      border: "rgba(37, 99, 235, 0.18)",
    },
    danger: {
      bg: COLORS.dangerSoft,
      text: COLORS.danger,
      border: "rgba(220, 38, 38, 0.18)",
    },
  };

  const t = tones[tone];

  return (
    <Text
      onPress={disabled ? undefined : onPress}
      style={[
        styles.miniAction,
        {
          backgroundColor: disabled ? COLORS.gray100 : t.bg,
          color: disabled ? COLORS.gray500 : t.text,
          borderColor: disabled ? COLORS.border : t.border,
        },
      ]}
    >
      {title}
    </Text>
  );
}

function AvailableMerryCard({
  item,
  merryAllowed,
  alreadyMember,
  joining,
  onJoin,
}: {
  item: AvailableMerryRow;
  merryAllowed: boolean;
  alreadyMember: boolean;
  joining: boolean;
  onJoin: () => void;
}) {
  const isOpen = !!item.is_open;
  const joinStatus = item.my_join_request?.status ?? null;
  const isPending = joinStatus === "PENDING";
  const noSeatsLeft =
    item.available_seats !== null &&
    item.available_seats !== undefined &&
    Number(item.available_seats) <= 0;

  const availableSeats =
    item.available_seats === null || item.available_seats === undefined
      ? "Unlimited"
      : String(item.available_seats);

  const buttonDisabled =
    !merryAllowed || !isOpen || isPending || alreadyMember || noSeatsLeft || joining;

  const joinLabel = joining
    ? "Submitting"
    : alreadyMember
      ? "Joined"
      : isPending
        ? "Pending"
        : !isOpen
          ? "Closed"
          : noSeatsLeft
            ? "Full"
            : "Join";

  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={{ flex: 1, paddingRight: SPACING.sm }}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>
            {fmtKES(item.contribution_amount)} per seat
          </Text>
        </View>

        <View
          style={[
            styles.statePill,
            { backgroundColor: isOpen ? COLORS.successSoft : COLORS.dangerSoft },
          ]}
        >
          <Text
            style={[
              styles.statePillText,
              { color: isOpen ? COLORS.success : COLORS.danger },
            ]}
          >
            {isOpen ? "OPEN" : "CLOSED"}
          </Text>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Frequency</Text>
          <Text style={styles.metaValue}>{item.payout_frequency}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Slots</Text>
          <Text style={styles.metaValue}>{String(item.payouts_per_period)}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Members</Text>
          <Text style={styles.metaValue}>{String(item.members_count)}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Seats left</Text>
          <Text style={styles.metaValue}>{availableSeats}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Request</Text>
          <Text style={styles.metaValue}>
            {alreadyMember ? "Joined" : statusText(joinStatus)}
          </Text>
        </View>
      </View>

      <View style={styles.miniActionsRow}>
        <MiniAction
          title="Open"
          tone="info"
          onPress={() => router.push(ROUTES.dynamic.merryDetail(item.id) as any)}
        />
        <MiniAction
          title={joinLabel}
          tone={alreadyMember || isPending ? "warning" : "success"}
          onPress={onJoin}
          disabled={buttonDisabled}
        />
      </View>
    </Card>
  );
}

function MembershipCard({ item }: { item: any }) {
  const perSeat = toNum(item.contribution_amount);
  const slots = Number(item.payouts_per_period || 1);
  const seats = Number(item.seats_count || 0);
  const requiredPerPeriod = perSeat * slots * seats;

  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={{ flex: 1, paddingRight: SPACING.sm }}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>
            {fmtKES(item.contribution_amount)} per seat
          </Text>
        </View>

        <View style={[styles.statePill, { backgroundColor: COLORS.primarySoft }]}>
          <Text style={[styles.statePillText, { color: COLORS.primary }]}>
            {String(item.payout_order_type || "MERRY").toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>My seats</Text>
          <Text style={styles.metaValue}>{seats > 0 ? String(seats) : "—"}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Required / period</Text>
          <Text style={styles.metaValue}>{fmtKES(requiredPerPeriod)}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status</Text>
          <Text style={styles.metaValue}>
            {item.is_open === false ? "Closed" : "Open"}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Next payout</Text>
          <Text style={styles.metaValue}>{item.next_payout_date ?? "—"}</Text>
        </View>
      </View>

      <View style={styles.miniActionsRow}>
        <MiniAction
          title="Open"
          tone="info"
          onPress={() =>
            router.push(ROUTES.dynamic.merryDetail(item.merry_id) as any)
          }
        />
        <MiniAction
          title="Contribute"
          tone="success"
          onPress={() =>
            router.push({
              pathname: ROUTES.tabs.merryContribute as any,
              params: { merryId: String(item.merry_id) },
            })
          }
        />
      </View>
    </Card>
  );
}

function AdminCreatedCard({ item }: { item: any }) {
  const perSeat = toNum(item.contribution_amount);
  const seats = Number(item.seats_count || 0);
  const totalExpectedPerSlot = perSeat * seats;

  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={{ flex: 1, paddingRight: SPACING.sm }}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>
            {fmtKES(item.contribution_amount)} per seat
          </Text>
        </View>

        <View style={[styles.statePill, { backgroundColor: COLORS.infoSoft }]}>
          <Text style={[styles.statePillText, { color: COLORS.info }]}>
            ADMIN
          </Text>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Members</Text>
          <Text style={styles.metaValue}>{String(item.members_count)}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Seats</Text>
          <Text style={styles.metaValue}>{String(seats)}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Expected / slot</Text>
          <Text style={styles.metaValue}>{fmtKES(totalExpectedPerSlot)}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Next payout</Text>
          <Text style={styles.metaValue}>{item.next_payout_date ?? "—"}</Text>
        </View>
      </View>

      <View style={styles.miniActionsRow}>
        <MiniAction
          title="Open"
          tone="info"
          onPress={() => router.push(ROUTES.dynamic.merryDetail(item.id) as any)}
        />
        <MiniAction
          title="Requests"
          tone="warning"
          onPress={() =>
            router.push({
              pathname: MERRY_EXTRA_ROUTES.adminJoinRequests as any,
              params: { merryId: String(item.id) },
            })
          }
        />
      </View>
    </Card>
  );
}

export default function MerryIndexScreen() {
  const [user, setUser] = useState<MerryUser | null>(null);
  const [data, setData] = useState<MyMerriesResponse>({
    created: [],
    memberships: [],
  });
  const [available, setAvailable] = useState<AvailableMerryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [joiningId, setJoiningId] = useState<number | null>(null);

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const merryAllowed = canJoinMerry(user);
  const withdrawAllowed = canWithdraw(user);

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, merryRes, availableRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyMerries(),
        getAvailableMerries(),
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

      let nextError = "";

      if (merryRes.status === "fulfilled") {
        setData(merryRes.value ?? { created: [], memberships: [] });
      } else {
        setData({ created: [], memberships: [] });
        nextError =
          getApiErrorMessage(merryRes.reason) || getErrorMessage(merryRes.reason);
      }

      if (availableRes.status === "fulfilled") {
        setAvailable(Array.isArray(availableRes.value) ? availableRes.value : []);
      } else {
        setAvailable([]);
        if (!nextError) {
          nextError =
            getApiErrorMessage(availableRes.reason) ||
            getErrorMessage(availableRes.reason);
        }
      }

      if (nextError) setError(nextError);
    } catch (e: any) {
      setData({ created: [], memberships: [] });
      setAvailable([]);
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

  const handleJoin = useCallback(
    async (merryId: number) => {
      try {
        setJoiningId(merryId);
        setError("");
        await requestToJoinMerry(merryId, { requested_seats: 1 });
        await load();
      } catch (e: any) {
        setError(getApiErrorMessage(e) || getErrorMessage(e));
      } finally {
        setJoiningId(null);
      }
    },
    [load]
  );

  const created = data?.created ?? [];
  const memberships = data?.memberships ?? [];

  const membershipIds = useMemo(
    () => new Set(memberships.map((m) => Number(m.merry_id))),
    [memberships]
  );

  const totals = useMemo(() => {
    const membershipSeats = memberships.reduce(
      (sum, m) => sum + Number(m.seats_count || 0),
      0
    );

    return {
      memberships: memberships.length,
      seats: membershipSeats,
      available: available.length,
      created: created.length,
    };
  }, [available, created, memberships]);

  const featuredAvailable = available.slice(0, 3);
  const featuredMemberships = memberships.slice(0, 3);
  const featuredCreated = created.slice(0, 2);

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
          subtitle="Please login to access merry-go-round."
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
            <Text style={styles.heroEyebrow}>MERRY-GO-ROUND</Text>
            <Text style={styles.heroTitle}>Manage your merry activity</Text>
            <Text style={styles.heroSubtitle}>
              Join, contribute and track what matters.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="repeat-outline" size={24} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Memberships</Text>
            <Text style={styles.heroStatValue}>{totals.memberships}</Text>
          </View>

          <View style={styles.heroStatDivider} />

          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Seats</Text>
            <Text style={styles.heroStatValue}>{totals.seats}</Text>
          </View>

          <View style={styles.heroStatDivider} />

          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Available</Text>
            <Text style={styles.heroStatValue}>{totals.available}</Text>
          </View>
        </View>
      </Card>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!merryAllowed ? (
        <Section title="Account Status">
          <NoticeCard
            icon="information-circle-outline"
            title="Approval required"
            text="Your account needs approval before you can join a merry."
          />
        </Section>
      ) : !kycComplete ? (
        <Section title="Verification">
          <NoticeCard
            icon="shield-checkmark-outline"
            title="KYC not complete"
            text="Withdrawal-related access should wait until KYC is complete."
            buttonLabel="Complete KYC"
            onPress={() => router.push(ROUTES.tabs.profileKyc as any)}
          />
        </Section>
      ) : null}

      <Section title="Quick Actions">
        <View style={styles.quickGrid}>
          <QuickLink
            title="Join Requests"
            subtitle="Check progress"
            icon="git-pull-request-outline"
            tone="info"
            onPress={() => router.push(ROUTES.tabs.merryJoinRequests as any)}
          />
          <QuickLink
            title="Payments"
            subtitle="Contribution history"
            icon="cash-outline"
            tone="success"
            onPress={() => router.push(ROUTES.tabs.merryPayments as any)}
          />
          <QuickLink
            title="Available Merries"
            subtitle="Browse open merries"
            icon="search-outline"
            tone="primary"
            onPress={() => router.push(ROUTES.tabs.merry as any)}
          />
          {isAdmin ? (
            <QuickLink
              title="Create Merry"
              subtitle="Start a new merry"
              icon="add-circle-outline"
              tone="warning"
              onPress={() => router.push(ROUTES.tabs.merryCreate as any)}
            />
          ) : (
            <QuickLink
              title="My Merries"
              subtitle="Open memberships"
              icon="people-outline"
              tone="success"
              onPress={() => router.push(ROUTES.tabs.merry as any)}
            />
          )}
        </View>
      </Section>

      <Section title="My Merries">
        {memberships.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No memberships yet"
            subtitle={
              merryAllowed
                ? "Join a merry to begin contributing."
                : "Your account must be approved before joining a merry."
            }
          />
        ) : (
          <>
            <View style={styles.metricsRow}>
              <MetricCard
                label="Memberships"
                value={totals.memberships}
                icon="people-outline"
                tone="primary"
              />
              <View style={{ width: SPACING.sm }} />
              <MetricCard
                label="Seats"
                value={totals.seats}
                icon="grid-outline"
                tone="success"
              />
            </View>

            <View style={{ height: SPACING.md }} />

            {featuredMemberships.map((m) => (
              <MembershipCard key={`mem-${m.merry_id}`} item={m} />
            ))}
          </>
        )}
      </Section>

      <Section title="Available Merries">
        {available.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="No available merries"
            subtitle="There are no open merries right now."
          />
        ) : (
          <>
            <View style={styles.metricsRow}>
              <MetricCard
                label="Open"
                value={totals.available}
                icon="sparkles-outline"
                tone="info"
              />
            </View>

            <View style={{ height: SPACING.md }} />

            {featuredAvailable.map((m) => (
              <AvailableMerryCard
                key={`av-${m.id}`}
                item={m}
                merryAllowed={merryAllowed}
                alreadyMember={membershipIds.has(Number(m.id))}
                joining={joiningId === m.id}
                onJoin={() => handleJoin(m.id)}
              />
            ))}
          </>
        )}
      </Section>

      {isAdmin ? (
        <Section title="Created By Me">
          {created.length === 0 ? (
            <EmptyState
              icon="add-circle-outline"
              title="No merries created"
              subtitle="Create a merry to manage members, requests and payouts."
            />
          ) : (
            <>
              <View style={styles.metricsRow}>
                <MetricCard
                  label="Created"
                  value={totals.created}
                  icon="shield-checkmark-outline"
                  tone="warning"
                />
              </View>

              <View style={{ height: SPACING.md }} />

              {featuredCreated.map((m) => (
                <AdminCreatedCard key={`cr-${m.id}`} item={m} />
              ))}

              <View style={styles.adminTools}>
                <Button
                  title="Join Requests"
                  variant="secondary"
                  onPress={() =>
                    router.push(MERRY_EXTRA_ROUTES.adminJoinRequests as any)
                  }
                  style={{ flex: 1 }}
                />
                <View style={{ width: SPACING.sm }} />
                <Button
                  title="Create Payout"
                  variant="secondary"
                  onPress={() =>
                    router.push(MERRY_EXTRA_ROUTES.adminPayoutCreate as any)
                  }
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
        </Section>
      ) : null}

      {!withdrawAllowed && memberships.length > 0 ? (
        <Section title="Withdrawal Note">
          <NoticeCard
            icon="information-circle-outline"
            title="Withdrawal access pending"
            text="Complete KYC before using withdrawal-related features."
            buttonLabel="Complete KYC"
            onPress={() => router.push(ROUTES.tabs.profileKyc as any)}
          />
        </Section>
      ) : null}

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
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroEyebrow: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  heroTitle: {
    ...TYPE.h2,
    color: COLORS.white,
    marginTop: 6,
  },

  heroSubtitle: {
    ...TYPE.subtext,
    color: "rgba(255,255,255,0.84)",
    marginTop: 8,
    lineHeight: 20,
  },

  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.round,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroStats: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  heroStat: {
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
    fontWeight: "800",
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
  },

  errorText: {
    flex: 1,
    ...TYPE.subtext,
    color: COLORS.danger,
  },

  noticeCard: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },

  noticeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  noticeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.infoSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeTitle: {
    ...TYPE.bodyStrong,
  },

  noticeText: {
    ...TYPE.subtext,
    marginTop: 4,
    color: COLORS.textSoft,
  },

  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: SPACING.md,
  },

  quickCard: {
    width: "48.2%",
    minHeight: 150,
    padding: SPACING.md,
    justifyContent: "space-between",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },

  quickTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  quickIcon: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  quickTitle: {
    ...TYPE.title,
    marginTop: SPACING.md,
    fontWeight: "800",
  },

  quickSubtitle: {
    ...TYPE.subtext,
    marginTop: 6,
    color: COLORS.textSoft,
  },

  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  metricCard: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },

  metricLabel: {
    ...TYPE.caption,
    color: COLORS.textMuted,
  },

  metricValue: {
    ...TYPE.title,
    marginTop: 4,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },

  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  itemTitle: {
    ...TYPE.title,
    fontWeight: "800",
  },

  itemSubtitle: {
    ...TYPE.subtext,
    marginTop: 4,
    color: COLORS.textSoft,
  },

  statePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },

  statePillText: {
    ...TYPE.caption,
    fontWeight: "800",
  },

  metaGrid: {
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
  },

  miniActionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },

  miniAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
  },

  adminTools: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.sm,
  },
});