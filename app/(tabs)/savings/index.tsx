// app/(tabs)/savings/index.tsx

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
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
import { getMe } from "@/services/profile";
import {
  getOrCreateDefaultSavingsAccount,
  SavingsAccount,
} from "@/services/savings";
import { saveSessionUser } from "@/services/session";

const PAGE_BG = "#062C49";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.92)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.75)";
const TEXT_ON_DARK_MUTED = "rgba(255,255,255,0.55)";
const GLASS = "rgba(255,255,255,0.08)";
const GLASS_BORDER = "rgba(255,255,255,0.10)";

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getUserId(user: any): number | null {
  const raw =
    user?.id ??
    user?.user_id ??
    user?.pk ??
    null;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildSavingsUserReference(user: any): string {
  const userId = getUserId(user);
  return userId ? `saving${userId}` : "";
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
      : WHITE;

  return (
    <View style={styles.summaryTile}>
      <View style={styles.summaryTileGlow} />
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
      <View style={styles.actionRowGlow} />
      <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={TEXT_ON_DARK_MUTED} />
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
        reference: buildSavingsUserReference(user),
        title: account.name || "Rescue Plan",
      },
    });
  }, [account, user]);

  const goToWithdraw = useCallback(() => {
    if (!account?.id) return;

    router.push({
      pathname: ROUTES.tabs.paymentsWithdrawals as any,
      params: {
        category: "SAVINGS",
        purpose: "SAVINGS_WITHDRAWAL",
        accountId: String(account.id),
        reference: buildSavingsUserReference(user),
        title: account.name || "Rescue Plan",
      },
    });
  }, [account, user]);

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
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        try {
          setLoading(true);
          if (active) {
            await load();
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      run();

      return () => {
        active = false;
      };
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
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
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.heroCard}>
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroOrbThree} />

          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={24}
                color={COLORS.white}
              />
            </View>

            <View style={styles.heroTextWrap}>
              <Text style={styles.heroEyebrow}>UNITED CARE</Text>
              <Text style={styles.heroTitle}>
                {account?.name || "Rescue Plan"}
              </Text>
              <Text style={styles.heroSubtitle}>
                Build your community cushion, stay ready, and support one another when needed.
              </Text>
            </View>
          </View>

          <View style={styles.heroBalanceBox}>
            <Text style={styles.heroBalanceLabel}>Ready to use</Text>
            <Text style={styles.heroBalanceValue}>
              {account ? available : "—"}
            </Text>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Ionicons
                name="leaf-outline"
                size={14}
                color="rgba(255,255,255,0.9)"
              />
              <Text style={styles.heroMetaText}>Steady support</Text>
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
              title="Contribute"
              onPress={goToDeposit}
              disabled={!account?.id}
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

        <Section title="Overview">
          <View style={styles.summaryGrid}>
            <SummaryTile
              label="Total contributions"
              value={account ? balance : "—"}
            />
            <SummaryTile
              label="Ready to use"
              value={account ? available : "—"}
              tone="success"
            />
            <SummaryTile
              label="Reserved"
              value={account ? reserved : "—"}
              tone="warning"
            />
          </View>
        </Section>

        <Section title="Continue">
          <View style={styles.actionList}>
            <ActionRow
              title="Contribute"
              subtitle="Add your share to the community rescue plan."
              icon="add-circle-outline"
              iconBg={`${COLORS.primary}16`}
              iconColor={COLORS.primary}
              onPress={goToDeposit}
            />

            <ActionRow
              title="History"
              subtitle="See your contribution journey and past activity."
              icon="time-outline"
              iconBg={`${COLORS.info}16`}
              iconColor={COLORS.info}
              onPress={goToHistory}
            />

            <ActionRow
              title="Request support"
              subtitle="Request support from this shared plan when needed."
              icon="arrow-up-circle-outline"
              iconBg={`${COLORS.success}16`}
              iconColor={COLORS.success}
              onPress={goToWithdraw}
            />
          </View>
        </Section>

        <Card style={styles.communityCard}>
          <View style={styles.communityGlow} />
          <View style={styles.communityCardTop}>
            <View style={styles.communityIconWrap}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.communityTitle}>Why this plan matters here</Text>
          </View>

          <Text style={styles.communityText}>
            Small, consistent contributions help members stay ready for family needs,
            shared goals, and unexpected moments. Every step strengthens the community.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.md,
    backgroundColor: PAGE_BG,
  },

  content: {
    padding: SPACING.md,
    position: "relative",
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

  heroCard: {
    borderRadius: 28,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: "rgba(12,106,128,0.45)",
    borderWidth: 1,
    borderColor: "rgba(176,243,234,0.12)",
    overflow: "hidden",
    ...SHADOW.strong,
  },

  heroOrbOne: {
    position: "absolute",
    right: -36,
    top: -20,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(38, 208, 214, 0.18)",
  },

  heroOrbTwo: {
    position: "absolute",
    left: -12,
    bottom: -35,
    width: 145,
    height: 145,
    borderRadius: 999,
    backgroundColor: "rgba(42, 206, 180, 0.16)",
  },

  heroOrbThree: {
    position: "absolute",
    right: 60,
    bottom: -55,
    width: 210,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(102, 212, 109, 0.15)",
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
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 22,
    lineHeight: 28,
  },

  heroSubtitle: {
    marginTop: 6,
    color: TEXT_ON_DARK,
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
    fontFamily: FONT.bold,
    fontSize: 28,
    lineHeight: 34,
    color: WHITE,
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
    color: TEXT_ON_DARK,
    fontFamily: FONT.medium || FONT.regular,
    fontSize: 12,
  },

  heroActions: {
    marginTop: SPACING.md,
  },

  errorCard: {
    backgroundColor: "rgba(239,68,68,0.18)",
    borderColor: "rgba(239,68,68,0.25)",
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },

  errorText: {
    color: WHITE,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  summaryGrid: {
    gap: SPACING.sm,
  },

  summaryTile: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: SPACING.md,
    backgroundColor: GLASS,
    ...SHADOW.card,
  },

  summaryTileGlow: {
    position: "absolute",
    right: -18,
    top: -18,
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  summaryLabel: {
    color: TEXT_ON_DARK_SOFT,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  summaryValue: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 18,
    lineHeight: 24,
    color: WHITE,
  },

  actionList: {
    gap: SPACING.sm,
  },

  actionRow: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: GLASS,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    ...SHADOW.card,
  },

  actionRowGlow: {
    position: "absolute",
    left: -20,
    bottom: -20,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "rgba(12,106,128,0.06)",
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
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  actionSubtitle: {
    marginTop: 4,
    color: TEXT_ON_DARK_SOFT,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  communityCard: {
    marginTop: SPACING.sm,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 22,
    padding: SPACING.md,
    overflow: "hidden",
    ...SHADOW.card,
  },

  communityGlow: {
    position: "absolute",
    right: -18,
    bottom: -24,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
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
    backgroundColor: "rgba(37, 99, 235, 0.10)",
  },

  communityTitle: {
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  communityText: {
    color: TEXT_ON_DARK_SOFT,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 19,
  },
});