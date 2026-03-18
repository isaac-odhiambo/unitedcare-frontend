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
  TouchableOpacity,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import {
  COLORS,
  FONT,
  getMpesaMethodColors,
  P,
  RADIUS,
  SPACING,
  TYPE,
} from "@/constants/theme";
import {
  getApiErrorMessage,
  money,
  stkDepositSavings,
  StkPushResponse,
} from "@/services/payments";
import { getMe, isAdminUser, MeResponse } from "@/services/profile";
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type DepositUser = Partial<MeResponse> & Partial<SessionUser>;
type DepositMethod = "STK" | "PAYBILL";

const FALLBACK_PAYBILL_NUMBER = "PAYBILL_NUMBER";

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

function sanitizeAmount(value: string) {
  return value.replace(/[^\d.]/g, "");
}

function formatDisplayName(user?: DepositUser | null) {
  if (!user) return "Member";
  return (
    (user as any)?.full_name ||
    (user as any)?.name ||
    user?.username ||
    (typeof user?.phone === "string" ? user.phone : "") ||
    "Member"
  );
}

function getUserId(user?: DepositUser | null) {
  const raw =
    (user as any)?.id ??
    (user as any)?.user_id ??
    (user as any)?.pk ??
    null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getPaybillNumber(user?: DepositUser | null) {
  const raw =
    (user as any)?.mpesa_paybill_number ||
    (user as any)?.paybill_number ||
    (user as any)?.business_number ||
    (user as any)?.mpesa_business_number ||
    (user as any)?.paybill ||
    FALLBACK_PAYBILL_NUMBER;

  const value = String(raw || "").trim();
  return value || FALLBACK_PAYBILL_NUMBER;
}

function getSavingsReference(user?: DepositUser | null) {
  const userId = getUserId(user);
  if (userId) return `saving${userId}`;
  return "saving";
}

function SmallMethodCard({
  active,
  title,
  subtitle,
  icon,
  onPress,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const tone = getMpesaMethodColors(active);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.methodCard,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
        },
      ]}
    >
      <View
        style={[
          styles.methodIconWrap,
          {
            backgroundColor: tone.iconBg,
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={tone.icon} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.methodTitle, { color: tone.title }]}>{title}</Text>
        <Text style={[styles.methodSubtitle, { color: tone.subtitle }]}>
          {subtitle}
        </Text>
      </View>

      {active ? (
        <Ionicons name="checkmark-circle" size={18} color={COLORS.mpesa} />
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

export default function DepositScreen() {
  const [user, setUser] = useState<DepositUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<DepositMethod>("STK");
  const [result, setResult] = useState<StkPushResponse | null>(null);

  const isAdmin = isAdminUser(user);

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const phoneOk = useMemo(
    () => isValidKenyanPhone(normalizedPhone),
    [normalizedPhone]
  );
  const amountOk = useMemo(() => isPositiveAmount(amount), [amount]);

  const cleanAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? String(n) : "";
  }, [amount]);

  const accountReference = useMemo(() => getSavingsReference(user), [user]);
  const paybillNumber = useMemo(() => getPaybillNumber(user), [user]);
  const paybillEnabled = useMemo(
    () => paybillNumber !== FALLBACK_PAYBILL_NUMBER,
    [paybillNumber]
  );

  const canSubmit = method === "STK" && phoneOk && amountOk && !submitting;

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

      const mergedUser: DepositUser | null =
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
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      setError("");
      setResult(null);

      const res = await stkDepositSavings(
        normalizedPhone,
        cleanAmount,
        accountReference
      );

      setResult(res);

      router.push({
        pathname: ROUTES.tabs.payments as any,
        params: {
          deposited: "1",
          amount: cleanAmount,
          phone: normalizedPhone,
          notice: res?.message || "STK sent.",
        },
      });
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [accountReference, canSubmit, cleanAmount, normalizedPhone]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.mpesa} />
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
            <Text style={styles.heroEyebrow}>M-PESA DEPOSIT</Text>
            <Text style={styles.heroTitle}>{formatDisplayName(user)}</Text>
            <Text style={styles.heroSubtitle}>
              {isAdmin ? "Admin view" : "Savings deposit"}
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons
              name="phone-portrait-outline"
              size={24}
              color={COLORS.white}
            />
          </View>
        </View>

        <View style={styles.heroPills}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>STK</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>Paybill</Text>
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

      <Section title="Method">
        <View style={styles.methodGrid}>
          <SmallMethodCard
            active={method === "STK"}
            title="STK Push"
            subtitle="Prompt to phone"
            icon="phone-portrait-outline"
            onPress={() => setMethod("STK")}
          />
          <SmallMethodCard
            active={method === "PAYBILL"}
            title="Paybill"
            subtitle={paybillEnabled ? "Manual payment" : "Not available"}
            icon="grid-outline"
            onPress={() => setMethod("PAYBILL")}
          />
        </View>
      </Section>

      {method === "STK" ? (
        <Section title="Deposit">
          <Card style={styles.formCard}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="07XXXXXXXX"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="phone-pad"
              autoCapitalize="none"
              style={styles.input}
            />

            <Text style={styles.label}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(sanitizeAmount(v))}
              placeholder="1000"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="numeric"
              style={styles.input}
            />

            <View style={styles.summaryBox}>
              <InfoRow label="Phone" value={normalizedPhone || "—"} />
              <InfoRow label="Amount" value={money(amount || 0)} />
              <InfoRow label="Method" value="STK" />
              <InfoRow label="Ref" value={accountReference} />
            </View>

            <Button
              title={submitting ? "Sending..." : "Send STK"}
              onPress={handleSubmit}
              disabled={!canSubmit}
              leftIcon={
                <Ionicons
                  name="paper-plane-outline"
                  size={18}
                  color={COLORS.white}
                />
              }
            />
          </Card>
        </Section>
      ) : (
        <Section title="Paybill">
          <Card style={styles.paybillCard}>
            <View style={styles.paybillTop}>
              <View style={styles.paybillBadge}>
                <Ionicons name="grid-outline" size={18} color={COLORS.mpesa} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.paybillTitle}>Manual Payment</Text>
                <Text style={styles.paybillSubtitle}>
                  {paybillEnabled
                    ? "Use the details below."
                    : "Admin has not set the paybill number yet."}
                </Text>
              </View>
            </View>

            <View style={styles.summaryBox}>
              <InfoRow
                label="Business No."
                value={paybillEnabled ? paybillNumber : "Not set"}
                valueColor={!paybillEnabled ? COLORS.danger : undefined}
              />
              <InfoRow label="Account" value={accountReference} />
              <InfoRow
                label="Phone"
                value={normalizedPhone || "Use your M-Pesa line"}
              />
              <InfoRow label="Amount" value={money(amount || 0)} />
            </View>

            {!paybillEnabled ? (
              <Card style={styles.tipCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={COLORS.accentDark}
                />
                <Text style={styles.tipText}>
                  Paybill number not available yet.
                </Text>
              </Card>
            ) : null}
          </Card>
        </Section>
      )}

      {result?.tx ? (
        <Section title="Latest Request">
          <Card style={styles.latestCard}>
            <InfoRow label="Status" value={result.tx.status || "—"} />
            <InfoRow
              label="Amount"
              value={money(result.tx.base_amount || amount || 0)}
            />
            <InfoRow label="Phone" value={normalizedPhone || "—"} />
            <InfoRow label="Ref" value={result.tx.reference || accountReference} />
            <InfoRow
              label="Checkout ID"
              value={result.tx.checkout_request_id || "—"}
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Need">
        <View style={styles.needGrid}>
          <Card
            onPress={() => router.push(ROUTES.tabs.payments as any)}
            style={styles.needCard}
          >
            <View style={styles.needIconWrap}>
              <Ionicons name="receipt-outline" size={18} color={COLORS.mpesa} />
            </View>
            <Text style={styles.needTitle}>Payments</Text>
          </Card>

          <Card
            onPress={() => router.push(ROUTES.tabs.savings as any)}
            style={styles.needCard}
          >
            <View style={styles.needIconWrap}>
              <Ionicons name="wallet-outline" size={18} color={COLORS.mpesa} />
            </View>
            <Text style={styles.needTitle}>Savings</Text>
          </Card>
        </View>
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    ...P.page,
  },

  content: {
    ...P.content,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  heroCard: {
    ...P.paymentHero,
    marginBottom: SPACING.lg,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  heroEyebrow: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.bold,
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
    ...TYPE.subtext,
    marginTop: 8,
    color: "rgba(255,255,255,0.90)",
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
    ...P.paymentError,
    marginBottom: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  errorText: {
    flex: 1,
    ...TYPE.subtext,
    color: COLORS.danger,
  },

  methodGrid: {
    gap: SPACING.sm,
  },

  methodCard: {
    ...P.methodCard,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  methodIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  methodTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  methodSubtitle: {
    marginTop: 4,
    ...TYPE.subtext,
  },

  formCard: {
    ...P.paymentCard,
  },

  label: {
    ...TYPE.label,
    marginBottom: 8,
    color: COLORS.text,
  },

  input: {
    ...P.input,
    height: 50,
    marginBottom: SPACING.md,
  },

  summaryBox: {
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceAlt,
  },

  infoRow: {
    paddingVertical: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  infoLabel: {
    ...TYPE.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    ...TYPE.bodyStrong,
    fontSize: 12,
    color: COLORS.text,
  },

  paybillCard: {
    ...P.paymentCard,
  },

  paybillTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },

  paybillBadge: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.mpesaSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  paybillTitle: {
    ...TYPE.title,
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  paybillSubtitle: {
    marginTop: 5,
    ...TYPE.subtext,
  },

  tipCard: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.paymentWarningBg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.18)",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  tipText: {
    flex: 1,
    ...TYPE.subtext,
    color: COLORS.accentDark,
  },

  latestCard: {
    ...P.paymentCard,
  },

  needGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  needCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    alignItems: "center",
  },

  needIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.mpesaSoft,
    marginBottom: SPACING.sm,
  },

  needTitle: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.text,
  },
});