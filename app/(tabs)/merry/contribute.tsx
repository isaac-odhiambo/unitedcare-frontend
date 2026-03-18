// app/(tabs)/payments/merry-contribute.tsx
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
import {
  COLORS,
  FONT,
  P,
  RADIUS,
  SPACING,
  TYPE,
} from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  getMerryDetail,
  getMerrySeats,
  MerryDetail,
  MerrySeatRow,
  stkPayMerryContribution,
} from "@/services/merry";
import {
  canJoinMerry,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, saveSessionUser, SessionUser } from "@/services/session";

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

function isValidKenyanPhone(phone: string) {
  return /^(07|01)\d{8}$/.test(phone);
}

function isPositiveAmount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function formatDisplayName(user?: MerryContributionUser | null) {
  if (!user) return "Member";
  return (
    (user as any)?.full_name ||
    (user as any)?.name ||
    user?.username ||
    (typeof user?.phone === "string" ? user.phone : "") ||
    "Member"
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

export default function MerryContributeScreen() {
  const params = useLocalSearchParams<{ merryId?: string }>();
  const merryId = Number(params.merryId ?? 0);

  const [user, setUser] = useState<MerryContributionUser | null>(null);
  const [merry, setMerry] = useState<MerryDetail | null>(null);
  const [mySeats, setMySeats] = useState<MerrySeatRow[]>([]);

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
  const phoneOk = useMemo(() => isValidKenyanPhone(normalizedPhone), [normalizedPhone]);
  const amountOk = useMemo(() => isPositiveAmount(amount), [amount]);
  const baseAmount = useMemo(() => Number(amount || 0), [amount]);

  const isMemberOfThisMerry = mySeats.length > 0;
  const canSubmit =
    merryAllowed &&
    isMemberOfThisMerry &&
    !isAdmin &&
    phoneOk &&
    amountOk &&
    !submitting &&
    !!merry;

  const load = useCallback(async () => {
    if (!merryId || !Number.isFinite(merryId)) {
      setError("Missing or invalid merry ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, merryRes, seatsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMerryDetail(merryId),
        getMerrySeats(merryId),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser =
        sessionUser || meUser
          ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
          : null;

      setUser(mergedUser);

      if (mergedUser) {
        await saveSessionUser(mergedUser);
      }

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

      const allSeats =
        seatsRes.status === "fulfilled" && Array.isArray(seatsRes.value)
          ? seatsRes.value
          : [];

      const myUserId = Number(meUser?.id || sessionUser?.id || 0);
      const mine =
        myUserId > 0
          ? allSeats.filter((s) => Number(s.user_id) === myUserId)
          : [];

      setMySeats(mine);

      if (meRes.status === "rejected" && merryRes.status !== "rejected") {
        setError(getErrorMessage(meRes.reason));
      }
    } catch (e: any) {
      setError(getErrorMessage(e));
      setMerry(null);
      setMySeats([]);
    } finally {
      setLoading(false);
    }
  }, [merryId]);

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
    if (!merryAllowed || !merry || !isMemberOfThisMerry || isAdmin) return;

    try {
      setSubmitting(true);
      setError("");

      const cleanAmount = String(Number(amount));

      const res = await stkPayMerryContribution({
        merry_id: merry.id,
        amount: cleanAmount,
        phone: normalizedPhone,
        narration: `Merry contribution for ${merry.name}`,
      });

      const chargedAmount =
        res?.stk?.tx?.amount ?? res?.payment_intent?.amount ?? cleanAmount;

      const feeAmount = (res?.stk?.tx as any)?.transaction_fee ?? "0";

      const notice =
        res?.stk?.message ||
        "STK push initiated. Complete the payment prompt on your phone.";

      router.replace({
        pathname: ROUTES.dynamic.merryDetail(merry.id) as any,
        params: {
          contributed: "1",
          baseAmount: cleanAmount,
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
  }, [amount, isAdmin, isMemberOfThisMerry, merry, merryAllowed, normalizedPhone]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.mpesa} />
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
          onAction={() => router.replace(ROUTES.tabs.merry as any)}
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
          onAction={() => router.replace(ROUTES.auth.login as any)}
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
          onAction={() => router.replace(ROUTES.tabs.merry as any)}
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
            <Text style={styles.heroEyebrow}>MERRY CONTRIBUTION</Text>
            <Text style={styles.heroTitle}>{merry.name}</Text>
            <Text style={styles.heroSubtitle}>
              {isAdmin ? "Admin view" : formatDisplayName(user)}
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="repeat-outline" size={24} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroPills}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{String(mySeats.length)} seat(s)</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {kycComplete ? "KYC Complete" : "KYC Pending"}
            </Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>STK Push</Text>
          </View>
        </View>
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
            <View style={styles.noticeIcon}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={COLORS.info}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Approval required</Text>
              <Text style={styles.noticeText}>
                Your account must be approved before contributing to a merry.
              </Text>
            </View>
          </Card>
        </Section>
      ) : isAdmin ? (
        <Section title="Admin Notice">
          <Card style={styles.noticeCard}>
            <View style={styles.noticeIcon}>
              <Ionicons name="shield-outline" size={18} color={COLORS.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Admin account</Text>
              <Text style={styles.noticeText}>
                Contribute here only if this admin account is an actual member of
                the merry.
              </Text>
            </View>
          </Card>
        </Section>
      ) : !isMemberOfThisMerry ? (
        <Section title="Membership Required">
          <Card style={styles.noticeCard}>
            <View style={styles.noticeIcon}>
              <Ionicons name="people-outline" size={18} color={COLORS.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Join first</Text>
              <Text style={styles.noticeText}>
                You need at least one assigned seat before contributing.
              </Text>
            </View>
          </Card>
        </Section>
      ) : !kycComplete ? (
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
              <Text style={styles.noticeTitle}>KYC not complete</Text>
              <Text style={styles.noticeText}>
                You can contribute now, but some withdrawal actions stay limited
                until KYC is complete.
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

      <Section title="Merry">
        <Card style={styles.summaryCard}>
          <InfoRow label="Name" value={merry.name} />
          <InfoRow
            label="Per seat"
            value={formatKes(merry.contribution_amount)}
          />
          <InfoRow label="My seats" value={String(mySeats.length)} />
          <InfoRow
            label="Frequency"
            value={String(merry.payout_frequency || "—")}
          />
          <InfoRow
            label="Slots / period"
            value={String(merry.payouts_per_period || "1")}
          />
          <InfoRow
            label="Next payout"
            value={merry.next_payout_date || "—"}
          />
        </Card>
      </Section>

      <Section title="Contribution">
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
            onChangeText={setAmount}
            placeholder="e.g. 500"
            placeholderTextColor={COLORS.placeholder}
            keyboardType="numeric"
            style={styles.input}
          />

          <View style={styles.previewCard}>
            <InfoRow label="Phone" value={normalizedPhone || "—"} />
            <InfoRow label="Amount" value={formatKes(baseAmount || 0)} />
            <InfoRow label="Merry" value={merry.name} />
            <InfoRow label="Method" value="STK Push" />
          </View>

          <Card style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.infoText}>
              Enter the base contribution amount. Any transaction fee is applied
              automatically by the backend settings.
            </Text>
          </Card>

          <View style={{ height: SPACING.md }} />

          <Button
            title={
              !merryAllowed
                ? "Account Not Eligible"
                : isAdmin
                ? "Admin Cannot Contribute Here"
                : !isMemberOfThisMerry
                ? "Join Merry First"
                : submitting
                ? "Sending STK..."
                : "Contribute via STK"
            }
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

  noticeCard: {
    ...P.paymentCard,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.infoSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeTitle: {
    ...TYPE.bodyStrong,
    color: COLORS.text,
  },

  noticeText: {
    marginTop: 4,
    ...TYPE.subtext,
    color: COLORS.textMuted,
  },

  summaryCard: {
    ...P.paymentCard,
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

  previewCard: {
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

  infoCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  infoText: {
    flex: 1,
    ...TYPE.subtext,
    color: COLORS.textMuted,
  },
});