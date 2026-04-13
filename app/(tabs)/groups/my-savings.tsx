// app/(tabs)/groups/my-savings.tsx

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, SPACING } from "@/constants/theme";
import {
  getApiErrorMessage,
  getMyGroupSavingsSummary,
  MyGroupSavingsRow,
} from "@/services/groups";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type SavingsUser = Partial<MeResponse> & Partial<SessionUser>;

const PAGE_BG = "#062C49";
const CARD_BG = "rgba(255,255,255,0.08)";
const CARD_BG_STRONG = "rgba(255,255,255,0.12)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const WHITE = "#FFFFFF";
const SOFT_TEXT = "rgba(255,255,255,0.75)";
const SOFT_TEXT_2 = "rgba(255,255,255,0.84)";
const HERO_GREEN = "#74D16C";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE")}`;
}

function groupTypeLabel(row: MyGroupSavingsRow) {
  return row.group.group_type_display || row.group.group_type || "Community space";
}

function roleTone(role?: string | null) {
  const r = String(role || "").toUpperCase().trim();

  if (r === "ADMIN") {
    return {
      bg: "rgba(236,251,255,0.18)",
      color: "#FFFFFF",
      label: "LEAD",
    };
  }

  if (r === "TREASURER") {
    return {
      bg: "rgba(255,204,102,0.18)",
      color: "#FFFFFF",
      label: "TREASURY",
    };
  }

  if (r === "SECRETARY") {
    return {
      bg: "rgba(12,192,183,0.18)",
      color: "#FFFFFF",
      label: "SECRETARY",
    };
  }

  return {
    bg: "rgba(140,240,199,0.18)",
    color: "#FFFFFF",
    label: "MEMBER",
  };
}

function hasUsefulUserIdentity(user: any) {
  if (!user || typeof user !== "object") return false;
  return user.id != null || !!user.phone || !!user.username || !!user.email;
}

function StatusPill({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Text style={[styles.statusPillText, { color }]}>{label}</Text>
    </View>
  );
}

function SavingsCard({ row }: { row: MyGroupSavingsRow }) {
  const role = roleTone(row.my_role);
  const showFund = row.fund?.balance != null;

  return (
    <Card style={styles.itemCard}>
      <View style={styles.cardGlowPrimary} />
      <View style={styles.cardGlowAccent} />

      <View style={styles.cardTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons name="wallet-outline" size={18} color="#0A6E8A" />
        </View>

        <View style={styles.cardTextWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {row.group.name}
          </Text>
          <Text style={styles.cardSub}>{groupTypeLabel(row)}</Text>
        </View>

        <StatusPill label={role.label} bg={role.bg} color={role.color} />
      </View>

      <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>My total</Text>
          <Text style={styles.infoValue}>
            {formatKes(row.my_share?.total_contributed)}
          </Text>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Reserved</Text>
          <Text style={styles.infoValue}>
            {formatKes(row.my_share?.reserved_share)}
          </Text>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Available</Text>
          <Text style={styles.infoValue}>
            {formatKes(row.my_share?.available_share)}
          </Text>
        </View>

        {showFund ? (
          <>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Community fund</Text>
              <Text style={styles.infoValue}>
                {formatKes(row.fund?.balance)}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.cardFooter}>
        <Button
          title="Open space"
          variant="secondary"
          onPress={() =>
            router.push(ROUTES.dynamic.groupDetail(row.group.id) as any)
          }
          style={{ flex: 1 }}
        />
        <View style={{ width: SPACING.sm }} />
        <Button
          title="Contribute"
          onPress={() =>
            router.push(ROUTES.dynamic.groupContribute(row.group.id) as any)
          }
          style={{ flex: 1 }}
          leftIcon={
            <Ionicons name="cash-outline" size={18} color={COLORS.white} />
          }
        />
      </View>
    </Card>
  );
}

export default function MyGroupSavingsScreen() {
  const [user, setUser] = useState<SavingsUser | null>(null);
  const [rows, setRows] = useState<MyGroupSavingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const myTotal = Number(row.my_share?.total_contributed ?? 0);
        const available = Number(row.my_share?.available_share ?? 0);
        acc.totalContributed += Number.isFinite(myTotal) ? myTotal : 0;
        acc.available += Number.isFinite(available) ? available : 0;
        return acc;
      },
      { totalContributed: 0, available: 0 }
    );
  }, [rows]);

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, rowsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyGroupSavingsSummary(),
      ]);

      const sessionUserRaw =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUserRaw = meRes.status === "fulfilled" ? meRes.value : null;

      const sessionUser = hasUsefulUserIdentity(sessionUserRaw)
        ? sessionUserRaw
        : null;
      const meUser = hasUsefulUserIdentity(meUserRaw) ? meUserRaw : null;

      const mergedUser: SavingsUser | null = meUser
        ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
        : sessionUser
          ? { ...sessionUser }
          : null;

      setUser(mergedUser);

      setRows(
        rowsRes.status === "fulfilled" && Array.isArray(rowsRes.value)
          ? rowsRes.value
          : []
      );

      if (rowsRes.status === "rejected") {
        setError(getApiErrorMessage(rowsRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const run = async () => {
        if (!mounted) return;
        try {
          setLoading(true);
          await load();
        } finally {
          if (mounted) setLoading(false);
        }
      };

      run();

      return () => {
        mounted = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (!loading && !user) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Not signed in"
            subtitle="Please login to view your community savings."
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
            tintColor="#8CF0C7"
            colors={["#8CF0C7", "#0CC0B7"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroGlowThree} />

          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.heroTag}>COMMUNITY SAVINGS</Text>
              <Text style={styles.heroTitle}>My community savings</Text>
              <Text style={styles.heroSubtitle}>
                View your contribution share across the community spaces you belong to.
              </Text>
            </View>

            <View style={styles.heroIconWrap}>
              <Ionicons name="wallet-outline" size={22} color={WHITE} />
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>Spaces</Text>
              <Text style={styles.heroStatValue}>
                {loading ? "—" : rows.length}
              </Text>
            </View>

            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>My total</Text>
              <Text style={styles.heroStatValue}>
                {loading ? "—" : formatKes(totals.totalContributed)}
              </Text>
            </View>

            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>Available</Text>
              <Text style={styles.heroStatValue}>
                {loading ? "—" : formatKes(totals.available)}
              </Text>
            </View>
          </View>

          <View style={styles.heroActionsRow}>
            <Button
              title="My spaces"
              variant="secondary"
              onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
              style={{ flex: 1 }}
            />
            <View style={{ width: SPACING.sm }} />
            <Button
              title="Explore spaces"
              onPress={() => router.push(ROUTES.tabs.groupsAvailable as any)}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {!loading && error ? (
          <Card style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={WHITE}
            />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Section title="Savings by space">
          {loading ? (
            <View style={styles.silentLoadingWrap}>
              <Card style={styles.silentCard}>
                <Text style={styles.silentTitle}>Loading your savings</Text>
                <Text style={styles.silentText}>
                  Your community savings will appear here shortly.
                </Text>
              </Card>
            </View>
          ) : rows.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="No community savings yet"
              subtitle="Once you join community spaces and contribute, your savings will appear here."
              actionLabel="Explore spaces"
              onAction={() => router.push(ROUTES.tabs.groupsAvailable as any)}
            />
          ) : (
            rows.map((row) => <SavingsCard key={row.group.id} row={row} />)
          )}
        </Section>
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
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 16,
  },

  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    backgroundColor: PAGE_BG,
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 240,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.06)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: CARD_BG,
    borderRadius: 28,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  heroGlowOne: {
    position: "absolute",
    right: -28,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  heroGlowTwo: {
    position: "absolute",
    left: -20,
    bottom: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(236,251,255,0.08)",
  },

  heroGlowThree: {
    position: "absolute",
    right: 30,
    bottom: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#DFFFE8",
    fontSize: 11,
    fontFamily: FONT.bold,
    marginBottom: 12,
  },

  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  heroTitle: {
    fontSize: 24,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  heroSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: SOFT_TEXT_2,
    fontFamily: FONT.regular,
  },

  heroStatsRow: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginTop: SPACING.lg,
  },

  heroStatPill: {
    flex: 1,
    backgroundColor: CARD_BG_STRONG,
    borderRadius: 16,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroStatLabel: {
    fontSize: 11,
    color: SOFT_TEXT,
    fontFamily: FONT.regular,
  },

  heroStatValue: {
    marginTop: 4,
    fontSize: 16,
    color: WHITE,
    fontFamily: FONT.bold,
  },

  heroActionsRow: {
    flexDirection: "row",
    marginTop: SPACING.lg,
    alignItems: "center",
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(220,53,69,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 20,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: WHITE,
    fontFamily: FONT.regular,
  },

  silentLoadingWrap: {
    marginBottom: SPACING.lg,
  },

  silentCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  silentTitle: {
    color: WHITE,
    fontSize: 15,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  silentText: {
    color: SOFT_TEXT_2,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
  },

  itemCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  cardGlowPrimary: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 105,
    height: 105,
    borderRadius: 52.5,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  cardGlowAccent: {
    position: "absolute",
    bottom: -22,
    left: -18,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(236,251,255,0.06)",
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  groupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.88)",
  },

  cardTextWrap: {
    flex: 1,
    paddingRight: 8,
  },

  cardTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: WHITE,
  },

  cardSub: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: SOFT_TEXT,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusPillText: {
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  infoBox: {
    marginTop: SPACING.md,
    backgroundColor: CARD_BG_STRONG,
    borderRadius: 16,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  infoRow: {
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  infoDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  infoLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: WHITE,
  },

  cardFooter: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },
});