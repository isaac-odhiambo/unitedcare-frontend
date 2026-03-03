import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/* =========================
   Types (DRF friendly)
========================= */
type LoanStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DEFAULTED"
  | "COMPLETED"
  | string;

type Loan = {
  id: number;
  borrower: number;
  merry: number | null;
  group: number | null;
  product: number;

  principal: string;
  term_weeks: number;

  status: LoanStatus;

  created_at?: string;
  approved_at?: string | null;

  total_payable?: string;
  total_paid?: string;
  outstanding_balance?: string;

  security_target?: string;

  borrower_reserved_savings?: string;
  borrower_reserved_merry_credit?: string;
};

type PayLoanResponse = {
  message: string;
  loan_status: LoanStatus;
  total_paid: string;
  outstanding_balance: string;
};

/* =========================
   API
========================= */
async function getLoanDetail(id: number): Promise<Loan> {
  const res = await api.get(`/loans/loan/${id}/`);
  return res.data;
}

async function approveLoan(
  loanId: number
): Promise<{ message: string; loan: Loan }> {
  const res = await api.patch(`/loans/loan/${loanId}/approve/`);
  return res.data;
}

async function payLoan(
  loanId: number,
  payload: { amount: string; method?: string; reference?: string }
): Promise<PayLoanResponse> {
  const res = await api.post(`/loans/loan/${loanId}/pay/`, payload);
  return res.data;
}

async function getIsAdminFromStorage(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync("is_admin");
  return raw === "true";
}

/* =========================
   Helpers
========================= */
function money(v?: string | number | null) {
  const n =
    typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  if (!Number.isFinite(n)) return "KES 0";
  const parts = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `KES ${parts}`;
}

function statusColor(s: LoanStatus) {
  if (s === "APPROVED") return COLORS.success;
  if (s === "COMPLETED") return COLORS.primary;
  if (s === "DEFAULTED") return COLORS.danger;
  if (s === "UNDER_REVIEW") return COLORS.accent;
  return COLORS.gray;
}

function digitsAndDot(v: string) {
  // allow decimal input
  return v.replace(/[^\d.]/g, "");
}

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const loanId = useMemo(() => Number(id), [id]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loan, setLoan] = useState<Loan | null>(null);

  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(loanId) || loanId <= 0) {
      Alert.alert("Invalid Loan", "Loan id is missing/invalid.");
      router.back();
      return;
    }

    try {
      setLoading(true);
      const [adminFlag, data] = await Promise.all([
        getIsAdminFromStorage(),
        getLoanDetail(loanId),
      ]);
      setIsAdmin(adminFlag);
      setLoan(data);
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    if (!loanId) return;
    try {
      setRefreshing(true);
      const data = await getLoanDetail(loanId);
      setLoan(data);
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [loanId]);

  const outstanding = useMemo(() => {
    const n = Number(loan?.outstanding_balance || "0");
    return Number.isFinite(n) ? n : 0;
  }, [loan?.outstanding_balance]);

  const canPay =
    loan &&
    (loan.status === "APPROVED" || loan.status === "DEFAULTED") &&
    outstanding > 0;

  const canApprove =
    loan &&
    isAdmin &&
    (loan.status === "PENDING" || loan.status === "UNDER_REVIEW");

  const canAddGuarantor =
    loan && (loan.status === "PENDING" || loan.status === "UNDER_REVIEW");

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.centerText}>Loading loan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!loan) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={26} color={COLORS.gray} />
          <Text style={styles.centerText}>Loan not found.</Text>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={styles.ghostText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.dark} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Loan #{loan.id}</Text>
            <Text style={styles.h2}>
              {loan.merry
                ? `Merry (${loan.merry})`
                : loan.group
                ? `Group (${loan.group})`
                : "No context"}
              {"  "}•{"  "}
              Term: {loan.term_weeks} weeks
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: statusColor(loan.status) }]}>
            <Text style={styles.badgeText}>{loan.status}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Summary */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Summary</Text>

            <Metric label="Principal" value={money(loan.principal)} />
            <Metric label="Total Payable" value={money(loan.total_payable)} />
            <Metric label="Total Paid" value={money(loan.total_paid)} />
            <Metric label="Outstanding" value={money(loan.outstanding_balance)} />

            {loan.security_target ? (
              <View style={styles.dividerRow}>
                <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
                <Text style={styles.dividerText}>
                  Security Target: <Text style={{ fontWeight: "900" }}>{money(loan.security_target)}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* Security breakdown (optional if backend returns these fields) */}
          {(loan.borrower_reserved_savings || loan.borrower_reserved_merry_credit) ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Security Breakdown</Text>
              <Metric
                label="Borrower reserved savings"
                value={money(loan.borrower_reserved_savings)}
              />
              <Metric
                label="Borrower reserved merry credit"
                value={money(loan.borrower_reserved_merry_credit)}
              />
              <Text style={styles.note}>
                Reserves are handled by the backend at approval and released after completion.
              </Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Actions</Text>

            <View style={styles.actionsRow}>
              {canPay ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: COLORS.success }]}
                  onPress={() => setPayOpen(true)}
                >
                  <Ionicons name="cash-outline" size={18} color={COLORS.success} />
                  <Text style={styles.actionText}>Pay</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.actionBtn, { opacity: 0.5 }]}>
                  <Ionicons name="cash-outline" size={18} color={COLORS.gray} />
                  <Text style={styles.actionText}>Pay</Text>
                </View>
              )}

              {canAddGuarantor ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: COLORS.accent }]}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/loans/add-guarantor",
                      params: { loanId: String(loan.id) },
                    })
                  }
                >
                  <Ionicons name="person-add-outline" size={18} color={COLORS.accent} />
                  <Text style={styles.actionText}>Add Guarantor</Text>
                </TouchableOpacity>
              ) : null}

              {canApprove ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: COLORS.primary }]}
                  onPress={() => {
                    Alert.alert(
                      "Approve loan?",
                      `Approve Loan #${loan.id} and generate schedule?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Approve",
                          onPress: async () => {
                            try {
                              const res = await approveLoan(loan.id);
                              Alert.alert("Success", res.message || "Loan approved.");
                              setLoan(res.loan);
                            } catch (e: any) {
                              Alert.alert("Approval failed", getErrorMessage(e));
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.actionText}>Approve</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {!canApprove && isAdmin ? (
              <Text style={styles.note}>
                Approval is available only when the loan is PENDING or UNDER_REVIEW.
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <PayLoanModal
          visible={payOpen}
          loan={loan}
          onClose={() => setPayOpen(false)}
          onSuccess={async () => {
            setPayOpen(false);
            await onRefresh();
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

/* =========================
   Pay Modal
========================= */
function PayLoanModal({
  visible,
  loan,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  loan: Loan;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("MANUAL");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setAmount("");
      setMethod("MANUAL");
      setReference("");
      setSaving(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!amount.trim()) {
      Alert.alert("Missing amount", "Enter payment amount.");
      return;
    }

    try {
      setSaving(true);
      const res = await payLoan(loan.id, {
        amount: amount.trim(),
        method: method.trim() || "MANUAL",
        reference: reference.trim() || undefined,
      });

      Alert.alert(
        "Success",
        `${res.message}\nStatus: ${res.loan_status}\nOutstanding: ${money(res.outstanding_balance)}`
      );
      await onSuccess();
    } catch (e: any) {
      Alert.alert("Payment failed", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pay Loan</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalHint}>
            Loan #{loan.id} • Outstanding: {money(loan.outstanding_balance)}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Amount (e.g. 1000)"
            value={amount}
            onChangeText={(t) => setAmount(digitsAndDot(t))}
            keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
          />

          <TextInput
            style={styles.input}
            placeholder="Method (MANUAL / MPESA)"
            value={method}
            onChangeText={setMethod}
          />

          <TextInput
            style={styles.input}
            placeholder="Reference (optional)"
            value={reference}
            onChangeText={setReference}
          />

          <TouchableOpacity style={styles.modalPrimaryBtn} onPress={submit} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.modalPrimaryText}>Apply Payment</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalGhostBtn} onPress={onClose}>
            <Text style={styles.modalGhostText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* =========================
   Styles
========================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },

  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { fontSize: FONT.section, fontWeight: "800", color: COLORS.dark },
  h2: { marginTop: 2, fontSize: FONT.subtitle, color: COLORS.gray },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginBottom: 2 },
  badgeText: { color: COLORS.white, fontWeight: "900", fontSize: 11 },

  container: { flex: 1, padding: SPACING.md },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  centerText: { color: COLORS.gray },

  card: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardTitle: { fontSize: FONT.body, fontWeight: "900", color: COLORS.dark, marginBottom: 10 },

  metricRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  metricLabel: { color: COLORS.gray, fontWeight: "700" },
  metricValue: { color: COLORS.dark, fontWeight: "900" },

  dividerRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    padding: 10,
    borderRadius: RADIUS.lg,
  },
  dividerText: { color: COLORS.dark },

  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: "#F9FAFB",
  },
  actionText: { color: COLORS.dark, fontWeight: "900" },

  note: { marginTop: 10, color: COLORS.gray, lineHeight: 18 },

  ghostBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  ghostText: { color: COLORS.gray, fontWeight: "900" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: FONT.section, fontWeight: "900", color: COLORS.dark },
  modalHint: { marginTop: 8, marginBottom: 10, color: COLORS.gray, fontSize: 12 },

  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.dark,
    backgroundColor: "#F9FAFB",
    marginTop: 10,
  },

  modalPrimaryBtn: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    alignItems: "center",
  },
  modalPrimaryText: { color: COLORS.white, fontWeight: "900", fontSize: 14 },

  modalGhostBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  modalGhostText: { color: COLORS.gray, fontWeight: "900", fontSize: 13 },
});