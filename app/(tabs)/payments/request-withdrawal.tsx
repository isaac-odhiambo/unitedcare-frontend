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
import {
  getApiErrorMessage,
  getNetWithdrawalPayout,
  getRequestedWithdrawalAmount,
  getWithdrawalFee,
  money,
  requestWithdrawal,
  WithdrawalRequest,
  WithdrawalSource,
} from "@/services/payments";
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

function isPositiveAmount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function isValidKenyanPhone(phone: string) {
  return /^(07|01)\d{8}$/.test(phone);
}

function SourceChip({
  label,
  active,
  onPress,
}: {
  label: WithdrawalSource;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={[styles.sourceChip, active && styles.sourceChipActive]}>
      <Text style={[styles.sourceChipText, active && styles.sourceChipTextActive]}>
        {label}
      </Text>
    </Card>
  );
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

  const [result, setResult] = useState<WithdrawalRequest | null>(null);

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const withdrawAllowed = canWithdraw(user);

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const amountOk = useMemo(() => isPositiveAmount(amount), [amount]);
  const phoneOk = useMemo(() => isValidKenyanPhone(normalizedPhone), [normalizedPhone]);
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
      setResult(null);

      const payload = {
        phone: normalizedPhone,
        amount: String(Number(amount)),
        source,
      };

      const res = await requestWithdrawal(payload);
      const withdrawal = res?.withdrawal ?? null;
      setResult(withdrawal);

      const requestedAmount = withdrawal
        ? money(getRequestedWithdrawalAmount(withdrawal))
        : money(amount);

      const feeAmount = withdrawal
        ? money(getWithdrawalFee(withdrawal))
        : "Determined by backend";

      const netPayout = withdrawal
        ? money(getNetWithdrawalPayout(withdrawal))
        : "Determined by backend";

      Alert.alert(
        "Withdrawal Request",
        [
          res?.message || "Withdrawal request submitted successfully.",
          "",
          `Requested amount: ${requestedAmount}`,
          `Possible fee: ${feeAmount}`,
          `Possible net payout: ${netPayout}`,
        ].join("\n"),
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
  }, [amount, amountOk, normalizedPhone, phoneOk, source, withdrawAllowed]);

  const previewRequested = result
    ? money(getRequestedWithdrawalAmount(result))
    : money(amount || 0);

  const previewFee = result
    ? money(getWithdrawalFee(result))
    : "Determined by backend";

  const previewNet = result
    ? money(getNetWithdrawalPayout(result))
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

          <Text style={styles.label}>Amount to Withdraw</Text>
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
            {WITHDRAWAL_SOURCES.map((s) => (
              <SourceChip
                key={s}
                label={s}
                active={source === s}
                onPress={() => setSource(s)}
              />
            ))}
          </View>

          <Card style={styles.noticeBox}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.noticeBoxText}>
              Enter the amount you want removed from your {source.toLowerCase()} balance.
              If a withdrawal fee is configured, your final Mpesa payout may be lower.
            </Text>
          </Card>

          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Phone</Text>
              <Text style={styles.previewValue}>{normalizedPhone || "—"}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Requested amount</Text>
              <Text style={styles.previewValue}>{previewRequested}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Possible fee</Text>
              <Text style={styles.previewValue}>{previewFee}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Possible net payout</Text>
              <Text style={styles.previewValue}>{previewNet}</Text>
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

      {result ? (
        <Section title="Latest Request">
          <Card style={styles.latestCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Status</Text>
              <Text style={styles.previewValue}>{result.status || "—"}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Requested amount</Text>
              <Text style={styles.previewValue}>
                {money(getRequestedWithdrawalAmount(result))}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Possible fee</Text>
              <Text style={styles.previewValue}>
                {money(getWithdrawalFee(result))}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Possible net payout</Text>
              <Text style={styles.previewValue}>
                {money(getNetWithdrawalPayout(result))}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Created</Text>
              <Text style={styles.previewValue}>{result.created_at || "—"}</Text>
            </View>
          </Card>
        </Section>
      ) : null}

      <Section title="Notes">
        <Card style={styles.notesCard}>
          <Text style={styles.noteText}>
            Withdrawal requests are reviewed before Mpesa payout. Use the same
            phone number you want the payout sent to. If admin has configured a
            withdrawal fee, the money you receive on Mpesa may be less than the
            amount requested.
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

  sourceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  sourceChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },

  sourceChipText: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.text,
  },

  sourceChipTextActive: {
    color: COLORS.primary,
  },

  noticeBox: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
  },

  noticeBoxText: {
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
    gap: SPACING.md,
    paddingVertical: 6,
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