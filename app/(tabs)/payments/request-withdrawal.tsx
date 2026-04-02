import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getApiErrorMessage, money, requestWithdrawal } from "@/services/payments";
import { canWithdraw, getMe, isKycComplete } from "@/services/profile";
import { getSessionUser, saveSessionUser } from "@/services/session";

const SOURCES = ["SAVINGS", "MERRY", "GROUP"] as const;
type WithdrawalSource = (typeof SOURCES)[number];

const NOTIFICATIONS_ROUTE =
  (ROUTES as any)?.tabs?.notifications || "/(tabs)/notifications";

const BRAND = "#0C6A80";
const BRAND_DARK = "#09586A";
const BRAND_SOFT = "rgba(12,106,128,0.10)";
const BRAND_SOFT_2 = "rgba(12,106,128,0.16)";
const SURFACE_TINT = "#F4FBFC";
const CARD_TINT = "#EEF7F9";

function normalizePhone(v: string) {
  const val = String(v || "").trim().replace(/\s+/g, "").replace(/-/g, "");
  if (val.startsWith("+254") && val.length === 13) return `0${val.slice(4)}`;
  if (val.startsWith("254") && val.length === 12) return `0${val.slice(3)}`;
  return val;
}

function sanitizeAmount(v: string) {
  const cleaned = String(v || "").replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function isValidPhone(p: string) {
  return /^(07|01)\d{8}$/.test(p);
}

function normalizeSource(value?: string): WithdrawalSource {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "SAVINGS" || raw === "MERRY" || raw === "GROUP") return raw;
  return "SAVINGS";
}

function sourceLabel(value: WithdrawalSource) {
  switch (value) {
    case "SAVINGS":
      return "Savings";
    case "MERRY":
      return "Merry";
    case "GROUP":
      return "Group";
    default:
      return value;
  }
}

function QuickLink({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.quickLink}>
      <View style={styles.quickLinkIcon}>
        <Ionicons name={icon} size={18} color={BRAND} />
      </View>
      <Text style={styles.quickLinkText}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={stylesVars.textMuted} />
    </TouchableOpacity>
  );
}

const stylesVars = {
  text: COLORS.text || "#16313A",
  textMuted: COLORS.textMuted || "#6B7C85",
  border: COLORS.border || "rgba(12,106,128,0.12)",
  white: COLORS.white || "#FFFFFF",
  warning: COLORS.warning || "#D97706",
  danger: COLORS.danger || "#DC2626",
  background: COLORS.background || "#F3F8FA",
};

export default function RequestWithdrawalScreen() {
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    source?: string;
    amount?: string;
    phone?: string;
  }>();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [phone, setPhone] = useState(
    typeof params.phone === "string" ? normalizePhone(params.phone) : ""
  );
  const [amount, setAmount] = useState(
    typeof params.amount === "string" ? sanitizeAmount(params.amount) : ""
  );
  const [source, setSource] = useState<WithdrawalSource>(
    normalizeSource(typeof params.source === "string" ? params.source : undefined)
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const kycComplete = isKycComplete(user);
  const allowed = canWithdraw(user);

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const phoneOk = useMemo(() => isValidPhone(normalizedPhone), [normalizedPhone]);
  const amountOk = useMemo(() => Number(amount) > 0, [amount]);

  const canSubmit = allowed && phoneOk && amountOk && !submitting;

  const load = useCallback(async () => {
    try {
      setError("");

      const [session, me] = await Promise.all([getSessionUser(), getMe()]);
      const merged = { ...(session || {}), ...(me || {}) };

      setUser(merged);
      await saveSessionUser(merged);

      if (!phone) {
        setPhone(normalizePhone(merged?.phone || ""));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    }
  }, [phone]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setLoading(true);
          await load();
        } finally {
          setLoading(false);
        }
      })();
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

  const handleSubmit = useCallback(async () => {
    if (!allowed) {
      router.push(ROUTES.tabs.profileKyc as any);
      return;
    }

    if (!phoneOk) {
      Alert.alert("Withdraw", "Enter a valid Kenyan phone number.");
      return;
    }

    if (!amountOk) {
      Alert.alert("Withdraw", "Enter a valid amount.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const res = await requestWithdrawal({
        phone: normalizedPhone,
        amount,
        source,
      });

      Alert.alert(
        "Request sent",
        res?.message || "Your withdrawal request has been submitted successfully.",
        [
          {
            text: "Open Withdrawals",
            onPress: () =>
              router.replace(ROUTES.tabs.paymentsWithdrawals as any),
          },
        ]
      );
    } catch (e: any) {
      const message = getApiErrorMessage(e);
      setError(message);
      Alert.alert("Withdraw", message);
    } finally {
      setSubmitting(false);
    }
  }, [allowed, amount, amountOk, normalizedPhone, phoneOk, source]);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator color={BRAND} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.page}>
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
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color={BRAND} />
            </TouchableOpacity>

            <View style={styles.heroBadge}>
              <Ionicons name="wallet-outline" size={14} color={BRAND} />
              <Text style={styles.heroBadgeText}>Money out</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Withdraw from your community wallet</Text>
          <Text style={styles.heroSubtitle}>
            Send your request from savings, merry, or group funds in one simple step.
          </Text>

          <View style={styles.heroSummaryRow}>
            <View style={styles.heroSummaryPill}>
              <Text style={styles.heroSummaryLabel}>Source</Text>
              <Text style={styles.heroSummaryValue}>{sourceLabel(source)}</Text>
            </View>

            <View style={styles.heroSummaryPill}>
              <Text style={styles.heroSummaryLabel}>Amount</Text>
              <Text style={styles.heroSummaryValue}>{money(Number(amount || 0))}</Text>
            </View>
          </View>
        </View>

        {!kycComplete ? (
          <Card style={styles.warningCard}>
            <View style={styles.warningRow}>
              <View style={styles.warningIconWrap}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={stylesVars.warning}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>KYC needed</Text>
                <Text style={styles.warningText}>
                  Complete your KYC details before requesting a withdrawal.
                </Text>
              </View>
            </View>

            <View style={{ marginTop: SPACING.sm }}>
              <Button
                title="Open KYC"
                variant="secondary"
                onPress={() => router.push(ROUTES.tabs.profileKyc as any)}
              />
            </View>
          </Card>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={stylesVars.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Request details</Text>
            <Text style={styles.sectionSubtitle}>
              Fill in your phone, amount, and the wallet to use.
            </Text>
          </View>

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(normalizePhone(v))}
            style={styles.input}
            placeholder="07XXXXXXXX"
            placeholderTextColor={stylesVars.textMuted}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmount(v))}
            style={styles.input}
            placeholder="e.g. 1500"
            placeholderTextColor={stylesVars.textMuted}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Choose source</Text>
          <View style={styles.sources}>
            {SOURCES.map((s) => {
              const active = source === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSource(s)}
                  activeOpacity={0.88}
                  style={[styles.source, active && styles.sourceActive]}
                >
                  <Text style={[styles.sourceText, active && styles.sourceTextActive]}>
                    {sourceLabel(s)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.amountBox}>
            <View style={styles.amountTopRow}>
              <Text style={styles.amountLabel}>Request summary</Text>
              <View style={styles.amountChip}>
                <Ionicons name="checkmark-circle-outline" size={14} color={BRAND} />
                <Text style={styles.amountChipText}>Ready</Text>
              </View>
            </View>

            <Text style={styles.amountValue}>{money(Number(amount || 0))}</Text>
            <Text style={styles.amountMeta}>
              Source: {sourceLabel(source)} • Phone: {normalizedPhone || "Not added"}
            </Text>
          </View>

          <Button
            title={
              !allowed
                ? "Complete KYC"
                : submitting
                ? "Submitting..."
                : "Request Withdrawal"
            }
            onPress={
              !allowed
                ? () => router.push(ROUTES.tabs.profileKyc as any)
                : handleSubmit
            }
            disabled={!allowed ? false : !canSubmit}
            leftIcon={
              <Ionicons
                name={!allowed ? "shield-outline" : "send-outline"}
                size={18}
                color={stylesVars.white}
              />
            }
          />
        </Card>

        <View style={styles.linksWrap}>
          <QuickLink
            title="My Withdrawals"
            icon="cash-outline"
            onPress={() => router.push(ROUTES.tabs.paymentsWithdrawals as any)}
          />

          <QuickLink
            title="Notifications"
            icon="notifications-outline"
            onPress={() => router.push(NOTIFICATIONS_ROUTE as any)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: SURFACE_TINT,
  },

  content: {
    padding: SPACING.md,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: SURFACE_TINT,
  },

  hero: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: BRAND,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
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
  },

  heroBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
    color: stylesVars.white,
  },

  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONT.bold,
    color: stylesVars.white,
  },

  heroSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
    color: "rgba(255,255,255,0.88)",
  },

  heroSummaryRow: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginTop: SPACING.md,
  },

  heroSummaryPill: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  heroSummaryLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: FONT.regular,
    color: "rgba(255,255,255,0.76)",
  },

  heroSummaryValue: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: stylesVars.white,
  },

  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: CARD_TINT,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.10)",
    ...SHADOW.card,
  },

  sectionHeader: {
    marginBottom: SPACING.md,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: stylesVars.textMuted,
  },

  label: {
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
    color: BRAND_DARK,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.14)",
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    marginBottom: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.72)",
    color: stylesVars.text,
  },

  sources: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginBottom: SPACING.md,
  },

  source: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.14)",
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.58)",
    alignItems: "center",
    justifyContent: "center",
  },

  sourceActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },

  sourceText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
    color: BRAND_DARK,
  },

  sourceTextActive: {
    color: stylesVars.white,
    fontFamily: FONT.bold,
  },

  amountBox: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: BRAND_SOFT,
    borderWidth: 1,
    borderColor: BRAND_SOFT_2,
  },

  amountTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  amountLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    color: stylesVars.textMuted,
  },

  amountChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.65)",
  },

  amountChipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
    color: BRAND,
  },

  amountValue: {
    marginTop: 2,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  amountMeta: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: stylesVars.textMuted,
  },

  warningCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.20)",
    backgroundColor: "#FFF7E8",
  },

  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  warningIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.10)",
  },

  warningTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: "#8A5A00",
    marginBottom: 2,
  },

  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: stylesVars.text,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    backgroundColor: "#FFF1F2",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: stylesVars.danger,
  },

  linksWrap: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },

  quickLink: {
    minHeight: 58,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: CARD_TINT,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOW.card,
  },

  quickLinkIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_SOFT,
  },

  quickLinkText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT.medium,
    color: BRAND_DARK,
  },
});