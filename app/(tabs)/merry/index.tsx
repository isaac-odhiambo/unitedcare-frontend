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
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  fmtKES,
  getApiErrorMessage,
  getMyMerries,
  MyMerriesResponse,
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

/**
 * Keep these only for merry screens that may not yet exist in ROUTES
 * or are still being stabilized.
 */
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

function NoticeCard({
  icon,
  text,
  buttonLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  buttonLabel?: string;
  onPress?: () => void;
}) {
  return (
    <Card style={styles.noticeCard}>
      <View style={styles.noticeTop}>
        <Ionicons name={icon} size={18} color={COLORS.info} />
        <Text style={styles.noticeText}>{text}</Text>
      </View>

      {buttonLabel && onPress ? (
        <View style={{ marginTop: SPACING.sm }}>
          <Button title={buttonLabel} variant="secondary" onPress={onPress} />
        </View>
      ) : null}
    </Card>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{String(value)}</Text>
    </View>
  );
}

export default function MerryIndexScreen() {
  const [user, setUser] = useState<MerryUser | null>(null);
  const [data, setData] = useState<MyMerriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const merryAllowed = canJoinMerry(user);
  const withdrawAllowed = canWithdraw(user);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, merryRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
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

      if (merryRes.status === "fulfilled") {
        setData(merryRes.value);
      } else {
        setData({ created: [], memberships: [] });
        setError(getApiErrorMessage(merryRes.reason) || getErrorMessage(merryRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e) || getErrorMessage(e));
      setData({ created: [], memberships: [] });
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

  const created = data?.created ?? [];
  const memberships = data?.memberships ?? [];

  const totals = useMemo(() => {
    const membershipSeats = memberships.reduce(
      (sum, m) => sum + Number(m.seats_count || 0),
      0
    );

    const createdSeats = created.reduce(
      (sum, m) => sum + Number(m.seats_count || 0),
      0
    );

    return {
      memberships: memberships.length,
      created: created.length,
      membershipSeats,
      createdSeats,
    };
  }, [created, memberships]);

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
          onAction={() => router.replace(ROUTES.auth.login)}
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
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.hTitle}>Merry-Go-Round</Text>
          <Text style={styles.hSub}>
            Join merries, contribute, and track seats, slots, dues and payouts.
          </Text>
        </View>

        <Ionicons name="people-outline" size={22} color={COLORS.primary} />
      </View>

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
            text="Your account must be approved before you can join a merry-go-round."
          />
        </Section>
      ) : !kycComplete ? (
        <Section title="KYC Notice">
          <NoticeCard
            icon="shield-checkmark-outline"
            text="You can join and contribute to merry-go-rounds before full KYC, but withdrawal-related access should wait until KYC is complete."
            buttonLabel="Complete KYC"
            onPress={() => router.push(ROUTES.tabs.profileKyc)}
          />
        </Section>
      ) : null}

      <View style={styles.summaryGrid}>
        <SummaryCard label="Memberships" value={totals.memberships} />
        <SummaryCard label="My Seats" value={totals.membershipSeats} />
      </View>

      {isAdmin ? (
        <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
          <SummaryCard label="Created" value={totals.created} />
          <SummaryCard label="Created Seats" value={totals.createdSeats} />
        </View>
      ) : null}

      <Card style={styles.quickActionsCard}>
        <Section title="Quick Actions">
          <View style={styles.actionsRow}>
            <Button
              title="My Join Requests"
              variant="secondary"
              onPress={() => router.push(ROUTES.tabs.merryJoinRequests)}
              style={{ flex: 1 }}
              leftIcon={
                <Ionicons name="list-outline" size={18} color={COLORS.dark} />
              }
            />
            <View style={{ width: SPACING.sm }} />
            <Button
              title="My Payments"
              variant="secondary"
              onPress={() => router.push(ROUTES.tabs.merryPayments)}
              style={{ flex: 1 }}
              leftIcon={
                <Ionicons name="cash-outline" size={18} color={COLORS.dark} />
              }
            />
          </View>

          {isAdmin ? (
            <>
              <View style={{ height: SPACING.sm }} />
              <Button
                title="Create Merry"
                onPress={() => router.push(ROUTES.tabs.merryCreate)}
                leftIcon={
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={COLORS.white}
                  />
                }
              />
            </>
          ) : null}
        </Section>
      </Card>

      <Section title="My Memberships">
        {memberships.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No memberships yet"
            subtitle={
              merryAllowed
                ? "Join a merry to start contributing and receiving payouts."
                : "Your account must be approved before joining a merry."
            }
          />
        ) : (
          memberships.map((m) => {
            const perSeat = toNum(m.contribution_amount);
            const slots = Number(m.payouts_per_period || 1);
            const seats = Number(m.seats_count || 0);
            const requiredPerPeriod = perSeat * slots * seats;

            return (
              <Card key={`mem-${m.merry_id}`} style={styles.itemCard}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.title}>{m.name}</Text>
                    <Text style={styles.sub}>
                      {fmtKES(m.contribution_amount)} per seat •{" "}
                      {m.payout_frequency} • Slots: {slots}
                    </Text>
                  </View>

                  <Text style={styles.badge}>
                    {String(m.payout_order_type || "").toUpperCase()}
                  </Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>My seats</Text>
                  <Text style={styles.kvValue}>
                    {seats > 0 ? String(seats) : "—"}
                  </Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Required / period</Text>
                  <Text style={styles.kvValue}>{fmtKES(requiredPerPeriod)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Next payout date</Text>
                  <Text style={styles.kvValue}>{m.next_payout_date ?? "—"}</Text>
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    title="Open"
                    variant="secondary"
                    onPress={() =>
                      router.push(ROUTES.dynamic.merryDetail(m.merry_id) as any)
                    }
                    style={{ flex: 1 }}
                  />
                  <View style={{ width: SPACING.sm }} />
                  <Button
                    title="Contribute"
                    onPress={() =>
                      router.push({
                        pathname: ROUTES.tabs.merryContribute as any,
                        params: { merryId: String(m.merry_id) },
                      })
                    }
                    style={{ flex: 1 }}
                    leftIcon={
                      <Ionicons
                        name="cash-outline"
                        size={18}
                        color={COLORS.white}
                      />
                    }
                  />
                </View>

                <View style={{ height: SPACING.sm }} />

                <View style={styles.actionsRow}>
                  <Button
                    title="Members"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: MERRY_EXTRA_ROUTES.members as any,
                        params: { merryId: String(m.merry_id) },
                      })
                    }
                    style={{ flex: 1 }}
                    leftIcon={
                      <Ionicons
                        name="people-outline"
                        size={18}
                        color={COLORS.dark}
                      />
                    }
                  />
                  <View style={{ width: SPACING.sm }} />
                  <Button
                    title="Payout Schedule"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: MERRY_EXTRA_ROUTES.payoutsSchedule as any,
                        params: { merryId: String(m.merry_id) },
                      })
                    }
                    style={{ flex: 1 }}
                    leftIcon={
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={COLORS.dark}
                      />
                    }
                  />
                </View>
              </Card>
            );
          })
        )}
      </Section>

      {isAdmin ? (
        <Section title="Created By Me (Admin)">
          {created.length === 0 ? (
            <EmptyState
              icon="add-circle-outline"
              title="No merries created"
              subtitle="Create a merry to start managing members, join requests and payouts."
            />
          ) : (
            created.map((m) => {
              const perSeat = toNum(m.contribution_amount);
              const slots = Number(m.payouts_per_period || 1);
              const seats = Number(m.seats_count || 0);
              const totalExpectedPerSlot = perSeat * seats;
              const totalExpectedPerPeriod = perSeat * slots * seats;

              return (
                <Card key={`cr-${m.id}`} style={styles.itemCard}>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.title}>{m.name}</Text>
                      <Text style={styles.sub}>
                        {fmtKES(m.contribution_amount)} per seat • Members:{" "}
                        {m.members_count} • Seats: {seats}
                      </Text>
                    </View>

                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Order</Text>
                    <Text style={styles.kvValue}>
                      {String(m.payout_order_type || "").toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Frequency</Text>
                    <Text style={styles.kvValue}>
                      {String(m.payout_frequency || "—")}
                    </Text>
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Slots / period</Text>
                    <Text style={styles.kvValue}>{String(slots)}</Text>
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Expected / slot</Text>
                    <Text style={styles.kvValue}>
                      {fmtKES(totalExpectedPerSlot)}
                    </Text>
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Expected / period</Text>
                    <Text style={styles.kvValue}>
                      {fmtKES(totalExpectedPerPeriod)}
                    </Text>
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Next payout date</Text>
                    <Text style={styles.kvValue}>{m.next_payout_date ?? "—"}</Text>
                  </View>

                  <View style={styles.actionsRow}>
                    <Button
                      title="Open"
                      variant="secondary"
                      onPress={() =>
                        router.push(ROUTES.dynamic.merryDetail(m.id) as any)
                      }
                      style={{ flex: 1 }}
                    />
                    <View style={{ width: SPACING.sm }} />
                    <Button
                      title="Join Requests"
                      onPress={() =>
                        router.push({
                          pathname: MERRY_EXTRA_ROUTES.adminJoinRequests as any,
                          params: { merryId: String(m.id) },
                        })
                      }
                      style={{ flex: 1 }}
                      leftIcon={
                        <Ionicons
                          name="checkmark-done-outline"
                          size={18}
                          color={COLORS.white}
                        />
                      }
                    />
                  </View>

                  <View style={{ height: SPACING.sm }} />

                  <View style={styles.actionsRow}>
                    <Button
                      title="Members"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: MERRY_EXTRA_ROUTES.members as any,
                          params: { merryId: String(m.id) },
                        })
                      }
                      style={{ flex: 1 }}
                    />
                    <View style={{ width: SPACING.sm }} />
                    <Button
                      title="Create Payout"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: MERRY_EXTRA_ROUTES.adminPayoutCreate as any,
                          params: { merryId: String(m.id) },
                        })
                      }
                      style={{ flex: 1 }}
                      leftIcon={
                        <Ionicons
                          name="send-outline"
                          size={18}
                          color={COLORS.dark}
                        />
                      }
                    />
                  </View>
                </Card>
              );
            })
          )}
        </Section>
      ) : null}

      {!withdrawAllowed && memberships.length > 0 ? (
        <Section title="Withdrawal Note">
          <NoticeCard
            icon="information-circle-outline"
            text="You may still contribute and participate in merry activities, but any withdrawal-related access should wait until KYC is complete."
            buttonLabel="Complete KYC"
            onPress={() => router.push(ROUTES.tabs.profileKyc)}
          />
        </Section>
      ) : null}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.card,
  },

  quickActionsCard: {
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  noticeCard: {
    padding: SPACING.md,
  },

  noticeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  noticeText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  summaryValue: {
    marginTop: 8,
    fontFamily: FONT.bold,
    fontSize: 16,
    color: COLORS.dark,
  },

  hTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  hSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  badge: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: COLORS.primary,
  },

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  kvLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },
});