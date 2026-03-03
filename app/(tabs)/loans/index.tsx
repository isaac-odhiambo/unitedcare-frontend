// app/(tabs)/loans/index.tsx
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/* =========================================================
   Types (DRF friendly)
========================================================= */

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

  total_payable?: string;
  total_paid?: string;
  outstanding_balance?: string;

  security_target?: string;

  // optional extras if your detail serializer returns them:
  created_at?: string;
  approved_at?: string | null;
};

type LoanGuarantor = {
  id: number;
  loan: number;
  guarantor: number;
  accepted: boolean;
  accepted_at?: string | null;
  reserved_amount?: string;
};

type PayLoanResponse = {
  message: string;
  loan_status: LoanStatus;
  total_paid: string;
  outstanding_balance: string;
};

type LoanDetailResponse = Loan; // if detail endpoint returns more fields, extend here

/* =========================================================
   API (matches your Django urls)
========================================================= */

async function getMyLoans(): Promise<Loan[]> {
  const res = await api.get("/loans/myloans/");
  return res.data;
}

async function getLoanDetail(pk: number): Promise<LoanDetailResponse> {
  const res = await api.get(`/loans/loan/${pk}/`);
  return res.data;
}

async function requestLoan(payload: {
  merry?: number;
  group?: number;
  product: number;
  principal: string;
  term_weeks: number;
}): Promise<{ message: string; loan: Loan }> {
  const res = await api.post("/loans/request/", payload);
  return res.data;
}

async function addGuarantor(payload: {
  loan: number;
  guarantor: number;
}): Promise<{ message: string; guarantor: LoanGuarantor }> {
  const res = await api.post("/loans/loan/add-guarantor/", payload);
  return res.data;
}

async function getMyGuaranteeRequests(): Promise<LoanGuarantor[]> {
  const res = await api.get("/loans/guarantee/my-requests/");
  return res.data;
}

async function acceptGuarantee(id: number): Promise<{ message: string }> {
  const res = await api.patch(`/loans/guarantee/${id}/accept/`);
  return res.data;
}

async function rejectGuarantee(id: number): Promise<{ message: string }> {
  const res = await api.patch(`/loans/guarantee/${id}/reject/`);
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

/* =========================================================
   Helpers
========================================================= */

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

async function getIsAdminFromStorage(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync("is_admin");
  return raw === "true";
}

/* =========================================================
   Screen
========================================================= */

type TabKey = "loans" | "guarantees";

export default function LoansIndexScreen() {
  const [tab, setTab] = useState<TabKey>("loans");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [guarantees, setGuarantees] = useState<LoanGuarantor[]>([]);

  const [requestOpen, setRequestOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [guarantorOpen, setGuarantorOpen] = useState(false);

  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [adminFlag, myLoans, myGuarantees] = await Promise.all([
        getIsAdminFromStorage(),
        getMyLoans(),
        getMyGuaranteeRequests(),
      ]);
      setIsAdmin(adminFlag);
      setLoans(Array.isArray(myLoans) ? myLoans : []);
      setGuarantees(Array.isArray(myGuarantees) ? myGuarantees : []);
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const [myLoans, myGuarantees] = await Promise.all([
        getMyLoans(),
        getMyGuaranteeRequests(),
      ]);
      setLoans(Array.isArray(myLoans) ? myLoans : []);
      setGuarantees(Array.isArray(myGuarantees) ? myGuarantees : []);
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const headerRight = useMemo(() => {
    if (tab !== "loans") return null;
    return (
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => setRequestOpen(true)}
      >
        <Ionicons name="add" size={18} color={COLORS.white} />
        <Text style={styles.primaryBtnText}>Request</Text>
      </TouchableOpacity>
    );
  }, [tab]);

  const emptyText = useMemo(() => {
    return tab === "guarantees"
      ? "No guarantee requests yet."
      : "No loans yet. Tap Request to start.";
  }, [tab]);

  const showLoanDetails = useCallback(async (loanId: number) => {
    try {
      const detail = await getLoanDetail(loanId);
      Alert.alert(
        `Loan #${detail.id}`,
        [
          `Status: ${detail.status}`,
          `Principal: ${money(detail.principal)}`,
          `Total Payable: ${money(detail.total_payable)}`,
          `Total Paid: ${money(detail.total_paid)}`,
          `Outstanding: ${money(detail.outstanding_balance)}`,
          detail.security_target ? `Security Target: ${money(detail.security_target)}` : null,
          detail.merry ? `Merry ID: ${detail.merry}` : null,
          detail.group ? `Group ID: ${detail.group}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
    }
  }, []);

  const renderLoan = ({ item }: { item: Loan }) => {
    const outstanding = Number(item.outstanding_balance || "0") || 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Loan #{item.id}</Text>
            <Text style={styles.cardSub}>
              Context:{" "}
              {item.merry
                ? `Merry (${item.merry})`
                : item.group
                ? `Group (${item.group})`
                : "—"}
            </Text>
          </View>

          <View
            style={[
              styles.badge,
              { backgroundColor: statusColor(item.status) },
            ]}
          >
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Principal</Text>
            <Text style={styles.metricValue}>{money(item.principal)}</Text>
          </View>

          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Outstanding</Text>
            <Text style={styles.metricValue}>
              {money(item.outstanding_balance)}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Term</Text>
            <Text style={styles.metricValue}>{item.term_weeks} weeks</Text>
          </View>

          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Total Payable</Text>
            <Text style={styles.metricValue}>{money(item.total_payable)}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {/* ✅ Uses /loans/loan/<pk>/ */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => showLoanDetails(item.id)}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.actionText}>View</Text>
          </TouchableOpacity>

          {(item.status === "APPROVED" || item.status === "DEFAULTED") &&
          outstanding > 0 ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                setSelectedLoan(item);
                setPayOpen(true);
              }}
            >
              <Ionicons name="cash-outline" size={18} color={COLORS.success} />
              <Text style={styles.actionText}>Pay</Text>
            </TouchableOpacity>
          ) : null}

          {(item.status === "PENDING" || item.status === "UNDER_REVIEW") ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                setSelectedLoan(item);
                setGuarantorOpen(true);
              }}
            >
              <Ionicons
                name="person-add-outline"
                size={18}
                color={COLORS.accent}
              />
              <Text style={styles.actionText}>Guarantor</Text>
            </TouchableOpacity>
          ) : null}

          {isAdmin &&
          (item.status === "PENDING" || item.status === "UNDER_REVIEW") ? (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: COLORS.primary }]}
              onPress={() => {
                Alert.alert(
                  "Approve loan?",
                  `Approve Loan #${item.id} and generate schedule?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Approve",
                      onPress: async () => {
                        try {
                          const res = await approveLoan(item.id);
                          Alert.alert("Success", res.message || "Loan approved.");
                          await onRefresh();
                        } catch (e: any) {
                          Alert.alert("Approval failed", getErrorMessage(e));
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.actionText}>Approve</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const renderGuarantee = ({ item }: { item: LoanGuarantor }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Guarantee Request</Text>
            <Text style={styles.cardSub}>Request #{item.id}</Text>
            <Text style={styles.cardSub}>Loan ID: {item.loan}</Text>
          </View>

          <View
            style={[
              styles.badge,
              { backgroundColor: item.accepted ? COLORS.success : COLORS.accent },
            ]}
          >
            <Text style={styles.badgeText}>
              {item.accepted ? "ACCEPTED" : "PENDING"}
            </Text>
          </View>
        </View>

        {!item.accepted ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  const res = await acceptGuarantee(item.id);
                  Alert.alert("Success", res.message || "Accepted.");
                  await onRefresh();
                } catch (e: any) {
                  Alert.alert("Error", getErrorMessage(e));
                }
              }}
            >
              <Ionicons
                name="thumbs-up-outline"
                size={18}
                color={COLORS.success}
              />
              <Text style={styles.actionText}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  const res = await rejectGuarantee(item.id);
                  Alert.alert("Done", res.message || "Rejected.");
                  await onRefresh();
                } catch (e: any) {
                  Alert.alert("Error", getErrorMessage(e));
                }
              }}
            >
              <Ionicons
                name="close-circle-outline"
                size={18}
                color={COLORS.danger}
              />
              <Text style={styles.actionText}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.note}>
            Accepted. Your savings reserve will be applied automatically when the
            admin approves the loan.
          </Text>
        )}
      </View>
    );
  };

  const data = tab === "loans" ? loans : guarantees;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Loans</Text>
          <Text style={styles.h2}>Request, track, pay, and guarantee loans</Text>
        </View>
        {headerRight}
      </View>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab("loans")}
          style={[styles.tabBtn, tab === "loans" && styles.tabBtnActive]}
        >
          <Ionicons
            name="wallet-outline"
            size={18}
            color={tab === "loans" ? COLORS.white : COLORS.gray}
          />
          <Text
            style={[styles.tabText, tab === "loans" && styles.tabTextActive]}
          >
            My Loans
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setTab("guarantees")}
          style={[styles.tabBtn, tab === "guarantees" && styles.tabBtnActive]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={tab === "guarantees" ? COLORS.white : COLORS.gray}
          />
          <Text
            style={[
              styles.tabText,
              tab === "guarantees" && styles.tabTextActive,
            ]}
          >
            Guarantees
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.centerText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }}
          data={data}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={
            tab === "loans"
              ? (renderLoan as any)
              : (renderGuarantee as any)
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="file-tray-outline"
                size={26}
                color={COLORS.gray}
              />
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          }
        />
      )}

      {/* Modals */}
      <RequestLoanModal
        visible={requestOpen}
        onClose={() => setRequestOpen(false)}
        onSuccess={async () => {
          setRequestOpen(false);
          await onRefresh();
        }}
      />

      <PayLoanModal
        visible={payOpen}
        loan={selectedLoan}
        onClose={() => setPayOpen(false)}
        onSuccess={async () => {
          setPayOpen(false);
          await onRefresh();
        }}
      />

      <AddGuarantorModal
        visible={guarantorOpen}
        loan={selectedLoan}
        onClose={() => setGuarantorOpen(false)}
        onSuccess={async () => {
          setGuarantorOpen(false);
          await onRefresh();
        }}
      />
    </SafeAreaView>
  );
}

/* =========================================================
   Modals
========================================================= */

function RequestLoanModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}) {
  const [merry, setMerry] = useState("");
  const [group, setGroup] = useState("");
  const [product, setProduct] = useState("");
  const [principal, setPrincipal] = useState("");
  const [termWeeks, setTermWeeks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setMerry("");
      setGroup("");
      setProduct("");
      setPrincipal("");
      setTermWeeks("");
      setSaving(false);
    }
  }, [visible]);

  const submit = async () => {
    const hasMerry = !!merry.trim();
    const hasGroup = !!group.trim();

    if (hasMerry === hasGroup) {
      Alert.alert(
        "Invalid context",
        "Provide either Merry ID or Group ID (not both)."
      );
      return;
    }

    if (!product.trim() || !principal.trim() || !termWeeks.trim()) {
      Alert.alert(
        "Missing fields",
        "Product, Principal and Term weeks are required."
      );
      return;
    }

    const payload: any = {
      product: Number(product),
      principal: principal.trim(),
      term_weeks: Number(termWeeks),
    };
    if (hasMerry) payload.merry = Number(merry);
    if (hasGroup) payload.group = Number(group);

    try {
      setSaving(true);
      const res = await requestLoan(payload);
      Alert.alert("Success", res.message || "Loan request submitted.");
      await onSuccess();
    } catch (e: any) {
      Alert.alert("Request failed", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Loan</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalHint}>
            Provide exactly one context: Merry OR Group.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Merry ID (optional)"
            value={merry}
            onChangeText={(t) => {
              setMerry(t);
              if (t.trim()) setGroup("");
            }}
            keyboardType="number-pad"
          />

          <TextInput
            style={styles.input}
            placeholder="Group ID (optional)"
            value={group}
            onChangeText={(t) => {
              setGroup(t);
              if (t.trim()) setMerry("");
            }}
            keyboardType="number-pad"
          />

          <TextInput
            style={styles.input}
            placeholder="Loan Product ID"
            value={product}
            onChangeText={setProduct}
            keyboardType="number-pad"
          />

          <TextInput
            style={styles.input}
            placeholder="Principal amount (e.g. 25000)"
            value={principal}
            onChangeText={setPrincipal}
            keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
          />

          <TextInput
            style={styles.input}
            placeholder="Term weeks (e.g. 12)"
            value={termWeeks}
            onChangeText={setTermWeeks}
            keyboardType="number-pad"
          />

          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            onPress={submit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.modalPrimaryText}>Submit Request</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalGhostBtn} onPress={onClose}>
            <Text style={styles.modalGhostText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PayLoanModal({
  visible,
  loan,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  loan: Loan | null;
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
    if (!loan) return;

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
        `${res.message}\nStatus: ${res.loan_status}\nOutstanding: ${money(
          res.outstanding_balance
        )}`
      );
      await onSuccess();
    } catch (e: any) {
      Alert.alert("Payment failed", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pay Loan</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalHint}>
            Loan #{loan?.id} • Outstanding: {money(loan?.outstanding_balance)}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Amount (e.g. 1000)"
            value={amount}
            onChangeText={setAmount}
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

          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            onPress={submit}
            disabled={saving}
          >
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

function AddGuarantorModal({
  visible,
  loan,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  loan: Loan | null;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}) {
  const [guarantorId, setGuarantorId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setGuarantorId("");
      setSaving(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!loan) return;

    if (!guarantorId.trim()) {
      Alert.alert("Missing guarantor", "Enter guarantor user ID.");
      return;
    }

    try {
      setSaving(true);
      const res = await addGuarantor({
        loan: loan.id,
        guarantor: Number(guarantorId),
      });
      Alert.alert("Success", res.message || "Guarantor added.");
      await onSuccess();
    } catch (e: any) {
      Alert.alert("Failed", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Guarantor</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalHint}>
            Loan #{loan?.id} • Status: {loan?.status}. Add guarantor by their User
            ID.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Guarantor User ID"
            value={guarantorId}
            onChangeText={setGuarantorId}
            keyboardType="number-pad"
          />

          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            onPress={submit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.modalPrimaryText}>Send Request</Text>
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

/* =========================================================
   Styles (ONLY uses your theme.ts keys)
========================================================= */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },

  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: SPACING.md,
  },
  h1: { fontSize: FONT.title, fontWeight: "700", color: COLORS.dark },
  h2: { marginTop: 4, fontSize: FONT.subtitle, color: COLORS.gray },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },

  tabs: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  tabBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  tabBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontWeight: "700", color: COLORS.gray, fontSize: 13 },
  tabTextActive: { color: COLORS.white },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  centerText: { color: COLORS.gray },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    gap: 10,
  },
  emptyText: { color: COLORS.gray },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    marginBottom: SPACING.md,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  cardTitle: { fontSize: FONT.section, fontWeight: "700", color: COLORS.dark },
  cardSub: { marginTop: 2, fontSize: 12, color: COLORS.gray },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: COLORS.white, fontWeight: "700", fontSize: 11 },

  row: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.md },
  metric: { flex: 1 },
  metricLabel: { color: COLORS.gray, fontSize: 12 },
  metricValue: {
    marginTop: 4,
    color: COLORS.dark,
    fontWeight: "700",
    fontSize: 14,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
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
  actionText: { color: COLORS.dark, fontWeight: "700", fontSize: 12 },

  note: { marginTop: 10, color: COLORS.gray, fontSize: 12 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: FONT.section, fontWeight: "700", color: COLORS.dark },
  modalHint: {
    marginTop: 8,
    marginBottom: 10,
    color: COLORS.gray,
    fontSize: 12,
  },

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
  modalPrimaryText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },

  modalGhostBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    alignItems: "center",
  },
  modalGhostText: { color: COLORS.gray, fontWeight: "700", fontSize: 13 },
});