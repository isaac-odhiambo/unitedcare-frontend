import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getMerryDetail,
  getMerrySeats,
  MerryDetail,
  MerrySeatRow,
} from "@/services/merry";
import { getApiErrorMessage } from "@/services/payments";
import {
  canJoinMerry,
  getMe,
  isAdminUser,
  MeResponse,
} from "@/services/profile";
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type MerryContributionUser = Partial<MeResponse> & Partial<SessionUser>;

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.90)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.74)";
const SOFT_WHITE = "rgba(255,255,255,0.10)";
const SOFT_WHITE_2 = "rgba(255,255,255,0.14)";
const MERRY_CARD = "rgba(98, 192, 98, 0.23)";
const MERRY_BORDER = "rgba(194, 255, 188, 0.16)";
const ERROR_BG = "rgba(239,68,68,0.14)";
const ERROR_BORDER = "rgba(239,68,68,0.22)";
const ERROR_TEXT = "#FECACA";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getUserId(user?: MerryContributionUser | null) {
  const raw =
    (user as any)?.id ??
    (user as any)?.user_id ??
    (user as any)?.pk ??
    null;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getMerryReference(user?: MerryContributionUser | null) {
  const userId = getUserId(user);
  return userId ? `mus${userId}` : "mus";
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

export default function MerryContributeScreen() {
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    id?: string;
    merryId?: string;
    returnTo?: string;
  }>();
  const merryId = Number(params.id ?? params.merryId ?? 0);

  const mountedRef = useRef(true);
  const navigatingRef = useRef(false);

  const [user, setUser] = useState<MerryContributionUser | null>(null);
  const [merry, setMerry] = useState<MerryDetail | null>(null);
  const [mySeats, setMySeats] = useState<MerrySeatRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const backToMerryIndex = useCallback(() => {
    const target =
      typeof params.returnTo === "string" && params.returnTo.trim()
        ? params.returnTo
        : ROUTES.tabs.merry;

    router.replace(target as any);
  }, [params.returnTo]);

  const isAdmin = isAdminUser(user);
  const merryAllowed = canJoinMerry(user);
  const isMemberOfThisMerry = mySeats.length > 0;

  const expectedAmount = useMemo(() => {
    const perSeat = Number(merry?.contribution_amount || 0);
    return perSeat * mySeats.length;
  }, [merry?.contribution_amount, mySeats.length]);

  const accountReference = useMemo(() => getMerryReference(user), [user]);

  const canContinue =
    !!merry &&
    merryAllowed &&
    !isAdmin &&
    isMemberOfThisMerry &&
    !opening;

  const load = useCallback(async () => {
    if (!merryId || !Number.isFinite(merryId)) {
      setError("Missing or invalid merry.");
      setMerry(null);
      setMySeats([]);
      return;
    }

    try {
      setError("");

      const [sessionRes, meRes, merryRes, seatsRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getMerryDetail(merryId),
          getMerrySeats(merryId),
        ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: MerryContributionUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      if (!mountedRef.current) return;

      setUser(mergedUser);

      if (mergedUser) {
        await saveSessionUser(mergedUser);
      }

      if (merryRes.status === "fulfilled") {
        setMerry(merryRes.value);
      } else {
        setMerry(null);
        setError(
          getApiErrorMessage(merryRes.reason) ||
            getErrorMessage(merryRes.reason)
        );
      }

      const allSeats =
        seatsRes.status === "fulfilled" && Array.isArray(seatsRes.value)
          ? seatsRes.value
          : [];

      const myUserId = Number(
        (meUser as any)?.id || (sessionUser as any)?.id || 0
      );

      const mine =
        myUserId > 0
          ? allSeats.filter((seat) => Number(seat.user_id) === myUserId)
          : [];

      setMySeats(mine);

      if (meRes.status === "rejected" && merryRes.status !== "rejected") {
        setError((prev) => prev || getErrorMessage(meRes.reason));
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setMerry(null);
      setMySeats([]);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, [merryId]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      navigatingRef.current = false;

      const run = async () => {
        try {
          setLoading(true);
          await load();
        } finally {
          if (mountedRef.current) {
            setLoading(false);
          }
        }
      };

      run();

      return () => {
        mountedRef.current = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [load]);

  const handleContinue = useCallback(() => {
    if (!merry || !canContinue || navigatingRef.current) return;

    navigatingRef.current = true;
    setOpening(true);
    setError("");

    const suggestedAmount =
      expectedAmount > 0
        ? expectedAmount.toFixed(2)
        : Number(merry.contribution_amount || 0) > 0
          ? Number(merry.contribution_amount).toFixed(2)
          : "";

    router.push({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        purpose: "MERRY_CONTRIBUTION",
        reference: accountReference,
        merry_id: String(merry.id),
        merryId: String(merry.id),
        suggestedAmount,
        initial_amount: suggestedAmount,
        title: "Merry Contribution",
        subtitle: merry.name,
        narration: `Merry contribution - ${merry.name}`,
        returnTo: ROUTES.tabs.merry,
        backLabel: "Back to Merry",
        landingTitle: "Merry",
      },
    });
  }, [accountReference, canContinue, expectedAmount, merry]);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8CF0C7" />
        </View>
      </SafeAreaView>
    );
  }

  if (!merry) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Merry not found"
            subtitle="We could not load this merry."
            actionLabel="Back to Merry"
            onAction={backToMerryIndex}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!merryAllowed) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Unable to continue"
            subtitle="This account cannot continue with merry contribution right now."
            actionLabel="Back to Merry"
            onAction={backToMerryIndex}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isAdmin) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Unavailable"
            subtitle="Admin accounts cannot contribute here."
            actionLabel="Back to Merry"
            onAction={backToMerryIndex}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!isMemberOfThisMerry) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="No seat assigned"
            subtitle="You do not have a seat in this merry yet."
            actionLabel="Back to Merry"
            onAction={backToMerryIndex}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8CF0C7"
            colors={["#8CF0C7", "#0CC0B7"]}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="cash-outline" size={22} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.brandWordmark}>
                MERRY <Text style={styles.brandWordmarkGreen}>CONTRIBUTION</Text>
              </Text>
              <Text style={styles.brandSub}>Community sharing payment</Text>
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
              onPress={backToMerryIndex}
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
          <Text style={styles.title}>Merry Contribution</Text>
          <Text style={styles.subtitle}>{merry.name}</Text>

          <View style={styles.summaryRowTop}>
            <SummaryTile
              label="Seats"
              value={String(mySeats.length)}
              icon="people-outline"
            />
            <SummaryTile
              label="Expected"
              value={formatKes(expectedAmount)}
              icon="wallet-outline"
            />
            <SummaryTile
              label="Reference"
              value={accountReference.toUpperCase()}
              icon="document-text-outline"
            />
          </View>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={ERROR_TEXT} />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Card style={styles.formCard}>
          <View style={styles.spaceGlowTop} />
          <View style={styles.spaceGlowBottom} />

          <Text style={styles.sectionTitle}>Contribution summary</Text>
          <Text style={styles.sectionSubtitle}>
            Review the merry details below, then continue to the payment page to
            enter or change amount and complete payment.
          </Text>

          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Merry name</Text>
              <Text style={styles.infoValue}>{merry.name}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>My seats</Text>
              <Text style={styles.infoValue}>{mySeats.length}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Per seat</Text>
              <Text style={styles.infoValue}>
                {formatKes(merry.contribution_amount)}
              </Text>
            </View>

            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>Suggested amount</Text>
              <Text style={styles.infoValueStrong}>
                {formatKes(expectedAmount)}
              </Text>
            </View>
          </View>

          <View style={styles.methodHint}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={TEXT_ON_DARK_SOFT}
            />
            <Text style={styles.methodHintText}>
              On the next screen you can edit the amount, choose payment method,
              and complete the transaction.
            </Text>
          </View>

          <Button
            title={opening ? "Opening payment..." : "Continue to Payment"}
            onPress={handleContinue}
            disabled={!canContinue || opening}
          />
        </Card>
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
    padding: SPACING.md,
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
    backgroundColor: PAGE_BG,
    padding: 24,
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

  title: {
    color: WHITE,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONT.bold,
  },

  subtitle: {
    color: TEXT_ON_DARK,
    marginTop: 8,
    lineHeight: 20,
    fontSize: 13,
    fontFamily: FONT.regular,
  },

  summaryRowTop: {
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

  formCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: MERRY_CARD,
    borderWidth: 1,
    borderColor: MERRY_BORDER,
    borderRadius: 24,
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

  sectionTitle: {
    color: WHITE,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.bold,
  },

  sectionSubtitle: {
    color: TEXT_ON_DARK,
    marginTop: 4,
    marginBottom: SPACING.md,
    lineHeight: 18,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  infoBox: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: SOFT_WHITE,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
  },

  infoRowLast: {
    marginBottom: 0,
  },

  infoLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_ON_DARK_SOFT,
    fontFamily: FONT.regular,
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 13,
    lineHeight: 18,
    color: WHITE,
    fontFamily: FONT.bold,
  },

  infoValueStrong: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 15,
    lineHeight: 20,
    color: WHITE,
    fontFamily: FONT.bold,
  },

  methodHint: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: 14,
    backgroundColor: SOFT_WHITE,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  methodHintText: {
    flex: 1,
    color: TEXT_ON_DARK,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  errorCard: {
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: ERROR_BORDER,
    backgroundColor: ERROR_BG,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: ERROR_TEXT,
    fontFamily: FONT.regular,
  },
});