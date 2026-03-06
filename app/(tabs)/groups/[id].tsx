
// app/(tabs)/groups/[id].tsx
// ------------------------------------------------
// ✅ Updated to match services/groups.ts
// ✅ Uses getMyGroupContributions()
// ✅ Uses GroupContribution type
// ------------------------------------------------

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";

import {
  getApiErrorMessage,
  getMyGroupContributions,
  GroupContribution,
} from "@/services/groups";

/* ------------------------------------------------
Helpers
------------------------------------------------ */

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);

  if (Number.isNaN(n)) return "KES 0.00";

  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(s?: string) {
  if (!s) return "—";
  return String(s).replace("T", " ").slice(0, 16);
}

/* ------------------------------------------------
Screen
------------------------------------------------ */

export default function GroupContributionHistoryScreen() {
  const { id } = useLocalSearchParams();
  const groupId = Number(id);

  const [rows, setRows] = useState<GroupContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!groupId || Number.isNaN(groupId)) {
      Alert.alert("Group", "Invalid group id.");
      return;
    }

    try {
      setLoading(true);

      const data = await getMyGroupContributions(groupId);

      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Group", getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const total = useMemo(() => {
    return rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  }, [rows]);

  /* ------------------------------------------------
  UI
  ------------------------------------------------ */

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Group Contributions</Text>
          <Text style={styles.hSub}>Group #{groupId}</Text>
        </View>

        <Button
          variant="ghost"
          title="Back"
          onPress={() => router.back()}
          leftIcon={
            <Ionicons
              name="chevron-back"
              size={16}
              color={COLORS.primary}
            />
          }
        />
      </View>

      {/* Summary */}

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>My Total Contribution</Text>
          <Text style={styles.summaryValue}>{formatKes(total)}</Text>
        </View>
      </View>

      {/* Actions */}

      <View style={styles.actionBar}>
        <Button
          title="Contribute"
          onPress={() =>
            router.push(`/groups/contribute?group_id=${groupId}` as any)
          }
          style={{ flex: 1 }}
          leftIcon={
            <Ionicons
              name="cash-outline"
              size={18}
              color={COLORS.white}
            />
          }
        />
      </View>

      {/* Transactions */}

      <Section title="Contribution History">
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No contributions yet"
            subtitle="Your group contributions will appear here."
          />
        ) : (
          rows.map((r, index) => {
            return (
              <Card key={r.id ?? index} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.amount}>{formatKes(r.amount)}</Text>
                </View>

                <Text style={styles.meta}>
                  {fmtDate(r.created_at)}
                  {r.reference ? ` • Ref: ${r.reference}` : ""}
                </Text>

                {r.method ? (
                  <Text style={styles.narration}>
                    Method: {r.method}
                  </Text>
                ) : null}

                {r.mpesa_receipt_number ? (
                  <Text style={styles.narration}>
                    MPESA: {r.mpesa_receipt_number}
                  </Text>
                ) : null}
              </Card>
            );
          })
        )}
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

/* ------------------------------------------------
Styles
------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },

  hTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  hSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  summaryValue: {
    marginTop: 8,
    fontFamily: FONT.bold,
    fontSize: 16,
    color: COLORS.dark,
  },

  actionBar: {
    flexDirection: "row",
    marginTop: SPACING.md,
    alignItems: "center",
  },

  muted: {
    marginTop: 6,
    fontFamily: FONT.regular,
    color: COLORS.gray,
  },

  rowCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  amount: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  meta: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  narration: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
// // app/(tabs)/savings/[id].tsx (COMPLETE + UPDATED)
// // ------------------------------------------------
// // ✅ Updated to match the latest services/savings.ts
// // ✅ Uses getSavingsHistoryRows() instead of getSavingsAccountHistory()
// // ✅ Uses savingsStatementPdfUrl() helper name
// // ✅ Supports both entry_type and txn_type history rows safely

// import { Ionicons } from "@expo/vector-icons";
// import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
// import React, { useCallback, useMemo, useState } from "react";
// import {
//   Alert,
//   Linking,
//   RefreshControl,
//   ScrollView,
//   StyleSheet,
//   Text,
//   View,
// } from "react-native";

// import Button from "@/components/ui/Button";
// import Card from "@/components/ui/Card";
// import EmptyState from "@/components/ui/EmptyState";
// import Section from "@/components/ui/Section";

// import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
// import { getErrorMessage } from "@/services/api";
// import {
//   getSavingsHistoryRows,
//   SavingsHistoryRow,
//   savingsStatementPdfUrl,
// } from "@/services/savings";

// function formatKes(value?: string | number) {
//   const n = Number(value ?? 0);
//   if (Number.isNaN(n)) return "KES 0.00";
//   return `KES ${n.toLocaleString("en-KE", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// }

// function fmtDate(s?: string) {
//   if (!s) return "—";
//   return String(s).replace("T", " ").slice(0, 16);
// }

// function getDisplayEntryType(row: SavingsHistoryRow): "CREDIT" | "DEBIT" {
//   const entryType = String(row.entry_type || "").toUpperCase();
//   const txnType = String(row.txn_type || "").toUpperCase();

//   if (entryType === "CREDIT" || entryType === "DEBIT") {
//     return entryType as "CREDIT" | "DEBIT";
//   }

//   if (txnType === "DEPOSIT") return "CREDIT";
//   return "DEBIT";
// }

// function getDisplayNarration(row: SavingsHistoryRow) {
//   return row.narration || row.note || "";
// }

// function EntryPill({ t }: { t: "CREDIT" | "DEBIT" }) {
//   const isCredit = t === "CREDIT";

//   return (
//     <View
//       style={[
//         styles.pill,
//         {
//           backgroundColor: isCredit
//             ? "rgba(46,125,50,0.12)"
//             : "rgba(220,38,38,0.12)",
//         },
//       ]}
//     >
//       <Text
//         style={[
//           styles.pillText,
//           { color: isCredit ? COLORS.success : COLORS.danger },
//         ]}
//       >
//         {t}
//       </Text>
//     </View>
//   );
// }

// export default function SavingsAccountHistoryScreen() {
//   const { id } = useLocalSearchParams();
//   const accountId = Number(id);

//   const [rows, setRows] = useState<SavingsHistoryRow[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);

//   const load = useCallback(async () => {
//     if (!accountId || Number.isNaN(accountId)) {
//       Alert.alert("Savings", "Invalid account id.");
//       return;
//     }

//     try {
//       setLoading(true);
//       const data = await getSavingsHistoryRows(accountId);
//       setRows(Array.isArray(data) ? data : []);
//     } catch (e: any) {
//       Alert.alert("Savings", getErrorMessage(e));
//     } finally {
//       setLoading(false);
//     }
//   }, [accountId]);

//   useFocusEffect(
//     useCallback(() => {
//       load();
//     }, [load])
//   );

//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);
//     await load();
//     setRefreshing(false);
//   }, [load]);

//   const totals = useMemo(() => {
//     const credit = rows.reduce((acc, r) => {
//       return acc + (getDisplayEntryType(r) === "CREDIT" ? Number(r.amount || 0) : 0);
//     }, 0);

//     const debit = rows.reduce((acc, r) => {
//       return acc + (getDisplayEntryType(r) === "DEBIT" ? Number(r.amount || 0) : 0);
//     }, 0);

//     return { credit, debit };
//   }, [rows]);

//   const openStatement = useCallback(async () => {
//     try {
//       const url = savingsStatementPdfUrl(accountId);
//       const ok = await Linking.canOpenURL(url);
//       if (!ok) {
//         Alert.alert("Statement", "Cannot open statement URL on this device.");
//         return;
//       }
//       await Linking.openURL(url);
//     } catch {
//       Alert.alert("Statement", "Failed to open statement.");
//     }
//   }, [accountId]);

//   return (
//     <ScrollView
//       style={styles.container}
//       contentContainerStyle={styles.content}
//       refreshControl={
//         <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//       }
//       showsVerticalScrollIndicator={false}
//     >
//       {/* Header */}
//       <View style={styles.header}>
//         <View style={{ flex: 1 }}>
//           <Text style={styles.hTitle}>Savings History</Text>
//           <Text style={styles.hSub}>Account #{accountId}</Text>
//         </View>

//         <Button
//           variant="ghost"
//           title="Back"
//           onPress={() => router.back()}
//           leftIcon={
//             <Ionicons
//               name="chevron-back"
//               size={16}
//               color={COLORS.primary}
//             />
//           }
//         />
//       </View>

//       {/* Summary */}
//       <View style={styles.summaryGrid}>
//         <View style={[styles.summaryCard, SHADOW.card]}>
//           <Text style={styles.summaryLabel}>Total Credits</Text>
//           <Text style={styles.summaryValue}>{formatKes(totals.credit)}</Text>
//         </View>

//         <View style={[styles.summaryCard, SHADOW.card]}>
//           <Text style={styles.summaryLabel}>Total Debits</Text>
//           <Text style={styles.summaryValue}>{formatKes(totals.debit)}</Text>
//         </View>
//       </View>

//       {/* Actions */}
//       <View style={styles.actionBar}>
//         <Button
//           title="Deposit"
//           onPress={() => router.push("/(tabs)/payments/deposit" as any)}
//           style={{ flex: 1 }}
//           leftIcon={
//             <Ionicons
//               name="arrow-down-circle-outline"
//               size={18}
//               color={COLORS.white}
//             />
//           }
//         />
//         <View style={{ width: SPACING.sm }} />
//         <Button
//           title="Statement PDF"
//           variant="secondary"
//           onPress={openStatement}
//           style={{ flex: 1 }}
//           leftIcon={
//             <Ionicons
//               name="document-text-outline"
//               size={18}
//               color={COLORS.primary}
//             />
//           }
//         />
//       </View>

//       <Section title="Transactions">
//         {loading ? (
//           <Text style={styles.muted}>Loading…</Text>
//         ) : rows.length === 0 ? (
//           <EmptyState
//             icon="time-outline"
//             title="No history yet"
//             subtitle="Your deposits and withdrawals will appear here after confirmation."
//           />
//         ) : (
//           rows.slice(0, 300).map((r) => {
//             const displayType = getDisplayEntryType(r);
//             const narration = getDisplayNarration(r);

//             return (
//               <Card key={r.id} style={styles.rowCard}>
//                 <View style={styles.rowTop}>
//                   <EntryPill t={displayType} />
//                   <Text style={styles.amount}>{formatKes(r.amount)}</Text>
//                 </View>

//                 <Text style={styles.meta}>
//                   {fmtDate(r.created_at)}
//                   {r.reference ? ` • Ref: ${r.reference}` : ""}
//                   {r.txn_type ? ` • ${String(r.txn_type).toUpperCase()}` : ""}
//                 </Text>

//                 {narration ? (
//                   <Text style={styles.narration}>{narration}</Text>
//                 ) : null}
//               </Card>
//             );
//           })
//         )}
//       </Section>

//       <View style={{ height: 24 }} />
//     </ScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: COLORS.background },
//   content: { padding: SPACING.lg, paddingBottom: 24 },

//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     gap: SPACING.md,
//     marginBottom: SPACING.md,
//   },

//   hTitle: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.dark },
//   hSub: {
//     marginTop: 6,
//     fontFamily: FONT.regular,
//     fontSize: 12,
//     color: COLORS.gray,
//   },

//   summaryGrid: { flexDirection: "row", gap: SPACING.sm as any },
//   summaryCard: {
//     flex: 1,
//     backgroundColor: COLORS.white,
//     borderRadius: RADIUS.lg,
//     borderWidth: 1,
//     borderColor: COLORS.border,
//     padding: SPACING.md,
//   },
//   summaryLabel: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
//   summaryValue: {
//     marginTop: 8,
//     fontFamily: FONT.bold,
//     fontSize: 16,
//     color: COLORS.dark,
//   },

//   actionBar: { flexDirection: "row", marginTop: SPACING.md, alignItems: "center" },

//   muted: { marginTop: 6, fontFamily: FONT.regular, color: COLORS.gray },

//   rowCard: { marginBottom: SPACING.md, padding: SPACING.md, ...SHADOW.card },
//   rowTop: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//   },

//   amount: { fontFamily: FONT.bold, fontSize: 14, color: COLORS.dark },

//   meta: {
//     marginTop: 10,
//     fontFamily: FONT.regular,
//     fontSize: 12,
//     color: COLORS.gray,
//   },
//   narration: {
//     marginTop: 6,
//     fontFamily: FONT.regular,
//     fontSize: 12,
//     color: COLORS.textMuted,
//     lineHeight: 18,
//   },

//   pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
//   pillText: { fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.3 },
// });