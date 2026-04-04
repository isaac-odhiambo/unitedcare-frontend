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
type SpaceTone = "savings" | "merry" | "groups" | "support";
type NoticeTone = "primary" | "success" | "warning" | "info";

const PAGE_BG = "#062C49";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.90)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.74)";
const GLASS_CARD = "rgba(255,255,255,0.08)";
const GLASS_BORDER = "rgba(255,255,255,0.10)";

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
  if (c === "WITHDRAWAL") return "paper-plane-outline";
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
  if (c === "WITHDRAWAL") return "Request";
  if (c === "WITHDRAWAL_FEE") return "Service fee";
  if (c === "TRANSACTION_FEE") return "Service fee";
  return c || "Activity";
}

function isFeeCategory(category?: string) {
  const c = String(category || "").toUpperCase();
  return c === "WITHDRAWAL_FEE" || c === "TRANSACTION_FEE";
}

function getCategoryPalette(category?: string) {
  const c = String(category || "").toUpperCase();

  if (c === "SAVINGS") return getSpaceTonePalette("savings");
  if (c === "MERRY") return getSpaceTonePalette("merry");
  if (c === "GROUP") return getSpaceTonePalette("groups");
  if (c === "LOANS" || c === "WITHDRAWAL") return getSpaceTonePalette("support");

  if (c === "WITHDRAWAL_FEE" || c === "TRANSACTION_FEE") {
    return {
      card: "rgba(242, 140, 40, 0.16)",
      border: "rgba(242, 140, 40, 0.24)",
      iconBg: "rgba(255, 244, 224, 0.85)",
      icon: "#9A5B00",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    };
  }

  return getSpaceTonePalette("groups");
}

function StatCard({
  label,
  value,
  valueColor,
  tone,
}: {
  label: string;
  value: string;
  valueColor?: string;
  tone: SpaceTone;
}) {
  const palette = getSpaceTonePalette(tone);

  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, valueColor ? { color: valueColor } : null]}
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
  tone,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone: SpaceTone;
}) {
  const palette = getSpaceTonePalette(tone);

  return (
    <Card
      onPress={onPress}
      style={[
        styles.quickActionCard,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
    >
      <View style={styles.quickActionInner}>
        <View
          style={[
            styles.quickActionIcon,
            { backgroundColor: palette.iconBg },
          ]}
        >
          <Ionicons name={icon} size={18} color={palette.icon} />
        </View>
        <Text style={styles.quickActionText}>{title}</Text>
      </View>
    </Card>
  );
}

function NoticeBanner({
  tone,
  icon,
  text,
}: {
  tone: NoticeTone;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  const palette = getOverviewTonePalette(tone);

  return (
    <View style={styles.noticeCard}>
      <View
        style={[
          styles.noticeGlow,
          { backgroundColor: palette.soft },
        ]}
      />
      <View style={styles.noticeRow}>
        <View
          style={[
            styles.noticeIconWrap,
            { backgroundColor: palette.iconBg },
          ]}
        >
          <Ionicons name={icon} size={18} color={palette.icon} />
        </View>
        <Text style={styles.noticeText}>{text}</Text>
      </View>
    </View>
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
            color="#F4C46A"
          />
          <Text style={styles.feeNoteText}>
            This line shows a small service fee linked to this activity.
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
          subtitle="Please log in to open your community space."
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

      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: getSpaceTonePalette("groups").card,
            borderColor: getSpaceTonePalette("groups").border,
          },
        ]}
      >
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hEyebrow}>COMMUNITY SPACE</Text>
            <Text style={styles.hTitle}>Shared Activity</Text>
            <Text style={styles.hSub}>
              Follow your contributions, requests, service fees, and other shared updates •{" "}
              {isAdmin ? "Admin" : "Member"}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => router.replace(ROUTES.tabs.payments)}
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
            <Text style={styles.heroPillText}>{stats.count} updates</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              {isAdmin ? "Admin view" : "Member view"}
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={18} color="#FFD4D4" />
          </View>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.summaryGrid}>
        <StatCard
          label="Added"
          value={formatKes(stats.credits)}
          valueColor={COLORS.success}
          tone="savings"
        />
        <StatCard
          label="Shared out"
          value={formatKes(stats.debits)}
          valueColor={COLORS.danger}
          tone="support"
        />
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <StatCard
          label="Service fees"
          value={formatKes(stats.fees)}
          valueColor="#F4C46A"
          tone="merry"
        />
        <StatCard
          label="Updates"
          value={String(stats.count)}
          tone="groups"
        />
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <QuickActionCard
          title="Add contribution"
          icon="arrow-down-circle-outline"
          onPress={() => router.push(ROUTES.tabs.paymentsDeposit)}
          tone="savings"
        />

        <QuickActionCard
          title="Send request"
          icon="paper-plane-outline"
          onPress={() => router.push(ROUTES.tabs.paymentsRequestWithdrawal)}
          tone="support"
        />
      </View>

      {!ledger.length && !error ? (
        <NoticeBanner
          tone="info"
          icon="information-circle-outline"
          text="Your contributions, requests, and service fees will appear here."
        />
      ) : null}

      <Section title="Recent updates">
        {ledger.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No activity yet"
            subtitle="When you support the community or send a request, it will appear here."
            actionLabel="Add contribution"
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
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    overflow: "hidden",
    borderWidth: 1,
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

  errorIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#FFFFFF",
    fontFamily: FONT.regular,
  },

  noticeCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: RADIUS.xl,
    backgroundColor: GLASS_CARD,
  },

  noticeGlow: {
    position: "absolute",
    right: -18,
    top: -12,
    width: 90,
    height: 90,
    borderRadius: 999,
  },

  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  noticeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeText: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: 13,
    lineHeight: 18,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  statLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: TEXT_ON_DARK_SOFT,
  },

  statValue: {
    marginTop: 8,
    fontFamily: FONT.bold,
    fontSize: 16,
    color: WHITE,
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
    color: WHITE,
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
    color: WHITE,
  },

  entryMeta: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: TEXT_ON_DARK_SOFT,
  },

  entryAmount: {
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  feeNoteRow: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(244,196,106,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  feeNoteText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "#F4C46A",
  },
});