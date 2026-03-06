// app/(tabs)/payments/deposit.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { getApiErrorMessage, stkDepositSavings } from "@/services/payments";
import { getMe, isAdminUser, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type DepositUser = Partial<MeResponse> & Partial<SessionUser>;

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

export default function DepositScreen() {
  const [user, setUser] = useState<DepositUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  const isAdmin = isAdminUser(user);

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const phoneOk = useMemo(() => /^0\d{9}$/.test(normalizedPhone), [normalizedPhone]);
  const amountOk = useMemo(() => isPositiveAmount(amount), [amount]);
  const canSubmit = phoneOk && amountOk && !submitting;

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

      const mergedUser: DepositUser | null =
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
    if (!phoneOk || !amountOk) return;

    try {
      setSubmitting(true);

      const res = await stkDepositSavings(normalizedPhone, String(Number(amount)));

      const message =
        res?.message ||
        "STK push initiated successfully. Complete the prompt on your phone.";

      router.push({
        pathname: ROUTES.tabs.payments as any,
        params: {
          deposited: "1",
          amount: String(Number(amount)),
          phone: normalizedPhone,
          notice: message,
        },
      });
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [amount, amountOk, normalizedPhone, phoneOk]);

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
          subtitle="Please login to make a deposit."
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
          <Text style={styles.hTitle}>Deposit</Text>
          <Text style={styles.hSub}>
            Send money to your savings through M-Pesa STK • {isAdmin ? "Admin" : "Member"}
          </Text>
        </View>

        <Button
          variant="ghost"
          title="Back"
          onPress={() => router.back()}
          leftIcon={
            <Ionicons
              name="arrow-back-outline"
              size={16}
              color={COLORS.primary}
            />
          }
        />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Section title="Deposit Details">
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
            placeholder="e.g. 1000"
            placeholderTextColor={COLORS.gray}
            keyboardType="numeric"
            style={styles.input}
          />

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
              <Text style={styles.previewLabel}>Purpose</Text>
              <Text style={styles.previewValue}>SAVINGS_DEPOSIT</Text>
            </View>
          </View>

          <Button
            title={submitting ? "Sending STK..." : "Deposit via STK"}
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
        </Card>
      </Section>

      <Section title="Notes">
        <Card style={styles.notesCard}>
          <Text style={styles.noteText}>
            A prompt will be sent to your phone. Enter your M-Pesa PIN to complete
            the deposit. Savings deposits are allowed even before full KYC.
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