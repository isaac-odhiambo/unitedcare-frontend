// app/(tabs)/savings/index.tsx

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getMe, isKycComplete } from "@/services/profile";
import {
  buildSavingsReference,
  getOrCreateDefaultSavingsAccount,
  SavingsAccount,
} from "@/services/savings";
import { saveSessionUser } from "@/services/session";

const SURFACE = "#F8FAFC";
const CARD_BORDER = "rgba(15, 23, 42, 0.06)";
const TEXT_MAIN = "#0F172A";
const TEXT_MUTED = "#64748B";
const HERO_TOP = "#0F766E";
const SOFT_GREEN = "#ECFDF5";
const SOFT_BLUE = "#EFF6FF";
const SOFT_AMBER = "#FFF7ED";

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type SummaryTileProps = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
};

function SummaryTile({
  label,
  value,
  tone = "default",
}: SummaryTileProps) {
  const valueColor =
    tone === "success"
      ? COLORS.success
      : tone === "warning"
        ? COLORS.warning
        : TEXT_MAIN;

  const bgColor =
    tone === "success"
      ? SOFT_GREEN
      : tone === "warning"
        ? SOFT_AMBER
        : SURFACE;

  return (
    <View style={[styles.summaryTile, { backgroundColor: bgColor }]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

type ActionRowProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  onPress: () => void;
};

function ActionRow({
  title,
  subtitle,
  icon,
  iconBg,
  iconColor,
  onPress,
}: ActionRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={styles.actionRow}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
    </TouchableOpacity>
  );
}

export default function SavingsIndexScreen() {
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<any>(null);
  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const kycComplete = isKycComplete(user);

  const goToProfile = useCallback(() => {
    router.push(ROUTES.tabs.profile as any);
  }, []);

  const goToDeposit = useCallback(() => {
    if (!account?.id) return;

    router.push({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        category: "SAVINGS",
        purpose: "SAVINGS_DEPOSIT",
        accountId: String(account.id),
        reference: buildSavingsReference(account.id),
        title: account.name || "Savings",
      },
    });
  }, [account]);

  const goToWithdraw = useCallback(() => {
    if (!account?.id) return;

    if (!kycComplete) {
      goToProfile();
      return;
    }

    router.push({
      pathname: ROUTES.tabs.paymentsWithdrawals as any,
      params: {
        category: "SAVINGS",
        purpose: "SAVINGS_WITHDRAWAL",
        accountId: String(account.id),
        reference: buildSavingsReference(account.id),
        title: account.name || "Savings",
      },
    });
  }, [account, kycComplete, goToProfile]);

  const goToHistory = useCallback(() => {
    if (!account?.id) return;
    router.push(ROUTES.dynamic.savingsAccountHistory(account.id) as any);
  }, [account]);

  const load = useCallback(async () => {
    try {
      setError("");

      const me = await getMe();
      setUser(me);

      if (me) {
        await saveSessionUser(me);
      }

      const wallet = await getOrCreateDefaultSavingsAccount();
      setAccount(wallet);
    } catch (e: any) {
      setError(getErrorMessage(e));
      setAccount(null);
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
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const balance = useMemo(() => formatKes(account?.balance), [account]);
  const available = useMemo(
    () => formatKes(account?.available_balance),
    [account]
  );
  const reserved = useMemo(
    () => formatKes(account?.reserved_amount),
    [account]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>
            Loading your community savings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>
              Please login to access your savings.
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (!account) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>
              {error || "Unable to load your savings right now."}
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="wallet-outline" size={24} color={COLORS.white} />
            </View>

            <View style={styles.heroTextWrap}>
              <Text style={styles.heroEyebrow}>UNITED CARE</Text>
              <Text style={styles.heroTitle}>
                {account.name || "Community Savings"}
              </Text>
              <Text style={styles.heroSubtitle}>
                Save steadily, stay prepared, and grow together with your
                community.
              </Text>
            </View>
          </View>

          <View style={styles.heroBalanceBox}>
            <Text style={styles.heroBalanceLabel}>Available now</Text>
            <Text style={styles.heroBalanceValue}>{available}</Text>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Ionicons
                name="leaf-outline"
                size={14}
                color="rgba(255,255,255,0.9)"
              />
              <Text style={styles.heroMetaText}>Steady growth</Text>
            </View>

            <View style={styles.heroMetaPill}>
              <Ionicons
                name="heart-outline"
                size={14}
                color="rgba(255,255,255,0.9)"
              />
              <Text style={styles.heroMetaText}>Community first</Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <Button
              title="Save"
              onPress={goToDeposit}
              leftIcon={
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={COLORS.white}
                />
              }
            />
          </View>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {!kycComplete ? (
          <Card style={styles.noticeCard} onPress={goToProfile}>
            <View style={styles.noticeIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={COLORS.info}
              />
            </View>

            <View style={styles.noticeBody}>
              <Text style={styles.noticeTitle}>Profile completion</Text>
              <Text style={styles.noticeText}>
                Saving is open. Profile completion is only needed before
                withdrawal.
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
          </Card>
        ) : null}

        <Section title="Overview">
          <View style={styles.summaryGrid}>
            <SummaryTile label="Total saved" value={balance} />
            <SummaryTile
              label="Available now"
              value={available}
              tone="success"
            />
            <SummaryTile label="Set aside" value={reserved} tone="warning" />
          </View>
        </Section>

        <Section title="Continue">
          <View style={styles.actionList}>
            <ActionRow
              title="Save"
              subtitle="Add more to your savings."
              icon="add-circle-outline"
              iconBg={`${COLORS.primary}16`}
              iconColor={COLORS.primary}
              onPress={goToDeposit}
            />

            <ActionRow
              title="History"
              subtitle="See your savings journey and past activity."
              icon="time-outline"
              iconBg={`${COLORS.info}16`}
              iconColor={COLORS.info}
              onPress={goToHistory}
            />

            <ActionRow
              title="Withdraw"
              subtitle={
                kycComplete
                  ? "Request money from your savings."
                  : "Complete your profile before withdrawal."
              }
              icon="arrow-up-circle-outline"
              iconBg={`${COLORS.success}16`}
              iconColor={kycComplete ? COLORS.success : COLORS.info}
              onPress={goToWithdraw}
            />
          </View>
        </Section>

        <Card style={styles.communityCard}>
          <View style={styles.communityCardTop}>
            <View style={styles.communityIconWrap}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.communityTitle}>Why savings matter here</Text>
          </View>

          <Text style={styles.communityText}>
            Small, consistent saving helps members stay ready for goals, family
            needs, and future opportunities. Every step adds to your stability.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.md,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
  },

  loadingText: {
    marginTop: SPACING.sm,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  heroCard: {
    borderRadius: 28,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: HERO_TOP,
    ...SHADOW.strong,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },

  heroTextWrap: {
    flex: 1,
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
    fontSize: 22,
    lineHeight: 28,
  },

  heroSubtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.88)",
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  heroBalanceBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroBalanceLabel: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  heroBalanceValue: {
    marginTop: 6,
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 28,
    lineHeight: 34,
  },

  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: SPACING.md,
  },

  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  heroMetaText: {
    color: "rgba(255,255,255,0.92)",
    fontFamily: FONT.medium || FONT.regular,
    fontSize: 12,
  },

  heroActions: {
    marginTop: SPACING.md,
  },

  errorCard: {
    backgroundColor: "#FFF4F4",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },

  errorText: {
    color: COLORS.danger,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  noticeCard: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },

  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: `${COLORS.info}18`,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeBody: {
    flex: 1,
  },

  noticeTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  noticeText: {
    marginTop: 4,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  summaryGrid: {
    gap: SPACING.sm,
  },

  summaryTile: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.md,
  },

  summaryLabel: {
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  summaryValue: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 18,
    lineHeight: 24,
  },

  actionList: {
    gap: SPACING.sm,
  },

  actionRow: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  actionBody: {
    flex: 1,
  },

  actionTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  actionSubtitle: {
    marginTop: 4,
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  communityCard: {
    marginTop: SPACING.sm,
    backgroundColor: SOFT_BLUE,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    borderRadius: 22,
    padding: SPACING.md,
  },

  communityCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  communityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },

  communityTitle: {
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  communityText: {
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 19,
  },
});