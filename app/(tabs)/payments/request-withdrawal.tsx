// app/(tabs)/payments/request-withdrawal.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getApiErrorMessage, requestWithdrawal, WithdrawalSource } from "@/services/payments";
import {
  canWithdraw,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type WithdrawalUser = Partial<MeResponse> & Partial<SessionUser>;

const WITHDRAWAL_SOURCES: WithdrawalSource[] = ["SAVINGS", "MERRY", "GROUP"];

function normalizePhone(value: string) {
  const v = value.trim().replace(/\s+/g, "");
  if (v.startsWith("+254")) return `0${v.slice(4)}`;
  if (v.startsWith("254")) return `0${v.slice(3)}`;
  return v;
}

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isPositiveAmount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export default function RequestWithdrawalScreen() {
  const [user, setUser] = useState<WithdrawalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<WithdrawalSource>("SAVINGS");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const withdrawAllowed = canWithdraw(user);

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const amountOk = useMemo(() => isPositiveAmount(amount), [amount]);
  const phoneOk = useMemo(() => /^0\d{9}$/.test(normalizedPhone), [normalizedPhone]);
  const canSubmit = withdrawAllowed && phoneOk && amountOk && !submitting;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: WithdrawalUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      const defaultPhone = String(meUser?.phone || sessionUser?.phone || "");
      setPhone(defaultPhone);

      if (meRes.status === "rejected") {
        setError(getApiErrorMessage(meRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
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

  const handleSubmit = useCallback(async () => {
    if (!withdrawAllowed) {
      router.push(ROUTES.tabs.profileKyc);
      return;
    }

    if (!phoneOk) {
      Alert.alert("Withdrawal", "Enter a valid Kenyan phone number.");
      return;
    }

    if (!amountOk) {
      Alert.alert("Withdrawal", "Enter a valid withdrawal amount.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        phone: normalizedPhone,
        amount: String(Number(amount)),
        source,
      };

      const res = await requestWithdrawal(payload);

      Alert.alert(
        "Withdrawal Request",
        res?.message || "Withdrawal request submitted successfully.",
        [
          {
            text: "OK",
            onPress: () => router.replace(ROUTES.tabs.paymentsWithdrawals),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Withdrawal", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [amount, amountOk, normalizedPhone, phoneOk, router, source, withdrawAllowed]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to request a withdrawal."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Request Withdrawal</Text>
          <Text style={styles.hSub}>
            Submit a payout request to your phone • {isAdmin ? "Admin" : "Member"}
          </Text>
        </View>

        <Button
          variant="ghost"
          title="Back"
          onPress={() => router.back()}
          leftIcon={
            <Ionicons name="arrow-back-outline" size={16} color={COLORS.primary} />
          }
        />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!kycComplete ? (
        <Section title="KYC Required">
          <Card style={styles.noticeCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.noticeText}>
              Withdrawals are locked until your KYC is complete.
            </Text>
            <View style={{ height: SPACING.sm }} />
            <Button
              title="Complete KYC"
              variant="secondary"
              onPress={() => router.push(ROUTES.tabs.profileKyc)}
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Request Details">
        <Card style={styles.formCard}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="07XXXXXXXX"
            placeholderTextColor={COLORS.gray}
            keyboardType="phone-pad"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 1500"
            placeholderTextColor={COLORS.gray}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>Source</Text>
          <View style={styles.sourceWrap}>
            {WITHDRAWAL_SOURCES.map((s) => {
              const active = source === s;
              return (
                <Button
                  key={s}
                  title={s}
                  variant={active ? "primary" : "secondary"}
                  onPress={() => setSource(s)}
                  style={styles.sourceBtn}
                />
              );
            })}
          </View>

          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Phone</Text>
              <Text style={styles.previewValue}>{normalizedPhone || "—"}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Amount</Text>
              <Text style={styles.previewValue}>{formatKes(amount || 0)}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Source</Text>
              <Text style={styles.previewValue}>{source}</Text>
            </View>
          </View>

          <Button
            title={
              !withdrawAllowed
                ? "Complete KYC"
                : submitting
                ? "Submitting..."
                : "Submit Withdrawal"
            }
            onPress={
              !withdrawAllowed
                ? () => router.push(ROUTES.tabs.profileKyc)
                : handleSubmit
            }
            disabled={!withdrawAllowed ? false : !canSubmit}
          />
        </Card>
      </Section>

      <Section title="Notes">
        <Card style={styles.notesCard}>
          <Text style={styles.noteText}>
            Withdrawal requests are reviewed before Mpesa payout. Use the same
            phone number you want the payout sent to.
          </Text>
        </Card>
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
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

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.danger,
    fontFamily: FONT.regular,
  },

  noticeCard: {
    padding: SPACING.md,
  },

  noticeText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
  },

  formCard: {
    padding: SPACING.md,
  },

  label: {
    marginBottom: 8,
    fontFamily: FONT.medium,
    fontSize: 12,
    color: COLORS.dark,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    color: COLORS.dark,
  },

  sourceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
    marginBottom: SPACING.md,
  },

  sourceBtn: {
    minWidth: 96,
  },

  previewCard: {
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },

  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },

  previewLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  previewValue: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },

  notesCard: {
    padding: SPACING.md,
  },

  noteText: {
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray,
  },
});