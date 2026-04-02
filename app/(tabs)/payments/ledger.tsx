// app/(tabs)/payments/ledger.tsx
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

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  getApiErrorMessage,
  getMyLedger,
  PaymentLedgerEntry,
} from "@/services/payments";
import { getMe, isAdminUser, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type LedgerUser = Partial<MeResponse> & Partial<SessionUser>;

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.90)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.74)";

const TEXT_MAIN = "#0F172A";
const TEXT_SOFT = "#334155";
const TEXT_MUTED = "#64748B";

const TINT_PRIMARY = "rgba(49, 180, 217, 0.22)";
const TINT_PRIMARY_BORDER = "rgba(189, 244, 255, 0.15)";

const TINT_SAVINGS = "rgba(29, 196, 182, 0.22)";
const TINT_SAVINGS_BORDER = "rgba(129, 244, 231, 0.15)";

const TINT_MERRY = "rgba(98, 192, 98, 0.23)";
const TINT_MERRY_BORDER = "rgba(194, 255, 188, 0.16)";

const TINT_SUPPORT = "rgba(52, 198, 191, 0.22)";
const TINT_SUPPORT_BORDER = "rgba(195, 255, 250, 0.16)";

const TINT_WARNING = "rgba(242, 140, 40, 0.16)";
const TINT_WARNING_BORDER = "rgba(242, 140, 40, 0.24)";

const TINT_SOFT = "rgba(255,255,255,0.10)";
const TINT_SOFT_BORDER = "rgba(255,255,255,0.14)";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function entryColor(entry: PaymentLedgerEntry) {
  const type = String(entry.entry_type || "").toUpperCase();
  if (type === "CREDIT") return COLORS.success;
  if (type === "DEBIT") return COLORS.danger;
  return COLORS.info;
}

function entrySign(entry: PaymentLedgerEntry) {
  const type = String(entry.entry_type || "").toUpperCase();
  if (type === "CREDIT") return "+";
  if (type === "DEBIT") return "-";
  return "";
}

function categoryIcon(category?: string) {
  const c = String(category || "").toUpperCase();

  if (c === "SAVINGS") return "wallet-outline";
  if (c === "LOANS") return "heart-outline";
  if (c === "MERRY") return "repeat-outline";
  if (c === "GROUP") return "people-outline";
  if (c === "WITHDRAWAL") return "arrow-up-circle-outline";
  if (c === "WITHDRAWAL_FEE") return "remove-circle-outline";
  if (c === "TRANSACTION_FEE") return "receipt-outline";
  return "list-outline";
}

function categoryLabel(category?: string) {
  const c = String(category || "").toUpperCase();

  if (c === "SAVINGS") return "Savings";
  if (c === "LOANS") return "Support";
  if (c === "MERRY") return "Merry";
  if (c === "GROUP") return "Group";
  if (c === "WITHDRAWAL") return "Withdrawal";
  if (c === "WITHDRAWAL_FEE") return "Service Fee";
  if (c === "TRANSACTION_FEE") return "Service Fee";
  return c || "Activity";
}

function isFeeCategory(category?: string) {
  const c = String(category || "").toUpperCase();
  return c === "WITHDRAWAL_FEE" || c === "TRANSACTION_FEE";
}

function getCategoryPalette(category?: string) {
  const c = String(category || "").toUpperCase();

  if (c === "SAVINGS") {
    return {
      card: TINT_SAVINGS,
      border: TINT_SAVINGS_BORDER,
      iconBg: "rgba(220, 255, 250, 0.75)",
      icon: "#0B6A80",
    };
  }

  if (c === "MERRY") {
    return {
      card: TINT_MERRY,
      border: TINT_MERRY_BORDER,
      iconBg: "rgba(236, 255, 235, 0.76)",
      icon: "#379B4A",
    };
  }

  if (c === "LOANS" || c === "WITHDRAWAL") {
    return {
      card: TINT_SUPPORT,
      border: TINT_SUPPORT_BORDER,
      iconBg: "rgba(236, 255, 252, 0.76)",
      icon: "#148C84",
    };
  }

  if (c === "WITHDRAWAL_FEE" || c === "TRANSACTION_FEE") {
    return {
      card: TINT_WARNING,
      border: TINT_WARNING_BORDER,
      iconBg: "rgba(255, 244, 224, 0.85)",
      icon: "#9A5B00",
    };
  }

  return {
    card: TINT_PRIMARY,
    border: TINT_PRIMARY_BORDER,
    iconBg: "rgba(236, 251, 255, 0.76)",
    icon: "#0A6E8A",
  };
}

function StatCard({
  label,
  value,
  valueColor,
  tintStyle,
}: {
  label: string;
  value: string;
  valueColor?: string;
  tintStyle?: any;
}) {
  return (
    <View style={[styles.summaryCard, tintStyle]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[styles.summaryValue, valueColor ? { color: valueColor } : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function QuickActionCard({
  title,
  icon,
  onPress,
  tintStyle,
  iconColor,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tintStyle?: any;
  iconColor: string;
}) {
  return (
    <Card onPress={onPress} style={[styles.quickActionCard, tintStyle]}>
      <View style={styles.quickActionInner}>
        <View style={[styles.quickActionIcon, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.quickActionText}>{title}</Text>
      </View>
    </Card>
  );
}

function LedgerRow({ entry }: { entry: PaymentLedgerEntry }) {
  const color = entryColor(entry);
  const sign = entrySign(entry);
  const feeRow = isFeeCategory(entry.category);
  const palette = getCategoryPalette(entry.category);

  const title =
    entry.narration ||
    categoryLabel(entry.category) ||
    "Community activity";

  const meta = [
    categoryLabel(entry.category),
    entry.reference,
    entry.created_at,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <Card
      style={[
        styles.entryCard,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.entryTop}>
        <View style={[styles.entryIcon, { backgroundColor: palette.iconBg }]}>
          <Ionicons
            name={categoryIcon(entry.category) as any}
            size={18}
            color={palette.icon}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.entryTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.entryMeta} numberOfLines={2}>
            {meta || "—"}
          </Text>
        </View>

        <Text style={[styles.entryAmount, { color }]}>
          {sign} {formatKes(entry.amount)}
        </Text>
      </View>

      {feeRow ? (
        <View style={styles.feeNoteRow}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color="#9A5B00"
          />
          <Text style={styles.feeNoteText}>
            This row shows a service fee applied during payment processing.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function LedgerScreen() {
  const [user, setUser] = useState<LedgerUser | null>(null);
  const [ledger, setLedger] = useState<PaymentLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, ledgerRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyLedger(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: LedgerUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      setLedger(
        ledgerRes.status === "fulfilled" && Array.isArray(ledgerRes.value)
          ? ledgerRes.value
          : []
      );

      if (ledgerRes.status === "rejected") {
        setError(getApiErrorMessage(ledgerRes.reason));
      } else if (meRes.status === "rejected") {
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

  const stats = useMemo(() => {
    let credits = 0;
    let debits = 0;
    let fees = 0;

    ledger.forEach((entry) => {
      const amount = Number(entry.amount ?? 0);
      if (!Number.isFinite(amount)) return;

      const type = String(entry.entry_type || "").toUpperCase();
      const category = String(entry.category || "").toUpperCase();

      if (type === "CREDIT") credits += amount;
      else if (type === "DEBIT") debits += amount;

      if (category === "WITHDRAWAL_FEE" || category === "TRANSACTION_FEE") {
        fees += amount;
      }
    });

    return {
      credits,
      debits,
      fees,
      count: ledger.length,
    };
  }, [ledger]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#C7FFF2" />
        <Text style={styles.loadingText}>Loading your community activity...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to access your community activity."
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
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#C7FFF2"
          colors={["#C7FFF2", "#8CF0C7"]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobMiddle} />
      <View style={styles.backgroundBlobBottom} />
      <View style={styles.backgroundGlowOne} />
      <View style={styles.backgroundGlowTwo} />

      <View style={styles.heroCard}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hEyebrow}>COMMUNITY ACTIVITY</Text>
            <Text style={styles.hTitle}>Activity Ledger</Text>
            <Text style={styles.hSub}>
              Contributions, withdrawals, service fees and activity entries •{" "}
              {isAdmin ? "Admin" : "Member"}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons
              name="arrow-back-outline"
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{stats.count} entries</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {isAdmin ? "Admin view" : "Member view"}
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <View style={styles.summaryGrid}>
        <StatCard
          label="Added in"
          value={formatKes(stats.credits)}
          valueColor={COLORS.success}
          tintStyle={styles.summarySavings}
        />
        <StatCard
          label="Moved out"
          value={formatKes(stats.debits)}
          valueColor={COLORS.danger}
          tintStyle={styles.summarySupport}
        />
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <StatCard
          label="Service fees"
          value={formatKes(stats.fees)}
          valueColor="#9A5B00"
          tintStyle={styles.summaryWarning}
        />
        <StatCard
          label="Entries"
          value={String(stats.count)}
          tintStyle={styles.summaryPrimary}
        />
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <QuickActionCard
          title="Add Contribution"
          icon="arrow-down-circle-outline"
          onPress={() => router.push(ROUTES.tabs.paymentsDeposit)}
          tintStyle={styles.summarySavings}
          iconColor="#0B6A80"
        />

        <QuickActionCard
          title="Withdraw"
          icon="arrow-up-circle-outline"
          onPress={() => router.push(ROUTES.tabs.paymentsRequestWithdrawal)}
          tintStyle={styles.summarySupport}
          iconColor="#148C84"
        />
      </View>

      <Section title="Activity Entries">
        {ledger.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No activity entries"
            subtitle="Contributions, withdrawals and service fees will appear here."
            actionLabel="Add Contribution"
            onAction={() => router.push(ROUTES.tabs.paymentsDeposit)}
          />
        ) : (
          ledger.map((entry) => <LedgerRow key={entry.id} entry={entry} />)
        )}
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
    position: "relative",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
  },

  loadingText: {
    marginTop: SPACING.sm,
    color: "rgba(255,255,255,0.88)",
    fontFamily: FONT.regular,
    fontSize: 12,
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
    backgroundColor: TINT_SOFT,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: TINT_SOFT_BORDER,
    ...SHADOW.strong,
  },

  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -60,
    right: -40,
  },

  heroGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(140,240,199,0.08)",
    bottom: -30,
    left: -20,
  },

  header: {
    marginBottom: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  hEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 1,
  },

  hTitle: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 20,
    color: "#FFFFFF",
  },

  hSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.86)",
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  heroFooter: {
    marginTop: SPACING.sm,
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
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.24)",
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(239,68,68,0.18)",
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#FFFFFF",
    fontFamily: FONT.regular,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  summaryCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  summarySavings: {
    backgroundColor: TINT_SAVINGS,
    borderColor: TINT_SAVINGS_BORDER,
  },

  summarySupport: {
    backgroundColor: TINT_SUPPORT,
    borderColor: TINT_SUPPORT_BORDER,
  },

  summaryWarning: {
    backgroundColor: TINT_WARNING,
    borderColor: TINT_WARNING_BORDER,
  },

  summaryPrimary: {
    backgroundColor: TINT_PRIMARY,
    borderColor: TINT_PRIMARY_BORDER,
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: TEXT_SOFT,
  },

  summaryValue: {
    marginTop: 8,
    fontFamily: FONT.bold,
    fontSize: 16,
    color: TEXT_MAIN,
  },

  quickActionCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  quickActionInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: 40,
  },

  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  quickActionText: {
    flex: 1,
    color: TEXT_MAIN,
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  entryCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },

  entryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  entryIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  entryTitle: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: TEXT_MAIN,
  },

  entryMeta: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: TEXT_SOFT,
  },

  entryAmount: {
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  feeNoteRow: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(154,91,0,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  feeNoteText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "#9A5B00",
  },
});