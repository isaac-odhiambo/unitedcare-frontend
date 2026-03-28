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
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.quickLinkText}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

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
      Alert.alert("Withdrawal", "Enter a valid Kenyan phone number.");
      return;
    }

    if (!amountOk) {
      Alert.alert("Withdrawal", "Enter a valid amount.");
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
        "Withdrawal Request",
        res?.message || "Withdrawal request submitted successfully.",
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
      Alert.alert("Withdrawal", message);
    } finally {
      setSubmitting(false);
    }
  }, [allowed, amount, amountOk, normalizedPhone, phoneOk, source]);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Withdraw</Text>
          <Button
            title="Back"
            variant="ghost"
            onPress={() => router.back()}
            leftIcon={
              <Ionicons name="arrow-back-outline" size={16} color={COLORS.primary} />
            }
          />
        </View>

        {!kycComplete ? (
          <Card style={styles.warningCard}>
            <View style={styles.warningRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={COLORS.warning}
              />
              <Text style={styles.warningText}>
                Complete KYC before requesting a withdrawal.
              </Text>
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
              color={COLORS.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(normalizePhone(v))}
            style={styles.input}
            placeholder="07XXXXXXXX"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmount(v))}
            style={styles.input}
            placeholder="e.g. 1500"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Source</Text>
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
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Requested</Text>
            <Text style={styles.amountValue}>{money(Number(amount || 0))}</Text>
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
                color={COLORS.white}
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
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.md,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },

  title: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  label: {
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
    color: COLORS.text,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    color: COLORS.text,
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
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },

  sourceActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },

  sourceText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
    color: COLORS.text,
  },

  sourceTextActive: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
  },

  amountBox: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  amountLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  amountValue: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  warningCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.18)",
    backgroundColor: "#FFF7E8",
  },

  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.text,
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
    color: COLORS.danger,
  },

  linksWrap: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },

  quickLink: {
    minHeight: 56,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOW.card,
  },

  quickLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },

  quickLinkText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT.medium,
    color: COLORS.text,
  },
});