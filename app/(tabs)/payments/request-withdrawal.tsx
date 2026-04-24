import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
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
import { FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getApiErrorMessage as getPaymentsApiErrorMessage, money, requestWithdrawal } from "@/services/payments";
import { getMe } from "@/services/profile";
import {
  canShowWithdrawAction,
  getMySavingsAccount,
  getApiErrorMessage as getSavingsApiErrorMessage,
  SavingsAccount,
} from "@/services/savings";
import { getSessionUser, saveSessionUser } from "@/services/session";

const SOURCE = "SAVINGS" as const;
type WithdrawalSource = typeof SOURCE;
type SpaceTone = "savings" | "merry" | "groups" | "support";
type NoticeTone = "primary" | "success" | "warning" | "info";

const NOTIFICATIONS_ROUTE =
  (ROUTES as any)?.tabs?.notifications || "/(tabs)/notifications";

const PAGE_BG = "#062C49";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.92)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.76)";
const TEXT_ON_DARK_MUTED = "rgba(255,255,255,0.58)";
const INPUT_BG = "#0A2234";
const INPUT_BORDER = "rgba(255,255,255,0.12)";
const DEFAULT_TRANSACTION_FEE = 0;

function getSpaceTonePalette(tone: SpaceTone) {
  const map = {
    savings: {
      card: "rgba(29, 196, 182, 0.22)",
      border: "rgba(129, 244, 231, 0.15)",
      iconBg: "rgba(220, 255, 250, 0.75)",
      icon: "#0B6A80",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
    merry: {
      card: "rgba(98, 192, 98, 0.23)",
      border: "rgba(194, 255, 188, 0.16)",
      iconBg: "rgba(236, 255, 235, 0.76)",
      icon: "#379B4A",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
    groups: {
      card: "rgba(49, 180, 217, 0.22)",
      border: "rgba(189, 244, 255, 0.15)",
      iconBg: "rgba(236, 251, 255, 0.76)",
      icon: "#0A6E8A",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
    support: {
      card: "rgba(52, 198, 191, 0.22)",
      border: "rgba(195, 255, 250, 0.16)",
      iconBg: "rgba(236, 255, 252, 0.76)",
      icon: "#148C84",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
  };

  return map[tone];
}

function getOverviewTonePalette(tone: NoticeTone) {
  const map = {
    primary: {
      iconBg: "rgba(12,106,128,0.12)",
      icon: "#0C6A80",
      buttonBg: "#197D71",
      buttonBorder: "#197D71",
      soft: "rgba(12,106,128,0.05)",
    },
    success: {
      iconBg: "rgba(65,163,87,0.12)",
      icon: "#379B4A",
      buttonBg: "#197D71",
      buttonBorder: "#197D71",
      soft: "rgba(65,163,87,0.05)",
    },
    warning: {
      iconBg: "rgba(24,140,132,0.12)",
      icon: "#148C84",
      buttonBg: "#FFFFFF",
      buttonBorder: "rgba(12,106,128,0.20)",
      soft: "rgba(20,140,132,0.05)",
    },
    info: {
      iconBg: "rgba(12,106,128,0.12)",
      icon: "#0C6A80",
      buttonBg: "#FFFFFF",
      buttonBorder: "rgba(12,106,128,0.20)",
      soft: "rgba(12,106,128,0.05)",
    },
  };

  return map[tone];
}

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

function toFiniteNumber(value: unknown) {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function toMoneyInput(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function clampAmountInput(raw: string, maxAllowed: number) {
  const sanitized = sanitizeAmount(raw);
  if (!sanitized) return "";
  const numeric = toFiniteNumber(sanitized);
  if (numeric <= 0) return sanitized;
  if (maxAllowed <= 0) return "";
  const capped = Math.min(numeric, maxAllowed);
  return toMoneyInput(capped);
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
        <Ionicons name={icon} size={18} color="#0A6E8A" />
      </View>
      <Text style={styles.quickLinkText}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={TEXT_ON_DARK_MUTED} />
    </TouchableOpacity>
  );
}

function NoticeBanner({
  tone,
  icon,
  title,
  text,
}: {
  tone: NoticeTone;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  const palette = getOverviewTonePalette(tone);

  return (
    <View style={styles.noticeCard}>
      <View style={[styles.noticeGlow, { backgroundColor: palette.soft }]} />

      <View style={styles.noticeTop}>
        <View style={[styles.noticeIconWrap, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={icon} size={18} color={palette.icon} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>{title}</Text>
          <Text style={styles.noticeText}>{text}</Text>
        </View>
      </View>
    </View>
  );
}

export default function RequestWithdrawalScreen() {
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    amount?: string;
    phone?: string;
    fee?: string;
    transactionFee?: string;
    transaction_fee?: string;
  }>();

  const [user, setUser] = useState<any>(null);
  const [savingsAccount, setSavingsAccount] = useState<SavingsAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [phone, setPhone] = useState(
    typeof params.phone === "string" ? normalizePhone(params.phone) : ""
  );
  const [amount, setAmount] = useState(
    typeof params.amount === "string" ? sanitizeAmount(params.amount) : ""
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const phoneOk = useMemo(() => isValidPhone(normalizedPhone), [normalizedPhone]);

  const transactionFee = useMemo(() => {
    const candidates = [
      params.transactionFee,
      params.transaction_fee,
      params.fee,
      (user as any)?.withdrawal_fee,
      (user as any)?.transaction_fee,
      (savingsAccount as any)?.withdrawal_fee,
    ];

    for (const candidate of candidates) {
      const value = toFiniteNumber(candidate);
      if (value >= 0) return value;
    }

    return DEFAULT_TRANSACTION_FEE;
  }, [
    params.fee,
    params.transactionFee,
    params.transaction_fee,
    savingsAccount,
    user,
  ]);

  const availableBalance = useMemo(() => {
    return toFiniteNumber(savingsAccount?.available_balance);
  }, [savingsAccount]);

  const maxWithdrawable = useMemo(() => {
    return Math.max(0, availableBalance - transactionFee);
  }, [availableBalance, transactionFee]);

  const amountNumber = useMemo(() => toFiniteNumber(amount), [amount]);
  const amountOk = useMemo(() => amountNumber > 0, [amountNumber]);
  const totalDebit = useMemo(() => amountNumber + transactionFee, [amountNumber, transactionFee]);

  const withdrawAllowed = useMemo(() => {
    return canShowWithdrawAction(savingsAccount);
  }, [savingsAccount]);

  const hasEnoughBalance = useMemo(() => {
    return totalDebit > 0 && totalDebit <= availableBalance;
  }, [availableBalance, totalDebit]);

  const canSubmit =
    withdrawAllowed &&
    phoneOk &&
    amountOk &&
    hasEnoughBalance &&
    !submitting &&
    availableBalance > 0;

  const activePalette = getSpaceTonePalette("savings");

  const handleAmountChange = useCallback(
    (value: string) => {
      setAmount(clampAmountInput(value, maxWithdrawable));
    },
    [maxWithdrawable]
  );

  const load = useCallback(async () => {
    try {
      setError("");

      const [session, me, savings] = await Promise.all([
        getSessionUser(),
        getMe(),
        getMySavingsAccount(),
      ]);

      const merged = { ...(session || {}), ...(me || {}) };

      setUser(merged);
      setSavingsAccount(savings || null);
      await saveSessionUser(merged);

      if (!phone) {
        setPhone(normalizePhone(merged?.phone || ""));
      }

      const nextMax = Math.max(
        0,
        toFiniteNumber(savings?.available_balance) - transactionFee
      );
      setAmount((prev) => clampAmountInput(prev, nextMax));
    } catch (e: any) {
      setError(
        getSavingsApiErrorMessage(e) || getPaymentsApiErrorMessage(e)
      );
    }
  }, [phone, transactionFee]);

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

  React.useEffect(() => {
    setAmount((prev) => clampAmountInput(prev, maxWithdrawable));
  }, [maxWithdrawable]);

  const handleSubmit = useCallback(async () => {
    if (!withdrawAllowed) {
      Alert.alert(
        "Community wallet",
        "Savings withdrawal is not available right now."
      );
      return;
    }

    if (!phoneOk) {
      Alert.alert("Community wallet", "Enter a valid Kenyan phone number.");
      return;
    }

    if (!amountOk) {
      Alert.alert("Community wallet", "Enter a valid amount.");
      return;
    }

    if (availableBalance <= 0) {
      Alert.alert("Community wallet", "You do not have enough available savings balance.");
      return;
    }

    if (totalDebit > availableBalance) {
      Alert.alert(
        "Community wallet",
        "The amount plus transaction fee is more than your available savings balance."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const res = await requestWithdrawal({
        phone: normalizedPhone,
        amount: toMoneyInput(amountNumber),
        source: SOURCE,
      });

      Alert.alert(
        "Request sent",
        res?.message || "Your request has been shared successfully.",
        [
          {
            text: "Open My Requests",
            onPress: () =>
              router.replace(ROUTES.tabs.paymentsWithdrawals as any),
          },
        ]
      );
    } catch (e: any) {
      const message = getPaymentsApiErrorMessage(e);
      setError(message);
      Alert.alert("Community wallet", message);
    } finally {
      setSubmitting(false);
    }
  }, [
    amountNumber,
    amountOk,
    availableBalance,
    normalizedPhone,
    phoneOk,
    totalDebit,
    withdrawAllowed,
  ]);

  if (!loading && !user) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.page}>
          <EmptyState
            title="You are not signed in"
            subtitle="Log in to continue"
            actionLabel="Log in"
            onAction={() => router.replace(ROUTES.auth.login as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!loading && !savingsAccount) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.page}>
          <EmptyState
            title="Savings wallet not found"
            subtitle="Your savings wallet could not be loaded right now."
            actionLabel="Back to payments"
            onAction={() => router.replace(ROUTES.tabs.payments as any)}
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8CF0C7"
            colors={["#8CF0C7", "#0CC0B7"]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View
          style={[
            styles.hero,
            {
              backgroundColor: activePalette.card,
              borderColor: activePalette.border,
            },
          ]}
        >
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.heroTopRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.replace(ROUTES.tabs.payments as any)}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View
              style={[
                styles.heroBadge,
                { backgroundColor: activePalette.chip },
              ]}
            >
              <Ionicons name="wallet-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>Savings wallet</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Request withdrawal from savings</Text>
          <Text style={styles.heroSubtitle}>
            Withdraw only from your savings wallet using your available savings balance.
          </Text>

          <View style={styles.heroSummaryRow}>
            <View
              style={[
                styles.heroSummaryPill,
                { backgroundColor: activePalette.chip },
              ]}
            >
              <Text style={styles.heroSummaryLabel}>From</Text>
              <Text style={styles.heroSummaryValue}>Savings</Text>
            </View>

            <View
              style={[
                styles.heroSummaryPill,
                { backgroundColor: activePalette.chip },
              ]}
            >
              <Text style={styles.heroSummaryLabel}>Amount</Text>
              <Text style={styles.heroSummaryValue}>{money(amountNumber)}</Text>
            </View>
          </View>
        </View>

        <NoticeBanner
          tone="info"
          icon="wallet-outline"
          title="Available savings balance"
          text={`Available: ${money(availableBalance)} • Fee: ${money(
            transactionFee
          )} • Maximum withdrawable: ${money(maxWithdrawable)}`}
        />

        {!withdrawAllowed ? (
          <NoticeBanner
            tone="warning"
            icon="lock-closed-outline"
            title="Withdrawal not available"
            text="Your savings wallet is currently not available for withdrawal."
          />
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color="#FFD7D7"
              />
            </View>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Card
          style={[
            styles.card,
            {
              backgroundColor: getSpaceTonePalette("support").card,
              borderColor: getSpaceTonePalette("support").border,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                { backgroundColor: getSpaceTonePalette("support").iconBg },
              ]}
            >
              <Ionicons
                name="cash-outline"
                size={18}
                color={getSpaceTonePalette("support").icon}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Your request</Text>
              <Text style={styles.sectionSubtitle}>
                Add your phone number and amount. Withdrawals are processed from savings only.
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(normalizePhone(v))}
            style={styles.input}
            placeholder="07XXXXXXXX"
            placeholderTextColor="rgba(255,255,255,0.45)"
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={handleAmountChange}
            style={styles.input}
            placeholder="e.g. 1500"
            placeholderTextColor="rgba(255,255,255,0.45)"
            keyboardType="numeric"
          />

          <Text style={styles.helperText}>
            You can enter up to {money(maxWithdrawable)} after the transaction fee.
          </Text>

          <View style={styles.fixedSourceBox}>
            <Text style={styles.fixedSourceLabel}>Withdrawal source</Text>
            <View style={styles.fixedSourceChip}>
              <Ionicons name="wallet-outline" size={16} color="#0A6E8A" />
              <Text style={styles.fixedSourceChipText}>Savings only</Text>
            </View>
          </View>

          <View style={styles.amountBox}>
            <View style={styles.amountTopRow}>
              <Text style={styles.amountLabel}>Summary</Text>
              <View style={styles.amountChip}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#0A6E8A" />
                <Text style={styles.amountChipText}>
                  {hasEnoughBalance && withdrawAllowed ? "Ready" : "Check amount"}
                </Text>
              </View>
            </View>

            <Text style={styles.amountValue}>{money(amountNumber)}</Text>
            <Text style={styles.amountMeta}>
              From: Savings • Phone: {normalizedPhone || "Not added"}
            </Text>

            <View style={styles.summaryLines}>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLineLabel}>Available savings balance</Text>
                <Text style={styles.summaryLineValue}>{money(availableBalance)}</Text>
              </View>

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLineLabel}>Transaction fee</Text>
                <Text style={styles.summaryLineValue}>{money(transactionFee)}</Text>
              </View>

              <View style={styles.summaryLine}>
                <Text style={styles.summaryLineLabel}>Total deduction</Text>
                <Text style={styles.summaryLineValue}>{money(totalDebit)}</Text>
              </View>
            </View>
          </View>

          <Button
            title={submitting ? "Sending request..." : "Send Request"}
            onPress={handleSubmit}
            disabled={!canSubmit}
            leftIcon={
              <Ionicons
                name="send-outline"
                size={18}
                color={WHITE}
              />
            }
          />
        </Card>

        <View style={styles.linksWrap}>
          <QuickLink
            title="My Requests"
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
    backgroundColor: PAGE_BG,
  },

  content: {
    padding: SPACING.md,
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -60,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(19, 195, 178, 0.10)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 260,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(52, 174, 213, 0.08)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: 80,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(112, 208, 115, 0.09)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 100,
    left: 40,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    top: 180,
    right: 60,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  hero: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    overflow: "hidden",
    ...SHADOW.card,
  },

  heroGlowOne: {
    position: "absolute",
    right: -28,
    top: -18,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroGlowTwo: {
    position: "absolute",
    left: -20,
    bottom: -20,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  heroBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
    color: WHITE,
  },

  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  heroSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK,
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  heroSummaryLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_SOFT,
  },

  heroSummaryValue: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  noticeCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  noticeGlow: {
    position: "absolute",
    right: -18,
    top: -12,
    width: 90,
    height: 90,
    borderRadius: 999,
  },

  noticeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  noticeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: WHITE,
    marginBottom: 2,
  },

  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
    backgroundColor: "rgba(239,68,68,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  errorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: WHITE,
  },

  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    ...SHADOW.card,
  },

  sectionHeader: {
    marginBottom: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_SOFT,
  },

  label: {
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  input: {
    height: 56,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    marginBottom: SPACING.sm,
    backgroundColor: INPUT_BG,
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 16,
  },

  helperText: {
    marginBottom: SPACING.md,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_SOFT,
  },

  fixedSourceBox: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: INPUT_BG,
  },

  fixedSourceLabel: {
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_SOFT,
  },

  fixedSourceChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(236, 251, 255, 0.86)",
  },

  fixedSourceChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.bold,
    color: "#0A6E8A",
  },

  amountBox: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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
    color: TEXT_ON_DARK_SOFT,
  },

  amountChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.80)",
  },

  amountChipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
    color: "#0A6E8A",
  },

  amountValue: {
    marginTop: 2,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  amountMeta: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_SOFT,
  },

  summaryLines: {
    marginTop: SPACING.md,
    gap: 8,
  },

  summaryLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  summaryLineLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_SOFT,
  },

  summaryLineValue: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.bold,
    color: WHITE,
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
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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
    backgroundColor: "rgba(236,251,255,0.86)",
  },

  quickLinkText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT.medium,
    color: WHITE,
  },
});