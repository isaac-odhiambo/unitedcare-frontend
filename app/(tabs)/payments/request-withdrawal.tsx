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
  TouchableOpacity,
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
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type WithdrawalUser = Partial<MeResponse> & Partial<SessionUser>;

const WITHDRAWAL_SOURCES: WithdrawalSource[] = ["SAVINGS", "MERRY", "GROUP"];

const MPESA = {
  green: "#16A34A",
  greenDark: "#15803D",
  greenSoft: "#EAF8EE",
  greenBorder: "rgba(22,163,74,0.16)",
  slateBg: "#F5F7FA",
  slateCard: "#FFFFFF",
  slateMuted: "#64748B",
  slateText: "#0F172A",
  amberSoft: "#FFF7E8",
  amber: "#D97706",
  redSoft: "#FFF1F2",
};

function normalizePhone(value: string) {
  const v = value.trim().replace(/\s+/g, "");
  if (v.startsWith("+254")) return `0${v.slice(4)}`;
  if (v.startsWith("254")) return `0${v.slice(3)}`;
  return v;
}

function sanitizeAmount(value: string) {
  return value.replace(/[^\d.]/g, "");
}

function isPositiveAmount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function isValidKenyanPhone(phone: string) {
  return /^(07|01)\d{8}$/.test(phone);
}

function formatDisplayName(user?: WithdrawalUser | null) {
  if (!user) return "Member";
  return (
    (user as any)?.full_name ||
    (user as any)?.name ||
    user?.username ||
    (typeof user?.phone === "string" ? user.phone : "") ||
    "Member"
  );
}

function SourceCard({
  label,
  active,
  onPress,
}: {
  label: WithdrawalSource;
  active: boolean;
  onPress: () => void;
}) {
  const icons: Record<WithdrawalSource, keyof typeof Ionicons.glyphMap> = {
    SAVINGS: "wallet-outline",
    MERRY: "repeat-outline",
    GROUP: "people-outline",
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.sourceCard, active && styles.sourceCardActive]}
    >
      <View
        style={[
          styles.sourceIconWrap,
          active && styles.sourceIconWrapActive,
        ]}
      >
        <Ionicons
          name={icons[label]}
          size={18}
          color={active ? MPESA.green : MPESA.slateMuted}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.sourceTitle, active && styles.sourceTitleActive]}>
          {label}
        </Text>
        <Text style={styles.sourceSubtitle}>Withdrawal source</Text>
      </View>

      {active ? (
        <Ionicons name="checkmark-circle" size={18} color={MPESA.green} />
      ) : null}
    </TouchableOpacity>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
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
  const phoneOk = useMemo(
    () => isValidKenyanPhone(normalizedPhone),
    [normalizedPhone]
  );

  const cleanAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? String(n) : "";
  }, [amount]);

  const previewRequestedAmount = useMemo(
    () => Number(cleanAmount || 0) || 0,
    [cleanAmount]
  );

  const canSubmit = withdrawAllowed && phoneOk && amountOk && !submitting;

  const load = useCallback(async () => {
    try {
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

      if (mergedUser) {
        await saveSessionUser(mergedUser);
      }

      const defaultPhone = String(meUser?.phone || sessionUser?.phone || "");
      setPhone(defaultPhone);

      if (meRes.status === "rejected") {
        setError(getApiErrorMessage(meRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        try {
          setLoading(true);
          await load();
        } finally {
          setLoading(false);
        }
      };

      run();
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
      setResult(null);

      const payload = {
        phone: normalizedPhone,
        amount: cleanAmount,
        source,
      };

      const res = await requestWithdrawal(payload);
      const withdrawal = res?.withdrawal ?? null;
      setResult(withdrawal);

      Alert.alert(
        "Withdrawal Request",
        res?.message || "Withdrawal request submitted.",
        [
          {
            text: "OK",
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
  }, [
    amountOk,
    cleanAmount,
    normalizedPhone,
    phoneOk,
    source,
    withdrawAllowed,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={MPESA.green} />
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
          onAction={() => router.replace(ROUTES.auth.login as any)}
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
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: SPACING.md }}>
            <Text style={styles.heroEyebrow}>M-PESA WITHDRAWAL</Text>
            <Text style={styles.heroTitle}>{formatDisplayName(user)}</Text>
            <Text style={styles.heroSubtitle}>
              {isAdmin ? "Admin withdrawal view" : "Request payout to phone"}
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons
              name="arrow-up-circle-outline"
              size={24}
              color={COLORS.white}
            />
          </View>
        </View>

        <View style={styles.heroPills}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {kycComplete ? "KYC Complete" : "KYC Pending"}
            </Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{source}</Text>
          </View>
        </View>
      </View>

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

      {!kycComplete ? (
        <Section title="Verification">
          <Card style={styles.noticeCard}>
            <View style={styles.noticeIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={COLORS.info}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Complete account verification</Text>
              <Text style={styles.noticeText}>
                Withdrawals are locked until KYC is complete.
              </Text>
            </View>
            <Button
              title="Complete KYC"
              variant="ghost"
              onPress={() => router.push(ROUTES.tabs.profileKyc as any)}
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Source">
        <View style={styles.sourceGrid}>
          {WITHDRAWAL_SOURCES.map((s) => (
            <SourceCard
              key={s}
              label={s}
              active={source === s}
              onPress={() => setSource(s)}
            />
          ))}
        </View>
      </Section>

      <Section title="Withdrawal">
        <Card style={styles.formCard}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="07XXXXXXXX"
            placeholderTextColor={MPESA.slateMuted}
            keyboardType="phone-pad"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmount(v))}
            placeholder="e.g. 1500"
            placeholderTextColor={MPESA.slateMuted}
            keyboardType="numeric"
            style={styles.input}
          />

          <View style={styles.summaryBox}>
            <InfoRow label="Phone" value={normalizedPhone || "—"} />
            <InfoRow label="Requested" value={money(previewRequestedAmount)} />
            <InfoRow label="Source" value={source} />
            <InfoRow
              label="Note"
              value="Fee, if any, is calculated by backend"
            />
            <InfoRow
              label="Status"
              value={withdrawAllowed ? "Ready" : "KYC required"}
              valueColor={withdrawAllowed ? COLORS.success : COLORS.warning}
            />
          </View>

          <Button
            title={
              !withdrawAllowed
                ? "Complete KYC"
                : submitting
                ? "Submitting..."
                : "Request Withdrawal"
            }
            onPress={
              !withdrawAllowed
                ? () => router.push(ROUTES.tabs.profileKyc as any)
                : handleSubmit
            }
            disabled={!withdrawAllowed ? false : !canSubmit}
            leftIcon={
              <Ionicons
                name={!withdrawAllowed ? "shield-outline" : "send-outline"}
                size={18}
                color={COLORS.white}
              />
            }
          />
        </Card>
      </Section>

      {result ? (
        <Section title="Latest Request">
          <Card style={styles.latestCard}>
            <InfoRow label="Status" value={result.status || "—"} />
            <InfoRow
              label="Requested"
              value={money(getRequestedWithdrawalAmount(result))}
            />
            <InfoRow
              label="Estimated Fee"
              value={money(getWithdrawalFee(result))}
            />
            <InfoRow
              label="Estimated Payout"
              value={money(getNetWithdrawalPayout(result))}
            />
            <InfoRow label="Phone" value={result.phone || "—"} />
            <InfoRow label="Source" value={result.source || "—"} />
            <InfoRow label="Created" value={result.created_at || "—"} />
          </Card>
        </Section>
      ) : null}

      <Section title="Need">
        <View style={styles.needGrid}>
          <Card
            onPress={() => router.push(ROUTES.tabs.paymentsWithdrawals as any)}
            style={styles.needCard}
          >
            <View style={styles.needIconWrap}>
              <Ionicons name="cash-outline" size={18} color={MPESA.green} />
            </View>
            <Text style={styles.needTitle}>My Withdrawals</Text>
          </Card>

          <Card
            onPress={() => router.push(ROUTES.tabs.payments as any)}
            style={styles.needCard}
          >
            <View style={styles.needIconWrap}>
              <Ionicons name="receipt-outline" size={18} color={MPESA.green} />
            </View>
            <Text style={styles.needTitle}>Payments</Text>
          </Card>
        </View>
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: MPESA.slateBg,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MPESA.slateBg,
  },

  heroCard: {
    backgroundColor: MPESA.green,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  heroEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 1,
  },

  heroTitle: {
    marginTop: 6,
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 24,
    lineHeight: 30,
  },

  heroSubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.90)",
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  heroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },

  heroPills: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },

  heroPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroPillText: {
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  errorCard: {
    backgroundColor: MPESA.redSoft,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.danger,
    fontFamily: FONT.regular,
  },

  noticeCard: {
    backgroundColor: MPESA.slateCard,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: MPESA.greenBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: MPESA.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeTitle: {
    fontSize: 14,
    fontFamily: FONT.bold,
    color: MPESA.slateText,
  },

  noticeText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: MPESA.slateMuted,
    fontFamily: FONT.regular,
  },

  sourceGrid: {
    gap: SPACING.sm,
  },

  sourceCard: {
    backgroundColor: MPESA.slateCard,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  sourceCardActive: {
    borderColor: MPESA.greenBorder,
    backgroundColor: MPESA.greenSoft,
  },

  sourceIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },

  sourceIconWrapActive: {
    backgroundColor: "rgba(22,163,74,0.10)",
  },

  sourceTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: MPESA.slateText,
  },

  sourceTitleActive: {
    color: MPESA.greenDark,
  },

  sourceSubtitle: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: MPESA.slateMuted,
  },

  formCard: {
    backgroundColor: MPESA.slateCard,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },

  label: {
    marginBottom: 8,
    fontFamily: FONT.medium,
    fontSize: 12,
    color: MPESA.slateText,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    marginBottom: SPACING.md,
    backgroundColor: "#FFFFFF",
    color: MPESA.slateText,
  },

  summaryBox: {
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: MPESA.slateBg,
  },

  infoRow: {
    paddingVertical: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  infoLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: MPESA.slateMuted,
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: MPESA.slateText,
  },

  latestCard: {
    backgroundColor: MPESA.slateCard,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },

  needGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  needCard: {
    flex: 1,
    backgroundColor: MPESA.slateCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    padding: SPACING.md,
    alignItems: "center",
  },

  needIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MPESA.greenSoft,
    marginBottom: SPACING.sm,
  },

  needTitle: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: MPESA.slateText,
  },
});