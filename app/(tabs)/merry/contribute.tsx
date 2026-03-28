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
import { COLORS, FONT, P, RADIUS, SPACING, TYPE } from "@/constants/theme";
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
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type MerryContributionUser = Partial<MeResponse> & Partial<SessionUser>;
type PaymentMethod = "STK" | "PAYBILL";

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
  const kycComplete = isKycComplete(user);
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
    kycComplete &&
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
        returnTo: ROUTES.dynamic.merryDetail(merry.id),
      },
    });
  }, [accountReference, canContinue, cleanAmount, merry, method]);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.mpesa} />
        </View>
      </SafeAreaView>
    );
  }

  if (!merry) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.page}>
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

  if (!merryAllowed || !kycComplete) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.page}>
          <EmptyState
            title="Unable to continue"
            subtitle="Complete your account setup first."
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
        <View style={styles.page}>
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
        <View style={styles.page}>
          <EmptyState
            title="Not assigned"
            subtitle="You do not have a seat in this merry."
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Merry Contribution</Text>
          <Text style={styles.subtitle}>{merry.name}</Text>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Card style={styles.formCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Seats</Text>
            <Text style={styles.summaryValue}>{mySeats.length}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Expected</Text>
            <Text style={styles.summaryValue}>{formatKes(expectedAmount)}</Text>
          </View>

          <Text style={styles.label}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmount(v))}
            placeholder={expectedAmount > 0 ? String(expectedAmount) : "1000"}
            placeholderTextColor={COLORS.placeholder}
            keyboardType="numeric"
            style={styles.input}
          />

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
    ...P.page,
  },

  content: {
    ...P.content,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    marginBottom: SPACING.lg,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 24,
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 4,
    ...TYPE.subtext,
    color: COLORS.textMuted,
  },

  errorCard: {
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.18)",
    backgroundColor: "rgba(220,38,38,0.06)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  errorText: {
    ...TYPE.subtext,
    color: COLORS.danger,
  },

  formCard: {
    ...P.paymentCard,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  summaryLabel: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
  },

  summaryValue: {
    ...TYPE.body,
    color: COLORS.text,
    fontFamily: FONT.bold,
  },

  label: {
    ...TYPE.label,
    marginTop: SPACING.sm,
    marginBottom: 8,
    color: COLORS.text,
  },

  input: {
    ...P.input,
    height: 50,
    marginBottom: SPACING.md,
  },

  switchRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  switchBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: COLORS.surface,
  },

  switchBtnActive: {
    borderColor: COLORS.mpesa,
    backgroundColor: "rgba(22,163,74,0.08)",
  },

  switchBtnDisabled: {
    opacity: 0.5,
  },

  switchBtnText: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  switchBtnTextActive: {
    color: COLORS.mpesa,
    fontFamily: FONT.bold,
  },
});