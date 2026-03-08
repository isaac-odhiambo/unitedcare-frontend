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
import {
  getApiErrorMessage,
  getBaseAmount,
  getChargedAmount,
  getTransactionFee,
  money,
  stkDepositSavings,
  StkPushResponse,
} from "@/services/payments";
import { getMe, isAdminUser, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type DepositUser = Partial<MeResponse> & Partial<SessionUser>;

function normalizePhone(value: string) {
  const v = value.trim().replace(/\s+/g, "");
  if (v.startsWith("+254")) return `0${v.slice(4)}`;
  if (v.startsWith("254")) return `0${v.slice(3)}`;
  return v;
}

function isValidKenyanPhone(phone: string) {
  return /^(07|01)\d{8}$/.test(phone);
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
  const [result, setResult] = useState<StkPushResponse | null>(null);

  const isAdmin = isAdminUser(user);

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const phoneOk = useMemo(() => isValidKenyanPhone(normalizedPhone), [normalizedPhone]);
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
      setResult(null);

      const res = await stkDepositSavings(
        normalizedPhone,
        String(Number(amount))
      );

      setResult(res);

      const tx = res?.tx;
      const baseAmount = money(getBaseAmount(tx) || Number(amount));
      const feeAmount =
        tx ? money(getTransactionFee(tx)) : "Determined by backend";
      const chargedAmount =
        tx ? money(getChargedAmount(tx)) : "Determined by backend";

      const message =
        res?.message ||
        "STK push initiated successfully. Complete the prompt on your phone.";

      router.push({
        pathname: ROUTES.tabs.payments as any,
        params: {
          deposited: "1",
          amount: String(Number(amount)),
          phone: normalizedPhone,
          notice: `${message}\nRequested credit: ${baseAmount}\nPossible fee: ${feeAmount}\nPossible charged amount: ${chargedAmount}`,
        },
      });
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [amount, amountOk, normalizedPhone, phoneOk]);

  const previewBase = result?.tx
    ? money(getBaseAmount(result.tx))
    : money(amount || 0);

  const previewFee = result?.tx
    ? money(getTransactionFee(result.tx))
    : "Determined by backend";

  const previewCharged = result?.tx
    ? money(getChargedAmount(result.tx))
    : "Determined by backend";

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

          <Text style={styles.label}>Amount to Credit</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 1000"
            placeholderTextColor={COLORS.gray}
            keyboardType="numeric"
            style={styles.input}
          />

          <Card style={styles.noticeCard}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.noticeText}>
              Enter the amount you want credited to savings. If a deposit transaction fee
              is configured, the STK prompt on your phone may be higher than the amount entered.
            </Text>
          </Card>

          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Phone</Text>
              <Text style={styles.previewValue}>{normalizedPhone || "—"}</Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Amount to credit</Text>
              <Text style={styles.previewValue}>{previewBase}</Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Possible fee</Text>
              <Text style={styles.previewValue}>{previewFee}</Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Possible charged amount</Text>
              <Text style={styles.previewValue}>{previewCharged}</Text>
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

      {result ? (
        <Section title="Latest STK Request">
          <Card style={styles.latestCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Status</Text>
              <Text style={styles.previewValue}>{result.tx?.status || "—"}</Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Requested credit</Text>
              <Text style={styles.previewValue}>
                {money(getBaseAmount(result.tx))}
              </Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Possible fee</Text>
              <Text style={styles.previewValue}>
                {money(getTransactionFee(result.tx))}
              </Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Possible charged amount</Text>
              <Text style={styles.previewValue}>
                {money(getChargedAmount(result.tx))}
              </Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Checkout ID</Text>
              <Text style={styles.previewValue}>
                {result.tx?.checkout_request_id || "—"}
              </Text>
            </View>
          </Card>
        </Section>
      ) : null}

      <Section title="Notes">
        <Card style={styles.notesCard}>
          <Text style={styles.noteText}>
            A prompt will be sent to your phone. Enter your M-Pesa PIN to complete
            the deposit. Savings deposits are allowed even before full KYC. Where
            transaction fees are configured, the amount charged on STK may be higher
            than the amount credited into savings.
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

  noticeCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
  },

  noticeText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray,
  },

  previewCard: {
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },

  latestCard: {
    padding: SPACING.md,
  },

  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: SPACING.md,
  },

  previewLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  previewValue: {
    flexShrink: 1,
    textAlign: "right",
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