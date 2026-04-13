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
import { getApiErrorMessage, money, requestWithdrawal } from "@/services/payments";
import { getMe } from "@/services/profile";
import { getSessionUser, saveSessionUser } from "@/services/session";

const SOURCES = ["SAVINGS", "MERRY", "GROUP"] as const;
type WithdrawalSource = (typeof SOURCES)[number];
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

function normalizeSource(value?: string): WithdrawalSource {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "SAVINGS" || raw === "MERRY" || raw === "GROUP") return raw;
  return "SAVINGS";
}

function sourceLabel(value: WithdrawalSource) {
  switch (value) {
    case "SAVINGS":
      return "Savings";
    case "MERRY":
      return "Merry";
    case "GROUP":
      return "Group";
    default:
      return value;
  }
}

function sourceTone(value: WithdrawalSource): SpaceTone {
  switch (value) {
    case "SAVINGS":
      return "savings";
    case "MERRY":
      return "merry";
    case "GROUP":
      return "groups";
    default:
      return "support";
  }
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
  buttonLabel,
  onPress,
}: {
  tone: NoticeTone;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  buttonLabel?: string;
  onPress?: () => void;
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

      {buttonLabel && onPress ? (
        <View style={{ marginTop: SPACING.sm }}>
          <Button title={buttonLabel} variant="secondary" onPress={onPress} />
        </View>
      ) : null}
    </View>
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

  const allowed = true;

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const phoneOk = useMemo(() => isValidPhone(normalizedPhone), [normalizedPhone]);
  const amountOk = useMemo(() => Number(amount) > 0, [amount]);

  const canSubmit = allowed && phoneOk && amountOk && !submitting;
  const activePalette = getSpaceTonePalette(sourceTone(source));

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
    if (!phoneOk) {
      Alert.alert("Community wallet", "Enter a valid Kenyan phone number.");
      return;
    }

    if (!amountOk) {
      Alert.alert("Community wallet", "Enter a valid amount.");
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
      const message = getApiErrorMessage(e);
      setError(message);
      Alert.alert("Community wallet", message);
    } finally {
      setSubmitting(false);
    }
  }, [amount, amountOk, normalizedPhone, phoneOk, source]);

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
              <Text style={styles.heroBadgeText}>Community wallet</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Request money from your community wallet</Text>
          <Text style={styles.heroSubtitle}>
            Choose where the money should come from, add your phone number, and enter the amount.
          </Text>

          <View style={styles.heroSummaryRow}>
            <View
              style={[
                styles.heroSummaryPill,
                { backgroundColor: activePalette.chip },
              ]}
            >
              <Text style={styles.heroSummaryLabel}>From</Text>
              <Text style={styles.heroSummaryValue}>{sourceLabel(source)}</Text>
            </View>

            <View
              style={[
                styles.heroSummaryPill,
                { backgroundColor: activePalette.chip },
              ]}
            >
              <Text style={styles.heroSummaryLabel}>Amount</Text>
              <Text style={styles.heroSummaryValue}>{money(Number(amount || 0))}</Text>
            </View>
          </View>
        </View>

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
                Add your phone number, amount, and where you want the money to come from.
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
            onChangeText={(v) => setAmount(sanitizeAmount(v))}
            style={styles.input}
            placeholder="e.g. 1500"
            placeholderTextColor="rgba(255,255,255,0.45)"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Choose where it comes from</Text>
          <View style={styles.sources}>
            {SOURCES.map((s) => {
              const active = source === s;
              const palette = getSpaceTonePalette(sourceTone(s));

              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSource(s)}
                  activeOpacity={0.88}
                  style={[
                    styles.source,
                    {
                      backgroundColor: active ? palette.card : INPUT_BG,
                      borderColor: active ? palette.border : INPUT_BORDER,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sourceText,
                      active && styles.sourceTextActive,
                    ]}
                  >
                    {sourceLabel(s)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.amountBox}>
            <View style={styles.amountTopRow}>
              <Text style={styles.amountLabel}>Summary</Text>
              <View style={styles.amountChip}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#0A6E8A" />
                <Text style={styles.amountChipText}>Ready</Text>
              </View>
            </View>

            <Text style={styles.amountValue}>{money(Number(amount || 0))}</Text>
            <Text style={styles.amountMeta}>
              From: {sourceLabel(source)} • Phone: {normalizedPhone || "Not added"}
            </Text>
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
    marginBottom: SPACING.md,
    backgroundColor: INPUT_BG,
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 16,
  },

  sources: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginBottom: SPACING.md,
  },

  source: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  sourceText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
    color: TEXT_ON_DARK,
  },

  sourceTextActive: {
    color: WHITE,
    fontFamily: FONT.bold,
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