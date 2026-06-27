import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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

import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  buildSavingsReference,
  canShowWithdrawAction,
  getApiErrorMessage,
  getMySavingsAccount,
  getSavingsAccountHistory,
  type SavingsAccount,
  type SavingsHistoryRow,
} from "@/services/savings";

const PAGE_BG = "#062C49";
const WHITE = "#FFFFFF";
const GLASS = "rgba(255,255,255,0.08)";
const GLASS_BORDER = "rgba(255,255,255,0.12)";
const TEXT_SOFT = "rgba(255,255,255,0.72)";
const TEXT_MUTED = "rgba(255,255,255,0.55)";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n)) {
    return "KES 0.00";
  }

  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getTxnTitle(row: SavingsHistoryRow) {
  const txnType = String(row.txn_type || "").toUpperCase();

  if (row.narration) return row.narration;
  if (txnType === "DEPOSIT") return "Contribution";
  if (txnType === "WITHDRAWAL") return "Withdrawal";
  if (txnType === "AUTO_DEDUCT") return "Auto deduction";
  if (txnType === "ADJUSTMENT") return "Adjustment";

  return "Activity";
}

function getTxnTone(row: SavingsHistoryRow) {
  const txnType = String(row.txn_type || "").toUpperCase();

  if (txnType === "DEPOSIT") {
    return {
      color: COLORS.success,
      sign: "+",
      icon: "arrow-down-circle-outline" as const,
      bg: "rgba(46,125,50,0.14)",
    };
  }

  if (txnType === "WITHDRAWAL" || txnType === "AUTO_DEDUCT") {
    return {
      color: COLORS.danger,
      sign: "-",
      icon: "arrow-up-circle-outline" as const,
      bg: "rgba(211,47,47,0.14)",
    };
  }

  return {
    color: COLORS.info,
    sign: "",
    icon: "swap-horizontal-outline" as const,
    bg: "rgba(37,99,235,0.14)",
  };
}

type StatCardProps = {
  label: string;
  value: string;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

type ActionButtonProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
};

function ActionButton({ title, icon, onPress, disabled }: ActionButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
    >
      <Ionicons name={icon} size={19} color={disabled ? TEXT_MUTED : WHITE} />
      <Text style={[styles.actionText, disabled && styles.actionTextDisabled]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function TransactionRow({ row }: { row: SavingsHistoryRow }) {
  const tone = getTxnTone(row);
  const title = getTxnTitle(row);
  const meta = row.reference || row.note || "";
  const date = formatDate(row.created_at);

  return (
    <View style={styles.txCard}>
      <View style={[styles.txIcon, { backgroundColor: tone.bg }]}>
        <Ionicons name={tone.icon} size={18} color={tone.color} />
      </View>

      <View style={styles.txBody}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {title}
        </Text>

        <Text style={styles.txMeta} numberOfLines={1}>
          {meta ? `${meta} • ` : ""}
          {date}
        </Text>
      </View>

      <Text style={[styles.txAmount, { color: tone.color }]}>
        {tone.sign}
        {formatKes(row.amount)}
      </Text>
    </View>
  );
}

export default function SavingsHistoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ accountId?: string }>();

  const routeAccountId = Number(params.accountId ?? 0);

  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [transactions, setTransactions] = useState<SavingsHistoryRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      let accountId = routeAccountId;

      if (!accountId || !Number.isFinite(accountId)) {
        const myAccount = await getMySavingsAccount();

        if (!myAccount?.id) {
          setAccount(null);
          setTransactions([]);
          setError("No savings account found.");
          return;
        }

        accountId = myAccount.id;
      }

      const data = await getSavingsAccountHistory(accountId);

      setAccount(data?.account || null);
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
    } catch (e: any) {
      setError(getApiErrorMessage(e));
      setTransactions([]);
    }
  }, [routeAccountId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        try {
          await load();
        } finally {
          if (active) {
            setReady(true);
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

  const totals = useMemo(() => {
    let credits = 0;
    let debits = 0;

    for (const row of transactions) {
      const amount = Number(row.amount ?? 0);
      const txnType = String(row.txn_type || "").toUpperCase();

      if (!Number.isFinite(amount) || amount <= 0) continue;

      if (txnType === "DEPOSIT") {
        credits += amount;
      }

      if (txnType === "WITHDRAWAL" || txnType === "AUTO_DEDUCT") {
        debits += amount;
      }
    }

    return { credits, debits };
  }, [transactions]);

  const accountName = account?.name || "Savings";
  const availableBalance = formatKes(account?.available_balance ?? account?.balance);
  const totalSaved = formatKes(account?.balance);
  const reservedAmount = formatKes(account?.reserved_amount);
  const addedByYou = formatKes(totals.credits);
  const takenOut = formatKes(totals.debits);

  const accountId = account?.id;
  const savingsReference = accountId ? buildSavingsReference(accountId) : "";
  const canWithdraw = canShowWithdrawAction(account);

  const goToDeposit = useCallback(() => {
    if (!accountId) return;

    router.push({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        category: "SAVINGS",
        purpose: "SAVINGS_DEPOSIT",
        accountId: String(accountId),
        reference: savingsReference,
        title: accountName,
      },
    });
  }, [accountId, accountName, savingsReference]);

  const goToWithdraw = useCallback(() => {
    if (!accountId || !canWithdraw) return;

    router.push({
      pathname: ROUTES.tabs.paymentsWithdrawals as any,
      params: {
        category: "SAVINGS",
        purpose: "SAVINGS_WITHDRAWAL",
        accountId: String(accountId),
        reference: savingsReference,
        title: accountName,
      },
    });
  }, [accountId, accountName, canWithdraw, savingsReference]);

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8CF0C7"
            colors={["#8CF0C7", "#0CC0B7"]}
          />
        }
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>UNITED CARE</Text>
            <Text style={styles.title}>Savings History</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back-outline" size={18} color={WHITE} />
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceOrbOne} />
          <View style={styles.balanceOrbTwo} />
          <View style={styles.balanceOrbThree} />

          <Text style={styles.accountName}>{accountName}</Text>
          <Text style={styles.balanceLabel}>Available balance</Text>
          <Text style={styles.balanceValue}>{availableBalance}</Text>

          <View style={styles.actionsRow}>
            <ActionButton
              title="Add"
              icon="add-circle-outline"
              onPress={goToDeposit}
              disabled={!accountId}
            />

            <ActionButton
              title="Withdraw"
              icon="arrow-up-circle-outline"
              onPress={goToWithdraw}
              disabled={!accountId || !canWithdraw}
            />
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard label="Total saved" value={totalSaved} />
          <StatCard label="Reserved" value={reservedAmount} />
          <StatCard label="Added" value={addedByYou} />
          <StatCard label="Taken out" value={takenOut} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
        </View>

        {!ready ? (
          <Text style={styles.silentLoadingText}>Updating history...</Text>
        ) : null}

        {ready && transactions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="receipt-outline"
              title="No activity yet"
              subtitle="Your savings deposits and withdrawals will appear here."
              actionLabel="Back to Savings"
              onAction={() => router.replace(ROUTES.tabs.savings)}
            />
          </View>
        ) : null}

        {transactions.map((row) => (
          <TransactionRow key={row.id} row={row} />
        ))}
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

  header: {
    marginBottom: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerText: {
    flex: 1,
  },

  eyebrow: {
    color: TEXT_MUTED,
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 1,
  },

  title: {
    marginTop: 4,
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 25,
    lineHeight: 31,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  balanceCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: 28,
    backgroundColor: "rgba(12,106,128,0.45)",
    borderWidth: 1,
    borderColor: "rgba(176,243,234,0.12)",
    ...SHADOW.strong,
  },

  balanceOrbOne: {
    position: "absolute",
    right: -36,
    top: -20,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(38, 208, 214, 0.18)",
  },

  balanceOrbTwo: {
    position: "absolute",
    left: -12,
    bottom: -35,
    width: 145,
    height: 145,
    borderRadius: 999,
    backgroundColor: "rgba(42, 206, 180, 0.16)",
  },

  balanceOrbThree: {
    position: "absolute",
    right: 60,
    bottom: -55,
    width: 210,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(102, 212, 109, 0.15)",
  },

  accountName: {
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 15,
  },

  balanceLabel: {
    marginTop: SPACING.md,
    color: TEXT_SOFT,
    fontFamily: FONT.regular,
    fontSize: 13,
  },

  balanceValue: {
    marginTop: 8,
    marginBottom: SPACING.lg,
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 31,
    lineHeight: 38,
  },

  actionsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },

  actionButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  actionButtonDisabled: {
    opacity: 0.55,
  },

  actionText: {
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  actionTextDisabled: {
    color: TEXT_MUTED,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(239,68,68,0.16)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.28)",
  },

  errorText: {
    flex: 1,
    color: WHITE,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
    marginBottom: SPACING.md,
  },

  statCard: {
    width: "48%",
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...SHADOW.card,
  },

  statLabel: {
    color: TEXT_SOFT,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  statValue: {
    marginTop: 6,
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 15,
  },

  sectionHeader: {
    marginBottom: SPACING.sm,
  },

  sectionTitle: {
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 16,
  },

  silentLoadingText: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    textAlign: "center",
    color: TEXT_MUTED,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  emptyWrap: {
    marginTop: SPACING.sm,
  },

  txCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...SHADOW.card,
  },

  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  txBody: {
    flex: 1,
    minWidth: 0,
  },

  txTitle: {
    color: WHITE,
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  txMeta: {
    marginTop: 5,
    color: TEXT_SOFT,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  txAmount: {
    fontFamily: FONT.bold,
    fontSize: 13,
    marginLeft: SPACING.xs,
  },
});

// import { Ionicons } from "@expo/vector-icons";
// import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
// import React, { useCallback, useMemo, useState } from "react";
// import {
//   RefreshControl,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import {
//   SafeAreaView,
//   useSafeAreaInsets,
// } from "react-native-safe-area-context";

// import Button from "@/components/ui/Button";
// import Card from "@/components/ui/Card";
// import EmptyState from "@/components/ui/EmptyState";
// import Section from "@/components/ui/Section";

// import { ROUTES } from "@/constants/routes";
// import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
// import {
//   buildSavingsReference,
//   canShowWithdrawAction,
//   getApiErrorMessage,
//   getMySavingsAccount,
//   getSavingsAccountHistory,
//   getSavingsLockMessage,
//   getSavingsTypeLabel,
//   isSavingsLocked,
//   type SavingsAccount,
//   type SavingsHistoryRow,
// } from "@/services/savings";

// type SpaceTone = "savings" | "merry" | "groups" | "support";

// function getSpaceTonePalette(tone: SpaceTone) {
//   const map = {
//     savings: {
//       card: "rgba(29, 196, 182, 0.22)",
//       border: "rgba(129, 244, 231, 0.15)",
//       iconBg: "rgba(220, 255, 250, 0.75)",
//       icon: "#0B6A80",
//       chip: "rgba(255,255,255,0.14)",
//       amountBg: "rgba(255,255,255,0.10)",
//     },
//     merry: {
//       card: "rgba(98, 192, 98, 0.23)",
//       border: "rgba(194, 255, 188, 0.16)",
//       iconBg: "rgba(236, 255, 235, 0.76)",
//       icon: "#379B4A",
//       chip: "rgba(255,255,255,0.14)",
//       amountBg: "rgba(255,255,255,0.10)",
//     },
//     groups: {
//       card: "rgba(49, 180, 217, 0.22)",
//       border: "rgba(189, 244, 255, 0.15)",
//       iconBg: "rgba(236, 251, 255, 0.76)",
//       icon: "#0A6E8A",
//       chip: "rgba(255,255,255,0.14)",
//       amountBg: "rgba(255,255,255,0.10)",
//     },
//     support: {
//       card: "rgba(52, 198, 191, 0.22)",
//       border: "rgba(195, 255, 250, 0.16)",
//       iconBg: "rgba(236, 255, 252, 0.76)",
//       icon: "#148C84",
//       chip: "rgba(255,255,255,0.14)",
//       amountBg: "rgba(255,255,255,0.10)",
//     },
//   };

//   return map[tone];
// }

// function formatKes(value?: string | number | null) {
//   const n = Number(value ?? 0);
//   if (!Number.isFinite(n)) return "KES 0.00";

//   return `KES ${n.toLocaleString("en-KE", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// }

// function formatDate(value?: string | null) {
//   if (!value) return "—";

//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return value;

//   return date.toLocaleString("en-KE", {
//     year: "numeric",
//     month: "short",
//     day: "numeric",
//   });
// }

// function getTxnTitle(row: SavingsHistoryRow) {
//   const txnType = String(row.txn_type || "").toUpperCase();

//   if (row.narration) return row.narration;
//   if (txnType === "DEPOSIT") return "Contribution added";
//   if (txnType === "WITHDRAWAL") return "Withdrawal";
//   if (txnType === "ADJUSTMENT") return "Update";
//   if (txnType === "AUTO_DEDUCT") return "Automatic deduction";

//   return "Activity";
// }

// function getTxnTone(row: SavingsHistoryRow) {
//   const txnType = String(row.txn_type || "").toUpperCase();

//   if (txnType === "DEPOSIT") {
//     return {
//       color: COLORS.success,
//       sign: "+",
//       icon: "arrow-down-circle-outline" as const,
//       bg: "rgba(46, 125, 50, 0.14)",
//     };
//   }

//   if (txnType === "WITHDRAWAL" || txnType === "AUTO_DEDUCT") {
//     return {
//       color: COLORS.danger,
//       sign: "-",
//       icon: "arrow-up-circle-outline" as const,
//       bg: "rgba(211, 47, 47, 0.14)",
//     };
//   }

//   return {
//     color: COLORS.info,
//     sign: "",
//     icon: "swap-horizontal-outline" as const,
//     bg: "rgba(37, 99, 235, 0.14)",
//   };
// }

// function TypePill({ account }: { account: SavingsAccount }) {
//   const type = String(account.account_type || "").toUpperCase();
//   const locked = isSavingsLocked(account);

//   let bg = "rgba(12, 106, 128, 0.16)";
//   let color = "#DFFBFF";
//   const label = getSavingsTypeLabel(type);

//   if (type === "FIXED") {
//     bg = locked ? "rgba(242, 140, 40, 0.16)" : "rgba(242, 140, 40, 0.12)";
//     color = "#FFD58F";
//   }

//   if (type === "TARGET") {
//     bg = "rgba(46, 125, 50, 0.16)";
//     color = "#BAF5C0";
//   }

//   return (
//     <View style={[styles.typePill, { backgroundColor: bg }]}>
//       <Text style={[styles.typePillText, { color }]} numberOfLines={1}>
//         {label}
//       </Text>
//     </View>
//   );
// }

// function StatusBanner({ account }: { account: SavingsAccount }) {
//   if (!account.is_active) {
//     return (
//       <View style={[styles.banner, styles.bannerDanger]}>
//         <Ionicons name="alert-circle-outline" size={16} color="#FFD4D4" />
//         <Text style={[styles.bannerText, { color: "#FFD4D4" }]}>
//           This savings space is currently inactive.
//         </Text>
//       </View>
//     );
//   }

//   const lockMessage = getSavingsLockMessage(account);
//   if (lockMessage) {
//     return (
//       <View style={[styles.banner, styles.bannerWarning]}>
//         <Ionicons name="lock-closed-outline" size={16} color="#FFD58F" />
//         <Text style={[styles.bannerText, { color: "#FFD58F" }]}>
//           {lockMessage}
//         </Text>
//       </View>
//     );
//   }

//   return (
//     <View style={[styles.banner, styles.bannerSuccess]}>
//       <Ionicons
//         name="checkmark-circle-outline"
//         size={16}
//         color="#BAF5C0"
//       />
//       <Text style={[styles.bannerText, { color: "#BAF5C0" }]}>
//         Your savings space is active and ready.
//       </Text>
//     </View>
//   );
// }

// function SummaryCard({
//   label,
//   value,
//   tone,
// }: {
//   label: string;
//   value: string;
//   tone?: "default" | "success" | "danger";
// }) {
//   const valueColor =
//     tone === "success"
//       ? COLORS.success
//       : tone === "danger"
//         ? COLORS.danger
//         : "#FFFFFF";

//   return (
//     <View style={styles.summaryCard}>
//       <Text style={styles.summaryLabel}>{label}</Text>
//       <Text style={[styles.summaryValue, { color: valueColor }]} numberOfLines={1}>
//         {value}
//       </Text>
//     </View>
//   );
// }

// function AccountCard({ account }: { account: SavingsAccount }) {
//   const palette = getSpaceTonePalette("savings");

//   return (
//     <Card
//       style={[
//         styles.accountCard,
//         {
//           backgroundColor: palette.card,
//           borderColor: palette.border,
//         },
//       ]}
//     >
//       <View style={styles.accountHead}>
//         <View style={styles.accountHeadText}>
//           <Text style={styles.accountName} numberOfLines={1}>
//             {account.name || "My Savings"}
//           </Text>
//           <Text style={styles.accountMeta}>Your personal community savings space</Text>
//         </View>

//         <TypePill account={account} />
//       </View>

//       <StatusBanner account={account} />

//       <View style={styles.metricsGrid}>
//         <View style={styles.metricCard}>
//           <Text style={styles.metricLabel}>Total saved</Text>
//           <Text style={styles.metricValue}>{formatKes(account.balance)}</Text>
//         </View>

//         <View style={styles.metricCard}>
//           <Text style={styles.metricLabel}>Ready to use</Text>
//           <Text style={styles.metricValue}>
//             {formatKes(account.available_balance)}
//           </Text>
//         </View>

//         <View style={styles.metricCard}>
//           <Text style={styles.metricLabel}>Set aside</Text>
//           <Text style={styles.metricValue}>
//             {formatKes(account.reserved_amount)}
//           </Text>
//         </View>

//         <View style={styles.metricCard}>
//           <Text style={styles.metricLabel}>Space status</Text>
//           <Text style={styles.metricValue}>
//             {account.is_active ? "Active" : "Inactive"}
//           </Text>
//         </View>
//       </View>
//     </Card>
//   );
// }

// function TransactionRow({ row }: { row: SavingsHistoryRow }) {
//   const tone = getTxnTone(row);
//   const title = getTxnTitle(row);
//   const meta = row.reference || row.note || "";
//   const date = formatDate(row.created_at);

//   return (
//     <Card style={styles.txCard}>
//       <View style={styles.txRow}>
//         <View style={[styles.txIconWrap, { backgroundColor: tone.bg }]}>
//           <Ionicons name={tone.icon} size={18} color={tone.color} />
//         </View>

//         <View style={styles.txBody}>
//           <Text style={styles.txTitle} numberOfLines={1}>
//             {title}
//           </Text>

//           <Text style={styles.txMeta} numberOfLines={2}>
//             {meta ? `${meta} • ` : ""}
//             {date}
//           </Text>
//         </View>

//         <Text style={[styles.txAmount, { color: tone.color }]}>
//           {tone.sign}
//           {formatKes(row.amount)}
//         </Text>
//       </View>
//     </Card>
//   );
// }

// export default function SavingsHistoryScreen() {
//   const insets = useSafeAreaInsets();

//   const params = useLocalSearchParams<{ accountId?: string }>();
//   const routeAccountId = Number(params.accountId ?? 0);

//   const [account, setAccount] = useState<SavingsAccount | null>(null);
//   const [transactions, setTransactions] = useState<SavingsHistoryRow[]>([]);
//   const [refreshing, setRefreshing] = useState(false);
//   const [error, setError] = useState("");
//   const [ready, setReady] = useState(false);

//   const load = useCallback(async () => {
//     try {
//       setError("");

//       let accountId = routeAccountId;

//       if (!accountId || !Number.isFinite(accountId)) {
//         const myAccount = await getMySavingsAccount();
//         if (!myAccount?.id) {
//           setAccount(null);
//           setTransactions([]);
//           setError("No savings space found.");
//           return;
//         }
//         accountId = myAccount.id;
//       }

//       const data = await getSavingsAccountHistory(accountId);
//       setAccount(data?.account || null);
//       setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
//     } catch (e: any) {
//       setAccount(null);
//       setTransactions([]);
//       setError(getApiErrorMessage(e));
//     }
//   }, [routeAccountId]);

//   useFocusEffect(
//     useCallback(() => {
//       let active = true;

//       const run = async () => {
//         try {
//           await load();
//         } finally {
//           if (active) {
//             setReady(true);
//           }
//         }
//       };

//       run();

//       return () => {
//         active = false;
//       };
//     }, [load])
//   );

//   const onRefresh = useCallback(async () => {
//     try {
//       setRefreshing(true);
//       await load();
//     } finally {
//       setRefreshing(false);
//     }
//   }, [load]);

//   const totals = useMemo(() => {
//     let credits = 0;
//     let debits = 0;

//     for (const row of transactions) {
//       const amount = Number(row.amount ?? 0);
//       const txnType = String(row.txn_type || "").toUpperCase();

//       if (!Number.isFinite(amount) || amount <= 0) continue;

//       if (txnType === "DEPOSIT") {
//         credits += amount;
//       } else if (txnType === "WITHDRAWAL" || txnType === "AUTO_DEDUCT") {
//         debits += amount;
//       }
//     }

//     return { credits, debits };
//   }, [transactions]);

//   const canWithdraw = canShowWithdrawAction(account);
//   const savingsReference = account?.id ? buildSavingsReference(account.id) : "";

//   if (!ready) {
//     return null;
//   }

//   if (!account && error) {
//     return (
//       <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
//         <View style={styles.page}>
//           <EmptyState
//             title="Unable to open savings space"
//             subtitle={error}
//             actionLabel="Back to Savings"
//             onAction={() => router.replace(ROUTES.tabs.savings)}
//           />
//         </View>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
//       <ScrollView
//         style={styles.page}
//         contentContainerStyle={[
//           styles.content,
//           { paddingBottom: Math.max(insets.bottom + 24, 32) },
//         ]}
//         showsVerticalScrollIndicator={false}
//         refreshControl={
//           <RefreshControl
//             refreshing={refreshing}
//             onRefresh={onRefresh}
//             tintColor="#C7FFF2"
//             colors={["#C7FFF2", "#8CF0C7"]}
//           />
//         }
//       >
//         <View style={styles.backgroundBlobTop} />
//         <View style={styles.backgroundBlobMiddle} />
//         <View style={styles.backgroundBlobBottom} />
//         <View style={styles.backgroundGlowOne} />
//         <View style={styles.backgroundGlowTwo} />

//         <View style={styles.heroCard}>
//           <View style={styles.heroGlowOne} />
//           <View style={styles.heroGlowTwo} />

//           <View style={styles.header}>
//             <View style={styles.headerTextWrap}>
//               <Text style={styles.eyebrow}>SAVINGS ACTIVITY</Text>
//               <Text style={styles.title}>Savings History</Text>
//               <Text style={styles.subtitle}>
//                 Follow your community saving journey and recent activity in one place.
//               </Text>
//             </View>

//             <TouchableOpacity
//               activeOpacity={0.9}
//               onPress={() => router.back()}
//               style={styles.backBtn}
//             >
//               <Ionicons
//                 name="arrow-back-outline"
//                 size={18}
//                 color="#FFFFFF"
//               />
//             </TouchableOpacity>
//           </View>
//         </View>

//         {error ? (
//           <Card style={styles.errorCard}>
//             <Ionicons
//               name="alert-circle-outline"
//               size={18}
//               color="#FFFFFF"
//             />
//             <Text style={styles.errorText}>{error}</Text>
//           </Card>
//         ) : null}

//         {account ? (
//           <>
//             <Section title="Your savings space">
//               <AccountCard account={account} />
//             </Section>

//             <View style={styles.summaryGrid}>
//               <SummaryCard
//                 label="Added by you"
//                 value={formatKes(totals.credits)}
//                 tone="success"
//               />
//               <SummaryCard
//                 label="Taken out"
//                 value={formatKes(totals.debits)}
//                 tone="danger"
//               />
//             </View>

//             <Section
//               title="Recent activity"
//               right={
//                 <View style={styles.sectionActions}>
//                   <Button
//                     title="Add"
//                     variant="ghost"
//                     onPress={() =>
//                       router.push({
//                         pathname: ROUTES.tabs.paymentsDeposit as any,
//                         params: {
//                           category: "SAVINGS",
//                           purpose: "SAVINGS_DEPOSIT",
//                           accountId: String(account.id),
//                           reference: savingsReference,
//                           title: account.name || "Savings",
//                         },
//                       })
//                     }
//                   />
//                   {canWithdraw ? (
//                     <Button
//                       title="Withdraw"
//                       variant="ghost"
//                       onPress={() =>
//                         router.push({
//                           pathname: ROUTES.tabs.paymentsWithdrawals as any,
//                           params: {
//                             category: "SAVINGS",
//                             purpose: "SAVINGS_WITHDRAWAL",
//                             accountId: String(account.id),
//                             reference: savingsReference,
//                             title: account.name || "Savings",
//                           },
//                         })
//                       }
//                     />
//                   ) : null}
//                 </View>
//               }
//             >
//               {transactions.length === 0 ? (
//                 <EmptyState
//                   icon="receipt-outline"
//                   title="No activity yet"
//                   subtitle="When you add to savings or make a withdrawal, it will appear here."
//                   actionLabel="Add to Savings"
//                   onAction={() =>
//                     router.push({
//                       pathname: ROUTES.tabs.paymentsDeposit as any,
//                       params: {
//                         category: "SAVINGS",
//                         purpose: "SAVINGS_DEPOSIT",
//                         accountId: String(account.id),
//                         reference: savingsReference,
//                         title: account.name || "Savings",
//                       },
//                     })
//                   }
//                 />
//               ) : (
//                 transactions.map((row) => (
//                   <TransactionRow key={row.id} row={row} />
//                 ))
//               )}
//             </Section>
//           </>
//         ) : (
//           <EmptyState
//             title="No savings space"
//             subtitle="Your community saving activity will appear here once your space is ready."
//             actionLabel="Back to Savings"
//             onAction={() => router.replace(ROUTES.tabs.savings)}
//           />
//         )}
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   page: {
//     flex: 1,
//     backgroundColor: "#062C49",
//   },

//   content: {
//     padding: SPACING.lg,
//     position: "relative",
//   },

//   backgroundBlobTop: {
//     position: "absolute",
//     top: -60,
//     right: -30,
//     width: 220,
//     height: 220,
//     borderRadius: 999,
//     backgroundColor: "rgba(19, 195, 178, 0.10)",
//   },

//   backgroundBlobMiddle: {
//     position: "absolute",
//     top: 260,
//     left: -80,
//     width: 220,
//     height: 220,
//     borderRadius: 999,
//     backgroundColor: "rgba(52, 174, 213, 0.08)",
//   },

//   backgroundBlobBottom: {
//     position: "absolute",
//     bottom: 80,
//     right: -40,
//     width: 260,
//     height: 260,
//     borderRadius: 999,
//     backgroundColor: "rgba(112, 208, 115, 0.09)",
//   },

//   backgroundGlowOne: {
//     position: "absolute",
//     top: 100,
//     left: 40,
//     width: 6,
//     height: 6,
//     borderRadius: 999,
//     backgroundColor: "rgba(255,255,255,0.45)",
//   },

//   backgroundGlowTwo: {
//     position: "absolute",
//     top: 180,
//     right: 60,
//     width: 10,
//     height: 10,
//     borderRadius: 999,
//     backgroundColor: "rgba(255,255,255,0.18)",
//   },

//   heroCard: {
//     position: "relative",
//     overflow: "hidden",
//     marginBottom: SPACING.lg,
//     padding: SPACING.lg,
//     borderRadius: 24,
//     backgroundColor: "rgba(255,255,255,0.08)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.12)",
//     ...SHADOW.card,
//   },

//   heroGlowOne: {
//     position: "absolute",
//     width: 180,
//     height: 180,
//     borderRadius: 999,
//     backgroundColor: "rgba(255,255,255,0.06)",
//     top: -40,
//     right: -30,
//   },

//   heroGlowTwo: {
//     position: "absolute",
//     width: 120,
//     height: 120,
//     borderRadius: 999,
//     backgroundColor: "rgba(140, 240, 199, 0.10)",
//     bottom: -20,
//     left: -10,
//   },

//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.md,
//   },

//   headerTextWrap: {
//     flex: 1,
//   },

//   eyebrow: {
//     fontFamily: FONT.bold,
//     fontSize: 11,
//     color: "rgba(255,255,255,0.78)",
//     letterSpacing: 1,
//   },

//   title: {
//     marginTop: 6,
//     fontFamily: FONT.bold,
//     fontSize: 22,
//     color: "#FFFFFF",
//   },

//   subtitle: {
//     marginTop: 6,
//     fontFamily: FONT.regular,
//     fontSize: 13,
//     lineHeight: 19,
//     color: "rgba(255,255,255,0.86)",
//   },

//   backBtn: {
//     width: 40,
//     height: 40,
//     borderRadius: 14,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: "rgba(255,255,255,0.12)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.10)",
//   },

//   errorCard: {
//     marginBottom: SPACING.md,
//     padding: SPACING.md,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.sm,
//     borderWidth: 1,
//     borderColor: "rgba(239,68,68,0.22)",
//     backgroundColor: "rgba(211, 47, 47, 0.18)",
//     borderRadius: RADIUS.lg,
//   },

//   errorText: {
//     flex: 1,
//     fontFamily: FONT.regular,
//     fontSize: 12,
//     lineHeight: 18,
//     color: "#FFFFFF",
//   },

//   accountCard: {
//     padding: SPACING.md,
//     borderRadius: RADIUS.lg,
//     borderWidth: 1,
//     ...SHADOW.card,
//   },

//   accountHead: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     justifyContent: "space-between",
//     gap: SPACING.md,
//   },

//   accountHeadText: {
//     flex: 1,
//   },

//   accountName: {
//     fontFamily: FONT.bold,
//     fontSize: 16,
//     color: "#FFFFFF",
//   },

//   accountMeta: {
//     marginTop: 6,
//     fontFamily: FONT.regular,
//     fontSize: 12,
//     color: "rgba(255,255,255,0.74)",
//   },

//   typePill: {
//     borderRadius: 999,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     maxWidth: 150,
//   },

//   typePillText: {
//     fontFamily: FONT.bold,
//     fontSize: 11,
//   },

//   banner: {
//     marginTop: SPACING.md,
//     borderRadius: RADIUS.md,
//     paddingHorizontal: SPACING.sm,
//     paddingVertical: SPACING.sm,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.xs,
//     borderWidth: 1,
//   },

//   bannerSuccess: {
//     backgroundColor: "rgba(46, 125, 50, 0.10)",
//     borderColor: "rgba(46, 125, 50, 0.20)",
//   },

//   bannerWarning: {
//     backgroundColor: "rgba(242, 140, 40, 0.12)",
//     borderColor: "rgba(242, 140, 40, 0.22)",
//   },

//   bannerDanger: {
//     backgroundColor: "rgba(211, 47, 47, 0.10)",
//     borderColor: "rgba(211, 47, 47, 0.20)",
//   },

//   bannerText: {
//     flex: 1,
//     fontFamily: FONT.medium || FONT.regular,
//     fontSize: 12,
//     lineHeight: 18,
//   },

//   metricsGrid: {
//     marginTop: SPACING.md,
//     flexDirection: "row",
//     flexWrap: "wrap",
//     gap: SPACING.sm as any,
//   },

//   metricCard: {
//     width: "48%",
//     borderRadius: RADIUS.md,
//     padding: SPACING.sm,
//     backgroundColor: "rgba(255,255,255,0.08)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.10)",
//   },

//   metricLabel: {
//     fontFamily: FONT.regular,
//     fontSize: 11,
//     color: "rgba(255,255,255,0.65)",
//   },

//   metricValue: {
//     marginTop: 6,
//     fontFamily: FONT.bold,
//     fontSize: 13,
//     color: "#FFFFFF",
//   },

//   summaryGrid: {
//     flexDirection: "row",
//     gap: SPACING.sm as any,
//     marginBottom: SPACING.md,
//   },

//   summaryCard: {
//     flex: 1,
//     backgroundColor: "rgba(255,255,255,0.08)",
//     borderRadius: RADIUS.lg,
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.10)",
//     padding: SPACING.md,
//     ...SHADOW.card,
//   },

//   summaryLabel: {
//     fontFamily: FONT.regular,
//     fontSize: 12,
//     color: "rgba(255,255,255,0.65)",
//   },

//   summaryValue: {
//     marginTop: 8,
//     fontFamily: FONT.bold,
//     fontSize: 16,
//   },

//   sectionActions: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.xs,
//   },

//   txCard: {
//     marginBottom: SPACING.md,
//     padding: SPACING.md,
//     borderRadius: RADIUS.lg,
//     backgroundColor: "rgba(255,255,255,0.08)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.10)",
//     ...SHADOW.card,
//   },

//   txRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.sm,
//   },

//   txIconWrap: {
//     width: 38,
//     height: 38,
//     borderRadius: 19,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   txBody: {
//     flex: 1,
//     minWidth: 0,
//   },

//   txTitle: {
//     fontFamily: FONT.bold,
//     fontSize: 13,
//     color: "#FFFFFF",
//   },

//   txMeta: {
//     marginTop: 5,
//     fontFamily: FONT.regular,
//     fontSize: 12,
//     lineHeight: 17,
//     color: "rgba(255,255,255,0.70)",
//   },

//   txAmount: {
//     fontFamily: FONT.bold,
//     fontSize: 13,
//     marginLeft: SPACING.xs,
//   },
// });