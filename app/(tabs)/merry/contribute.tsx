// app/(tabs)/merry/contribute.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  getMerryDetail,
  MerryDetail,
  stkPayMerryContribution,
} from "@/services/merry";
import {
  canJoinMerry,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryContributionUser = Partial<MeResponse> & Partial<SessionUser>;

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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

export default function MerryContributeScreen() {
  const params = useLocalSearchParams<{ merryId?: string }>();
  const merryId = Number(params.merryId ?? 0);

  const [user, setUser] = useState<MerryContributionUser | null>(null);
  const [merry, setMerry] = useState<MerryDetail | null>(null);

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const merryAllowed = canJoinMerry(user);

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const phoneOk = useMemo(() => /^0\d{9}$/.test(normalizedPhone), [normalizedPhone]);
  const amountOk = useMemo(() => isPositiveAmount(amount), [amount]);
  const baseAmount = useMemo(() => Number(amount || 0), [amount]);
  const canSubmit = merryAllowed && phoneOk && amountOk && !submitting && !!merry;

  const load = useCallback(async () => {
    if (!merryId || !Number.isFinite(merryId)) {
      setError("Missing or invalid merry ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, merryRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMerryDetail(merryId),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser =
        meRes.status === "fulfilled" ? meRes.value : null;

      setUser(
        sessionUser || meUser
          ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
          : null
      );

      setPhone(String(meUser?.phone || sessionUser?.phone || ""));

      if (merryRes.status === "fulfilled") {
        setMerry(merryRes.value);
        setAmount((prev) =>
          prev && prev.trim().length > 0
            ? prev
            : String(merryRes.value?.contribution_amount || "")
        );
      } else {
        setMerry(null);
        setError(getApiErrorMessage(merryRes.reason));
      }

      if (meRes.status === "rejected" && !error) {
        setError(getErrorMessage(meRes.reason));
      }
    } catch (e: any) {
      setError(getErrorMessage(e));
      setMerry(null);
    } finally {
      setLoading(false);
    }
  }, [error, merryId]);

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
    if (!merryAllowed || !merry) return;

    try {
      setSubmitting(true);
      setError("");

      const res = await stkPayMerryContribution({
        merry_id: merry.id,
        amount: String(Number(amount)), // base amount only
        phone: normalizedPhone,
        narration: `Merry contribution for ${merry.name}`,
      });

      const chargedAmount =
        res?.stk?.tx?.amount ??
        res?.payment_intent?.amount ??
        String(Number(amount));

      const feeAmount =
        (res?.stk?.tx as any)?.transaction_fee ?? "0";

      const notice =
        res?.stk?.message ||
        "STK push initiated. Complete the payment prompt on your phone.";

      router.replace({
        pathname: ROUTES.dynamic.merryDetail(merry.id) as any,
        params: {
          contributed: "1",
          baseAmount: String(Number(amount)),
          chargedAmount: String(chargedAmount),
          feeAmount: String(feeAmount),
          notice,
        },
      });
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [amount, merry, merryAllowed, normalizedPhone]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!merryId || !Number.isFinite(merryId)) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Invalid merry"
          subtitle="No merry was selected for contribution."
          actionLabel="Back to Merry"
          onAction={() => router.replace(ROUTES.tabs.merry)}
        />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to contribute to merry-go-round."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login)}
        />
      </View>
    );
  }

  if (!merry) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Unable to load merry"
          subtitle={error || "This merry could not be loaded."}
          actionLabel="Back to Merry"
          onAction={() => router.replace(ROUTES.tabs.merry)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Contribute</Text>
          <Text style={styles.hSub}>
            M-Pesa STK contribution • {isAdmin ? "Admin" : "Member"}
          </Text>
        </View>

        <Button
          variant="ghost"
          title="Back"
          onPress={() => router.back()}
          leftIcon={<Ionicons name="arrow-back-outline" size={16} color={COLORS.primary} />}
        />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!merryAllowed ? (
        <Section title="Account Status">
          <Card style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
            <Text style={styles.noticeText}>
              Your account must be approved before contributing to a merry-go-round.
            </Text>
          </Card>
        </Section>
      ) : !kycComplete ? (
        <Section title="KYC Notice">
          <Card style={styles.noticeCard}>
            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.info} />
            <Text style={styles.noticeText}>
              You can contribute before full KYC, but some withdrawal-related actions remain limited until KYC is complete.
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

      <Section title="Merry Details">
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Name</Text>
            <Text style={styles.summaryValue}>{merry.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Suggested per seat</Text>
            <Text style={styles.summaryValue}>{formatKes(merry.contribution_amount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frequency</Text>
            <Text style={styles.summaryValue}>{String(merry.payout_frequency || "—")}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Slots / Period</Text>
            <Text style={styles.summaryValue}>{String(merry.payouts_per_period || "1")}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Next Payout</Text>
            <Text style={styles.summaryValue}>{merry.next_payout_date || "—"}</Text>
          </View>
        </Card>
      </Section>

      <Section title="Contribution Details">
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

          <Text style={styles.label}>Contribution Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 500"
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
              <Text style={styles.previewLabel}>Base contribution</Text>
              <Text style={styles.previewValue}>{formatKes(baseAmount || 0)}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Merry</Text>
              <Text style={styles.previewValue}>{merry.name}</Text>
            </View>
          </View>

          <Card style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
            <Text style={styles.infoText}>
              Enter only the base contribution amount. Any transaction fee is applied automatically by the backend using admin settings.
            </Text>
          </Card>

          <View style={{ height: SPACING.md }} />

          <Button
            title={
              !merryAllowed
                ? "Account Not Eligible"
                : submitting
                ? "Sending STK..."
                : "Contribute via STK"
            }
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
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

  summaryCard: {
    padding: SPACING.md,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: SPACING.md,
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  summaryValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
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

  infoCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    ...SHADOW.card,
  },

  infoText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
  },
});