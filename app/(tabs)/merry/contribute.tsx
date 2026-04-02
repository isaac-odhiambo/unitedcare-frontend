import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import {
  getActiveMpesaConfig,
  getApiErrorMessage,
  isPaybillEnabled,
  MpesaConfig,
} from "@/services/payments";
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
type PaymentMethod = "STK" | "PAYBILL";

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const BRAND_DARK = "#09586A";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.90)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.74)";
const SOFT_WHITE = "rgba(255,255,255,0.10)";
const SOFT_WHITE_2 = "rgba(255,255,255,0.14)";
const SURFACE_LIGHT = "rgba(255,255,255,0.72)";
const CARD_TINT = "rgba(255,255,255,0.08)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const MERRY_CARD = "rgba(98, 192, 98, 0.23)";
const MERRY_BORDER = "rgba(194, 255, 188, 0.16)";
const MERRY_ICON_BG = "rgba(236, 255, 235, 0.76)";
const MERRY_ICON = "#379B4A";
const ERROR_BG = "rgba(239,68,68,0.14)";
const ERROR_BORDER = "rgba(239,68,68,0.22)";
const ERROR_TEXT = "#FECACA";

function sanitizeAmount(value: string) {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function isPositiveAmount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

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

  const params = useLocalSearchParams<{ id?: string; merryId?: string }>();
  const merryId = Number(params.id ?? params.merryId ?? 0);

  const mountedRef = useRef(true);
  const navigatingRef = useRef(false);

  const [user, setUser] = useState<MerryContributionUser | null>(null);
  const [merry, setMerry] = useState<MerryDetail | null>(null);
  const [mySeats, setMySeats] = useState<MerrySeatRow[]>([]);
  const [mpesaConfig, setMpesaConfig] = useState<MpesaConfig | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("STK");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const merryAllowed = canJoinMerry(user);
  const isMemberOfThisMerry = mySeats.length > 0;

  const paybillEnabled = useMemo(
    () => isPaybillEnabled(mpesaConfig),
    [mpesaConfig]
  );

  const expectedAmount = useMemo(() => {
    const perSeat = Number(merry?.contribution_amount || 0);
    return perSeat * mySeats.length;
  }, [merry?.contribution_amount, mySeats.length]);

  const cleanAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "";
  }, [amount]);

  const accountReference = useMemo(() => getMerryReference(user), [user]);

  const canContinue =
    !!merry &&
    merryAllowed &&
    !isAdmin &&
    isMemberOfThisMerry &&
    isPositiveAmount(amount) &&
    !opening &&
    (method === "STK" || paybillEnabled);

  const load = useCallback(async () => {
    if (!merryId || !Number.isFinite(merryId)) {
      setError("Missing or invalid merry.");
      setMerry(null);
      setMySeats([]);
      return;
    }

    try {
      setError("");

      const [sessionRes, meRes, merryRes, seatsRes, configRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getMerryDetail(merryId),
          getMerrySeats(merryId),
          getActiveMpesaConfig(),
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

      if (configRes.status === "fulfilled") {
        setMpesaConfig(configRes.value);
      } else {
        setMpesaConfig(null);
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

      const perSeat =
        merryRes.status === "fulfilled"
          ? Number(merryRes.value?.contribution_amount || 0)
          : 0;

      const suggestedAmount =
        mine.length > 0 && perSeat > 0 ? perSeat * mine.length : perSeat;

      setAmount((prev) => {
        if (prev.trim()) return prev;
        return suggestedAmount > 0 ? String(suggestedAmount) : "";
      });

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

    router.push({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        purpose: "MERRY_CONTRIBUTION",
        amount: cleanAmount,
        reference: accountReference,
        merry_id: String(merry.id),
        merryId: String(merry.id),
        method,
        initialMethod: method,
        initial_method: method,
        title: "Merry Contribution",
        narration: `Merry contribution - ${merry.name}`,
        subtitle: merry.name,
        returnTo: ROUTES.tabs.merry,
        backLabel: "Back to Merry",
        landingTitle: "Merry",
      },
    });
  }, [accountReference, canContinue, cleanAmount, merry, method]);

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
            actionLabel="Go Back"
            onAction={() => router.back()}
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
            actionLabel="Go Back"
            onAction={() => router.back()}
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
            actionLabel="Go Back"
            onAction={() => router.back()}
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
            actionLabel="Go Back"
            onAction={() => router.back()}
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

          <Text style={styles.sectionTitle}>Contribution details</Text>
          <Text style={styles.sectionSubtitle}>
            Choose the amount and payment method, then continue to payment.
          </Text>

          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Seats assigned</Text>
              <Text style={styles.infoValue}>{mySeats.length}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Expected amount</Text>
              <Text style={styles.infoValue}>{formatKes(expectedAmount)}</Text>
            </View>
          </View>

          <Text style={styles.label}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmount(v))}
            placeholder={expectedAmount > 0 ? String(expectedAmount) : "1000"}
            placeholderTextColor="rgba(255,255,255,0.45)"
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>Payment method</Text>
          <View style={styles.switchRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setMethod("STK")}
              disabled={opening}
              style={[
                styles.switchBtn,
                method === "STK" ? styles.switchBtnActive : null,
              ]}
            >
              <Text
                style={[
                  styles.switchBtnText,
                  method === "STK" ? styles.switchBtnTextActive : null,
                ]}
              >
                STK Push
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (paybillEnabled && !opening) {
                  setMethod("PAYBILL");
                }
              }}
              disabled={!paybillEnabled || opening}
              style={[
                styles.switchBtn,
                method === "PAYBILL" ? styles.switchBtnActive : null,
                !paybillEnabled ? styles.switchBtnDisabled : null,
              ]}
            >
              <Text
                style={[
                  styles.switchBtnText,
                  method === "PAYBILL" ? styles.switchBtnTextActive : null,
                ]}
              >
                Paybill
              </Text>
            </TouchableOpacity>
          </View>

          {!paybillEnabled ? (
            <View style={styles.methodHint}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={TEXT_ON_DARK_SOFT}
              />
              <Text style={styles.methodHintText}>
                Paybill is not active right now. You can still continue with STK Push.
              </Text>
            </View>
          ) : null}

          <Button
            title={opening ? "Opening..." : "Continue"}
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
  },

  infoLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_ON_DARK_SOFT,
    fontFamily: FONT.regular,
  },

  infoValue: {
    fontSize: 13,
    lineHeight: 18,
    color: WHITE,
    fontFamily: FONT.bold,
  },

  label: {
    marginTop: SPACING.sm,
    marginBottom: 8,
    color: WHITE,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.medium,
  },

  input: {
    height: 50,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    color: WHITE,
    backgroundColor: SOFT_WHITE,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    fontFamily: FONT.medium,
  },

  switchRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  switchBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: SOFT_WHITE,
  },

  switchBtnActive: {
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: SURFACE_LIGHT,
  },

  switchBtnDisabled: {
    opacity: 0.5,
  },

  switchBtnText: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: TEXT_ON_DARK_SOFT,
  },

  switchBtnTextActive: {
    color: BRAND_DARK,
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