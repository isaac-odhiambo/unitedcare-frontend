// app/(tabs)/payments/deposit.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import {
  COLORS,
  FONT,
  P,
  RADIUS,
  SPACING,
  TYPE,
} from "@/constants/theme";
import {
  displayKenyaPhone,
  findLatestMatchingMyMpesaTransaction,
  getActiveMpesaConfig,
  getApiErrorMessage,
  getMpesaPaybillNumber,
  isFailedTxStatus,
  isPaybillEnabled,
  isPendingTxStatus,
  isSuccessfulTxStatus,
  money,
  MpesaConfig,
  MpesaPurpose,
  mpesaStkPush,
  MpesaTransaction,
  normalizeKenyaPhone,
  pollForMatchingManualPaybill,
  pollMyMpesaTransactionById,
} from "@/services/payments";
import { getMe, isAdminUser, MeResponse } from "@/services/profile";
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type DepositUser = Partial<MeResponse> & Partial<SessionUser>;
type DepositMethod = "STK" | "PAYBILL";

type DepositParams = {
  purpose?: string;
  reference?: string;
  narration?: string;
  amount?: string;
  phone?: string;
  title?: string;
  subtitle?: string;
  returnTo?: string;
  groupId?: string;
  method?: string;
  initialMethod?: string;
  initial_method?: string;
};

const TERMINAL_ALLOCATION_STATUSES = new Set([
  "AUTO_ALLOCATED",
  "MANUALLY_ALLOCATED",
  "PARTIALLY_ALLOCATED",
  "MANUAL_REVIEW",
  "INVALID_REFERENCE",
]);

function normalizeDisplayPhone(value: string) {
  const v = String(value || "").trim().replace(/\s+/g, "");
  if (v.startsWith("+254")) return `0${v.slice(4)}`;
  if (v.startsWith("254")) return `0${v.slice(3)}`;
  return v;
}

function isValidKenyanPhone(phone: string) {
  return /^(07|01)\d{8}$/.test(phone);
}

function isPositiveAmount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function sanitizeAmount(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function getUserId(user?: DepositUser | null) {
  const raw =
    (user as any)?.id ??
    (user as any)?.user_id ??
    (user as any)?.pk ??
    null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getDefaultSavingsReference(user?: DepositUser | null) {
  const userId = getUserId(user);
  if (userId) return `saving${userId}`;
  return "";
}

function normalizePurpose(value?: string): MpesaPurpose {
  const raw = String(value || "").trim().toUpperCase();

  if (
    raw === "SAVINGS_DEPOSIT" ||
    raw === "MERRY_CONTRIBUTION" ||
    raw === "GROUP_CONTRIBUTION" ||
    raw === "LOAN_REPAYMENT" ||
    raw === "OTHER"
  ) {
    return raw;
  }

  return "SAVINGS_DEPOSIT";
}

function normalizeMethod(value?: string): DepositMethod {
  const raw = String(value || "").trim().toUpperCase();
  return raw === "PAYBILL" ? "PAYBILL" : "STK";
}

function buildFallbackReference(
  purpose: MpesaPurpose,
  user?: DepositUser | null,
  groupId?: string | number
) {
  const userId = getUserId(user);
  const parsedGroupId = Number(groupId);

  switch (purpose) {
    case "SAVINGS_DEPOSIT":
      return getDefaultSavingsReference(user);
    case "MERRY_CONTRIBUTION":
      return userId ? `mus${userId}` : "";
    case "GROUP_CONTRIBUTION":
      return Number.isFinite(parsedGroupId) && parsedGroupId > 0
        ? `grp${parsedGroupId}`
        : "";
    case "LOAN_REPAYMENT":
      return userId ? `loan${userId}` : "";
    default:
      return "";
  }
}

function buildFallbackNarration(purpose: MpesaPurpose) {
  switch (purpose) {
    case "SAVINGS_DEPOSIT":
      return "Savings deposit";
    case "MERRY_CONTRIBUTION":
      return "Merry contribution";
    case "GROUP_CONTRIBUTION":
      return "Group contribution";
    case "LOAN_REPAYMENT":
      return "Loan repayment";
    default:
      return "";
  }
}

function getPurposeLabel(purpose: MpesaPurpose) {
  switch (purpose) {
    case "MERRY_CONTRIBUTION":
      return "Merry Contribution";
    case "GROUP_CONTRIBUTION":
      return "Group Contribution";
    case "LOAN_REPAYMENT":
      return "Loan Repayment";
    case "SAVINGS_DEPOSIT":
      return "Savings Deposit";
    default:
      return "Payment";
  }
}

function normalizeAllocationStatus(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function hasTerminalAllocationStatus(tx?: Partial<MpesaTransaction> | null) {
  const allocationStatus = normalizeAllocationStatus(tx?.allocation_status);
  return TERMINAL_ALLOCATION_STATUSES.has(allocationStatus);
}

function shouldRedirectAsCompleted(tx?: Partial<MpesaTransaction> | null) {
  return isSuccessfulTxStatus(tx?.status) && hasTerminalAllocationStatus(tx);
}

function buildTerminalNote(tx?: Partial<MpesaTransaction> | null) {
  const allocationStatus = normalizeAllocationStatus(tx?.allocation_status);

  switch (allocationStatus) {
    case "AUTO_ALLOCATED":
      return "Payment confirmed and allocated successfully.";
    case "MANUALLY_ALLOCATED":
      return "Payment confirmed and allocated manually.";
    case "PARTIALLY_ALLOCATED":
      return "Payment confirmed and partially allocated.";
    case "MANUAL_REVIEW":
      return "Payment confirmed and queued for manual review.";
    case "INVALID_REFERENCE":
      return "Payment confirmed, but the reference needs review.";
    default:
      return "Payment confirmed successfully.";
  }
}

export default function DepositScreen() {
  const params = useLocalSearchParams<DepositParams>();

  const [user, setUser] = useState<DepositUser | null>(null);
  const [mpesaConfig, setMpesaConfig] = useState<MpesaConfig | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<DepositMethod>(
    normalizeMethod(params.initialMethod || params.initial_method || params.method)
  );

  const [result, setResult] = useState<MpesaTransaction | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [manualStarted, setManualStarted] = useState(false);

  const mountedRef = useRef(true);

  const isAdmin = isAdminUser(user);

  const purpose = useMemo(
    () => normalizePurpose(params.purpose),
    [params.purpose]
  );

  const displayTitle = useMemo(() => {
    if (params.title) return String(params.title);
    return getPurposeLabel(purpose);
  }, [params.title, purpose]);

  const displaySubtitle = useMemo(() => {
    if (params.subtitle) return String(params.subtitle);
    if (isAdmin) return "Admin view";
    return "Complete payment";
  }, [params.subtitle, isAdmin]);

  const displayPhone = useMemo(() => normalizeDisplayPhone(phone), [phone]);
  const stkPhone = useMemo(() => normalizeKenyaPhone(displayPhone), [displayPhone]);

  const phoneOk = useMemo(() => isValidKenyanPhone(displayPhone), [displayPhone]);
  const amountOk = useMemo(() => isPositiveAmount(amount), [amount]);

  const cleanAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "";
  }, [amount]);

  const accountReference = useMemo(() => {
    const explicitRef = String(params.reference || "").trim();
    if (explicitRef) return explicitRef;
    return buildFallbackReference(purpose, user, params.groupId);
  }, [params.reference, params.groupId, purpose, user]);

  const narration = useMemo(() => {
    const explicitNarration = String(params.narration || "").trim();
    if (explicitNarration) return explicitNarration;
    return buildFallbackNarration(purpose);
  }, [params.narration, purpose]);

  const paybillNumber = useMemo(
    () => getMpesaPaybillNumber(mpesaConfig),
    [mpesaConfig]
  );

  const paybillEnabled = useMemo(
    () => isPaybillEnabled(mpesaConfig),
    [mpesaConfig]
  );

  const canSubmit =
    method === "STK" && phoneOk && amountOk && !submitting && !checking;

  const canManualCheck =
    method === "PAYBILL" &&
    paybillEnabled &&
    phoneOk &&
    amountOk &&
    !submitting &&
    !checking &&
    !!accountReference;

  const goBackSuccess = useCallback(
    (tx: MpesaTransaction, note?: string) => {
      const returnTo = String(params.returnTo || ROUTES.tabs.payments);

      router.replace({
        pathname: returnTo as any,
        params: {
          deposited: "1",
          payment_success: "1",
          amount: cleanAmount,
          phone: displayPhone,
          purpose,
          reference: accountReference,
          groupId: params.groupId || "",
          notice: note || "Payment confirmed successfully.",
          tx_id: String(tx.id || ""),
          tx_status: String(tx.status || ""),
          checkout_request_id: tx.checkout_request_id || "",
          mpesa_receipt_number: tx.mpesa_receipt_number || "",
          allocation_status: tx.allocation_status || "",
        },
      });
    },
    [
      accountReference,
      cleanAmount,
      displayPhone,
      params.groupId,
      params.returnTo,
      purpose,
    ]
  );

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, configRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getActiveMpesaConfig(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: DepositUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      if (!mountedRef.current) return;

      setUser(mergedUser);

      if (mergedUser) {
        await saveSessionUser(mergedUser);
      }

      const defaultPhone = String(
        params.phone || meUser?.phone || sessionUser?.phone || ""
      );
      setPhone((prev) => (prev?.trim() ? prev : defaultPhone));

      const defaultAmount = String(params.amount || "").trim();
      if (defaultAmount) {
        setAmount((prev) => (prev?.trim() ? prev : defaultAmount));
      }

      if (configRes.status === "fulfilled") {
        setMpesaConfig(configRes.value);
      } else {
        setMpesaConfig(null);
      }

      if (meRes.status === "rejected") {
        setError(getApiErrorMessage(meRes.reason));
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(getApiErrorMessage(e));
    }
  }, [params.amount, params.phone]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;

      const run = async () => {
        try {
          setLoading(true);
          await load();
        } finally {
          if (mountedRef.current) {
            setLoading(false);
          }
        }
      };

      run();

      return () => {
        mountedRef.current = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [load]);

  const waitForAllocationFinalization = useCallback(
    async (initialTx: MpesaTransaction) => {
      if (!initialTx?.id) return initialTx;

      if (!isSuccessfulTxStatus(initialTx.status)) {
        return initialTx;
      }

      if (hasTerminalAllocationStatus(initialTx)) {
        return initialTx;
      }

      if (!mountedRef.current) return initialTx;

      setResult(initialTx);
      setStatusNote(
        "Payment received. Waiting for backend allocation and callback finalization..."
      );

      try {
        const finalizedTx = await pollMyMpesaTransactionById(initialTx.id, {
          intervalMs: 3000,
          timeoutMs: 60000,
          stopOnAllocated: true,
        });

        if (!mountedRef.current) return finalizedTx;
        setResult(finalizedTx);
        return finalizedTx;
      } catch {
        return initialTx;
      }
    },
    []
  );

  const finishSuccessfulPayment = useCallback(
    async (tx: MpesaTransaction) => {
      const finalTx = await waitForAllocationFinalization(tx);

      if (!mountedRef.current) return;

      setResult(finalTx);

      if (shouldRedirectAsCompleted(finalTx)) {
        const note = buildTerminalNote(finalTx);
        setStatusNote(note);
        goBackSuccess(finalTx, note);
        return;
      }

      if (isSuccessfulTxStatus(finalTx.status)) {
        setStatusNote(
          "Payment was received successfully, but allocation is still being finalized. Please use Check again shortly."
        );
        return;
      }

      if (isFailedTxStatus(finalTx.status)) {
        setStatusNote(finalTx.result_desc || "Payment was not completed.");
        return;
      }

      setStatusNote("Payment is still pending. Please wait or try again.");
    },
    [goBackSuccess, waitForAllocationFinalization]
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      setChecking(true);
      setError("");
      setResult(null);
      setStatusNote("Sending STK push...");

      const res = await mpesaStkPush({
        phone: displayPhone,
        amount: cleanAmount,
        purpose,
        reference: accountReference,
        narration,
      });

      if (!mountedRef.current) return;

      setResult(res.tx);
      setStatusNote(
        res.message || "STK sent. Check your phone and enter your M-Pesa PIN."
      );

      if (!res.tx?.id) {
        throw new Error("Transaction id was not returned by the backend.");
      }

      setStatusNote("Waiting for payment confirmation...");

      const txAfterCallback = await pollMyMpesaTransactionById(res.tx.id, {
        intervalMs: 3000,
        timeoutMs: 120000,
        stopOnAllocated: false,
      });

      if (!mountedRef.current) return;

      await finishSuccessfulPayment(txAfterCallback);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(getApiErrorMessage(e));
      setStatusNote("");
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
        setChecking(false);
      }
    }
  }, [
    accountReference,
    canSubmit,
    cleanAmount,
    displayPhone,
    finishSuccessfulPayment,
    narration,
    purpose,
    stkPhone,
  ]);

  const checkExistingManualPayment = useCallback(async () => {
    if (!canManualCheck) return;

    try {
      setChecking(true);
      setError("");
      setStatusNote("Checking payment from backend...");

      const existing = await findLatestMatchingMyMpesaTransaction({
        purpose,
        reference: accountReference,
        payment_method: "PAYBILL",
        channel: "C2B",
        amount: cleanAmount,
        phone: displayPhone,
      });

      if (!mountedRef.current) return;

      if (!existing) {
        setResult(null);
        setStatusNote("No matching paybill payment found yet.");
        return;
      }

      setResult(existing);

      if (isFailedTxStatus(existing.status)) {
        setStatusNote(existing.result_desc || "The payment was not completed.");
        return;
      }

      if (isPendingTxStatus(existing.status)) {
        setStatusNote("Payment found but it is still pending confirmation.");
        return;
      }

      if (isSuccessfulTxStatus(existing.status)) {
        await finishSuccessfulPayment(existing);
        return;
      }

      setStatusNote("Payment found, but final confirmation is still pending.");
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(getApiErrorMessage(e));
      setStatusNote("");
    } finally {
      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }, [
    accountReference,
    canManualCheck,
    cleanAmount,
    displayPhone,
    finishSuccessfulPayment,
    purpose,
  ]);

  const handleManualPaid = useCallback(async () => {
    if (!canManualCheck) return;

    try {
      setManualStarted(true);
      setChecking(true);
      setError("");
      setStatusNote("Waiting for paybill confirmation...");

      const tx = await pollForMatchingManualPaybill({
        purpose,
        reference: accountReference,
        totalAmountPaid: cleanAmount,
        phone: displayPhone,
        intervalMs: 5000,
        timeoutMs: 300000,
      });

      if (!mountedRef.current) return;

      if (!tx) {
        setResult(null);
        setStatusNote(
          "Payment not yet confirmed. Keep this screen open and use Check again."
        );
        return;
      }

      setResult(tx);
      await finishSuccessfulPayment(tx);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(getApiErrorMessage(e));
      setStatusNote("");
    } finally {
      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }, [
    accountReference,
    canManualCheck,
    cleanAmount,
    displayPhone,
    finishSuccessfulPayment,
    purpose,
  ]);

  const handleCancel = useCallback(() => {
    const returnTo = String(params.returnTo || ROUTES.tabs.payments);
    router.back();
    setTimeout(() => {
      router.replace(returnTo as any);
    }, 0);
  }, [params.returnTo]);

  const latestStatusTone = useMemo(() => {
    if (isSuccessfulTxStatus(result?.status)) return COLORS.success;
    if (isFailedTxStatus(result?.status)) return COLORS.danger;
    if (isPendingTxStatus(result?.status)) return COLORS.warning;
    return COLORS.text;
  }, [result?.status]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.mpesa} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to continue."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login as any)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>{displayTitle}</Text>
        <Text style={styles.subtitle}>{displaySubtitle}</Text>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {statusNote ? (
        <Card style={styles.noticeCard}>
          <Ionicons
            name={checking ? "time-outline" : "information-circle-outline"}
            size={18}
            color={checking ? COLORS.warning : COLORS.info}
          />
          <Text style={styles.noticeText}>{statusNote}</Text>
        </Card>
      ) : null}

      <View style={styles.switchRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setMethod("STK")}
          style={[
            styles.switchBtn,
            method === "STK" ? styles.switchBtnActive : null,
          ]}
        >
          <Text
            style={[
              styles.switchBtnText,
              method === "STK" ? styles.switchBtnTextActive : null,
            ]}
          >
            STK Push
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (!paybillEnabled) {
              Alert.alert(
                "Paybill unavailable",
                "Manual paybill is not enabled yet."
              );
              return;
            }
            setMethod("PAYBILL");
          }}
          style={[
            styles.switchBtn,
            method === "PAYBILL" ? styles.switchBtnActive : null,
          ]}
        >
          <Text
            style={[
              styles.switchBtnText,
              method === "PAYBILL" ? styles.switchBtnTextActive : null,
            ]}
          >
            Paybill
          </Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.formCard}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="07XXXXXXXX"
          placeholderTextColor={COLORS.placeholder}
          keyboardType="phone-pad"
          autoCapitalize="none"
          style={styles.input}
        />

        <Text style={styles.label}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={(v) => setAmount(sanitizeAmount(v))}
          placeholder="1000"
          placeholderTextColor={COLORS.placeholder}
          keyboardType="numeric"
          style={styles.input}
        />

        {method === "STK" ? (
          <Button
            title={
              submitting
                ? "Sending..."
                : checking
                ? "Checking..."
                : "Pay Now"
            }
            onPress={handleSubmit}
            disabled={!canSubmit}
            leftIcon={
              <Ionicons
                name="paper-plane-outline"
                size={18}
                color={COLORS.white}
              />
            }
          />
        ) : (
          <View style={styles.paybillBox}>
            <Text style={styles.paybillLine}>
              Business No:{" "}
              <Text style={styles.paybillValue}>
                {paybillEnabled ? paybillNumber : "Not set"}
              </Text>
            </Text>
            <Text style={styles.paybillLine}>
              Account No:{" "}
              <Text style={styles.paybillValue}>{accountReference || "—"}</Text>
            </Text>
            <Text style={styles.paybillLine}>
              Amount: <Text style={styles.paybillValue}>{money(cleanAmount || 0)}</Text>
            </Text>

            <View style={styles.paybillActions}>
              <Button
                title={checking ? "Checking..." : "I Have Paid"}
                onPress={handleManualPaid}
                disabled={!canManualCheck}
                leftIcon={
                  <Ionicons
                    name="checkmark-done-outline"
                    size={18}
                    color={COLORS.white}
                  />
                }
              />
            </View>

            <TouchableOpacity
              disabled={checking}
              onPress={checkExistingManualPayment}
              style={styles.inlineAction}
            >
              <Ionicons name="refresh-outline" size={16} color={COLORS.mpesa} />
              <Text style={styles.inlineActionText}>Check again</Text>
            </TouchableOpacity>

            {manualStarted ? (
              <Text style={styles.helperText}>
                Waiting for backend confirmation and allocation.
              </Text>
            ) : null}
          </View>
        )}
      </Card>

      {result ? (
        <Card style={styles.resultCard}>
          <Text style={styles.resultTitle}>Payment Result</Text>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Status</Text>
            <Text style={[styles.resultValue, { color: latestStatusTone }]}>
              {String(result.status || "—")}
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Amount</Text>
            <Text style={styles.resultValue}>{money(result.amount || 0)}</Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Phone</Text>
            <Text style={styles.resultValue}>
              {displayKenyaPhone(result.phone || displayPhone || "") || "—"}
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Receipt</Text>
            <Text style={styles.resultValue}>
              {result.mpesa_receipt_number || "—"}
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Allocation</Text>
            <Text style={styles.resultValue}>
              {result.allocation_status || "Pending"}
            </Text>
          </View>
        </Card>
      ) : null}

      <TouchableOpacity onPress={handleCancel} style={styles.backBtn}>
        <Ionicons name="arrow-back-outline" size={16} color={COLORS.text} />
        <Text style={styles.backBtnText}>Back</Text>
      </TouchableOpacity>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    ...P.page,
  },
  content: {
    ...P.content,
    paddingBottom: 24,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontFamily: FONT.bold,
    fontSize: 24,
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    ...TYPE.subtext,
    color: COLORS.textMuted,
  },
  errorCard: {
    ...P.paymentError,
    marginBottom: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    ...TYPE.subtext,
    color: COLORS.danger,
  },
  noticeCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  noticeText: {
    flex: 1,
    ...TYPE.subtext,
    color: COLORS.text,
  },
  switchRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  switchBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: COLORS.surface,
  },
  switchBtnActive: {
    borderColor: COLORS.mpesa,
    backgroundColor: "rgba(22, 163, 74, 0.08)",
  },
  switchBtnText: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  switchBtnTextActive: {
    color: COLORS.mpesa,
    fontFamily: FONT.bold,
  },
  formCard: {
    ...P.paymentCard,
  },
  label: {
    ...TYPE.label,
    marginBottom: 8,
    color: COLORS.text,
  },
  input: {
    ...P.input,
    height: 50,
    marginBottom: SPACING.md,
  },
  paybillBox: {
    marginTop: SPACING.xs,
  },
  paybillLine: {
    ...TYPE.body,
    color: COLORS.text,
    marginBottom: 8,
  },
  paybillValue: {
    fontFamily: FONT.bold,
    color: COLORS.text,
  },
  paybillActions: {
    marginTop: SPACING.sm,
  },
  inlineAction: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  inlineActionText: {
    color: COLORS.mpesa,
    fontFamily: FONT.medium,
    fontSize: 14,
  },
  helperText: {
    marginTop: SPACING.sm,
    ...TYPE.subtext,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  resultCard: {
    ...P.paymentCard,
    marginTop: SPACING.md,
  },
  resultTitle: {
    fontFamily: FONT.bold,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: 6,
  },
  resultLabel: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
    flex: 1,
  },
  resultValue: {
    ...TYPE.body,
    color: COLORS.text,
    fontFamily: FONT.medium,
    flex: 1,
    textAlign: "right",
  },
  backBtn: {
    marginTop: SPACING.md,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtnText: {
    color: COLORS.text,
    fontFamily: FONT.medium,
    fontSize: 14,
  },
});

// import { Ionicons } from "@expo/vector-icons";
// import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
// import React, { useCallback, useMemo, useRef, useState } from "react";
// import {
//   ActivityIndicator,
//   Alert,
//   RefreshControl,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from "react-native";

// import Button from "@/components/ui/Button";
// import Card from "@/components/ui/Card";
// import EmptyState from "@/components/ui/EmptyState";
// import Section from "@/components/ui/Section";

// import { ROUTES } from "@/constants/routes";
// import {
//   COLORS,
//   FONT,
//   getMpesaMethodColors,
//   P,
//   RADIUS,
//   SPACING,
//   TYPE,
// } from "@/constants/theme";
// import {
//   displayKenyaPhone,
//   findLatestMatchingMyMpesaTransaction,
//   getActiveMpesaConfig,
//   getApiErrorMessage,
//   getMpesaPaybillNumber,
//   isFailedTxStatus,
//   isPaybillEnabled,
//   isPendingTxStatus,
//   isSuccessfulTxStatus,
//   money,
//   MpesaConfig,
//   MpesaPurpose,
//   MpesaTransaction,
//   mpesaStkPush,
//   normalizeKenyaPhone,
//   pollForMatchingManualPaybill,
//   pollMyMpesaTransactionById,
// } from "@/services/payments";
// import { getMe, isAdminUser, MeResponse } from "@/services/profile";
// import {
//   getSessionUser,
//   saveSessionUser,
//   SessionUser,
// } from "@/services/session";

// type DepositUser = Partial<MeResponse> & Partial<SessionUser>;
// type DepositMethod = "STK" | "PAYBILL";

// type DepositParams = {
//   purpose?: string;
//   reference?: string;
//   narration?: string;
//   amount?: string;
//   phone?: string;
//   title?: string;
//   subtitle?: string;
//   returnTo?: string;
//   groupId?: string;
// };

// function normalizeDisplayPhone(value: string) {
//   const v = String(value || "").trim().replace(/\s+/g, "");
//   if (v.startsWith("+254")) return `0${v.slice(4)}`;
//   if (v.startsWith("254")) return `0${v.slice(3)}`;
//   return v;
// }

// function isValidKenyanPhone(phone: string) {
//   return /^(07|01)\d{8}$/.test(phone);
// }

// function isPositiveAmount(value: string) {
//   const n = Number(value);
//   return Number.isFinite(n) && n > 0;
// }

// function sanitizeAmount(value: string) {
//   const cleaned = value.replace(/[^\d.]/g, "");
//   const parts = cleaned.split(".");
//   if (parts.length <= 2) return cleaned;
//   return `${parts[0]}.${parts.slice(1).join("")}`;
// }

// function formatDisplayName(user?: DepositUser | null) {
//   if (!user) return "Member";
//   return (
//     (user as any)?.full_name ||
//     (user as any)?.name ||
//     user?.username ||
//     (typeof user?.phone === "string" ? user.phone : "") ||
//     "Member"
//   );
// }

// function getUserId(user?: DepositUser | null) {
//   const raw =
//     (user as any)?.id ??
//     (user as any)?.user_id ??
//     (user as any)?.pk ??
//     null;
//   const n = Number(raw);
//   return Number.isFinite(n) && n > 0 ? n : null;
// }

// function getDefaultSavingsReference(user?: DepositUser | null) {
//   const userId = getUserId(user);
//   if (userId) return `saving${userId}`;
//   return "";
// }

// function normalizePurpose(value?: string): MpesaPurpose {
//   const raw = String(value || "").trim().toUpperCase();

//   if (
//     raw === "SAVINGS_DEPOSIT" ||
//     raw === "MERRY_CONTRIBUTION" ||
//     raw === "GROUP_CONTRIBUTION" ||
//     raw === "LOAN_REPAYMENT" ||
//     raw === "OTHER"
//   ) {
//     return raw;
//   }

//   return "SAVINGS_DEPOSIT";
// }

// function buildFallbackReference(
//   purpose: MpesaPurpose,
//   user?: DepositUser | null,
//   groupId?: string | number
// ) {
//   const userId = getUserId(user);
//   const parsedGroupId = Number(groupId);

//   switch (purpose) {
//     case "SAVINGS_DEPOSIT":
//       return getDefaultSavingsReference(user);
//     case "MERRY_CONTRIBUTION":
//       return userId ? `mus${userId}` : "";
//     case "GROUP_CONTRIBUTION":
//       return Number.isFinite(parsedGroupId) && parsedGroupId > 0
//         ? `grp${parsedGroupId}`
//         : "";
//     case "LOAN_REPAYMENT":
//       return userId ? `loan${userId}` : "";
//     default:
//       return "";
//   }
// }

// function buildFallbackNarration(purpose: MpesaPurpose) {
//   switch (purpose) {
//     case "SAVINGS_DEPOSIT":
//       return "Savings deposit";
//     case "MERRY_CONTRIBUTION":
//       return "Merry contribution";
//     case "GROUP_CONTRIBUTION":
//       return "Group contribution";
//     case "LOAN_REPAYMENT":
//       return "Loan repayment";
//     default:
//       return "";
//   }
// }

// function SmallMethodCard({
//   active,
//   title,
//   subtitle,
//   icon,
//   onPress,
// }: {
//   active: boolean;
//   title: string;
//   subtitle: string;
//   icon: keyof typeof Ionicons.glyphMap;
//   onPress: () => void;
// }) {
//   const tone = getMpesaMethodColors(active);

//   return (
//     <TouchableOpacity
//       activeOpacity={0.85}
//       onPress={onPress}
//       style={[
//         styles.methodCard,
//         {
//           backgroundColor: tone.bg,
//           borderColor: tone.border,
//         },
//       ]}
//     >
//       <View
//         style={[
//           styles.methodIconWrap,
//           {
//             backgroundColor: tone.iconBg,
//           },
//         ]}
//       >
//         <Ionicons name={icon} size={18} color={tone.icon} />
//       </View>

//       <View style={{ flex: 1 }}>
//         <Text style={[styles.methodTitle, { color: tone.title }]}>{title}</Text>
//         <Text style={[styles.methodSubtitle, { color: tone.subtitle }]}>
//           {subtitle}
//         </Text>
//       </View>

//       {active ? (
//         <Ionicons name="checkmark-circle" size={18} color={COLORS.mpesa} />
//       ) : null}
//     </TouchableOpacity>
//   );
// }

// function InfoRow({
//   label,
//   value,
//   valueColor,
// }: {
//   label: string;
//   value: string;
//   valueColor?: string;
// }) {
//   return (
//     <View style={styles.infoRow}>
//       <Text style={styles.infoLabel}>{label}</Text>
//       <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>
//         {value}
//       </Text>
//     </View>
//   );
// }

// export default function DepositScreen() {
//   const params = useLocalSearchParams<DepositParams>();

//   const [user, setUser] = useState<DepositUser | null>(null);
//   const [mpesaConfig, setMpesaConfig] = useState<MpesaConfig | null>(null);

//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [checking, setChecking] = useState(false);
//   const [error, setError] = useState("");

//   const [phone, setPhone] = useState("");
//   const [amount, setAmount] = useState("");
//   const [method, setMethod] = useState<DepositMethod>("STK");

//   const [result, setResult] = useState<MpesaTransaction | null>(null);
//   const [statusNote, setStatusNote] = useState("");
//   const [manualStarted, setManualStarted] = useState(false);

//   const mountedRef = useRef(true);

//   const isAdmin = isAdminUser(user);

//   const purpose = useMemo(
//     () => normalizePurpose(params.purpose),
//     [params.purpose]
//   );

//   const displayTitle = useMemo(() => {
//     if (params.title) return String(params.title);
//     switch (purpose) {
//       case "MERRY_CONTRIBUTION":
//         return "M-PESA MERRY PAYMENT";
//       case "GROUP_CONTRIBUTION":
//         return "M-PESA GROUP PAYMENT";
//       case "LOAN_REPAYMENT":
//         return "M-PESA LOAN PAYMENT";
//       default:
//         return "M-PESA DEPOSIT";
//     }
//   }, [params.title, purpose]);

//   const displaySubtitle = useMemo(() => {
//     if (params.subtitle) return String(params.subtitle);
//     switch (purpose) {
//       case "MERRY_CONTRIBUTION":
//         return isAdmin ? "Admin view" : "Merry contribution";
//       case "GROUP_CONTRIBUTION":
//         return isAdmin ? "Admin view" : "Group contribution";
//       case "LOAN_REPAYMENT":
//         return isAdmin ? "Admin view" : "Loan repayment";
//       default:
//         return isAdmin ? "Admin view" : "Savings deposit";
//     }
//   }, [params.subtitle, purpose, isAdmin]);

//   const displayPhone = useMemo(() => normalizeDisplayPhone(phone), [phone]);
//   const stkPhone = useMemo(() => normalizeKenyaPhone(displayPhone), [displayPhone]);

//   const phoneOk = useMemo(() => isValidKenyanPhone(displayPhone), [displayPhone]);
//   const amountOk = useMemo(() => isPositiveAmount(amount), [amount]);

//   const cleanAmount = useMemo(() => {
//     const n = Number(amount);
//     return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "";
//   }, [amount]);

//   const accountReference = useMemo(() => {
//     const explicitRef = String(params.reference || "").trim();
//     if (explicitRef) return explicitRef;
//     return buildFallbackReference(purpose, user, params.groupId);
//   }, [params.reference, params.groupId, purpose, user]);

//   const narration = useMemo(() => {
//     const explicitNarration = String(params.narration || "").trim();
//     if (explicitNarration) return explicitNarration;
//     return buildFallbackNarration(purpose);
//   }, [params.narration, purpose]);

//   const paybillNumber = useMemo(
//     () => getMpesaPaybillNumber(mpesaConfig),
//     [mpesaConfig]
//   );

//   const paybillEnabled = useMemo(
//     () => isPaybillEnabled(mpesaConfig),
//     [mpesaConfig]
//   );

//   const canSubmit =
//     method === "STK" && phoneOk && amountOk && !submitting && !checking;

//   const canManualCheck =
//     method === "PAYBILL" &&
//     paybillEnabled &&
//     phoneOk &&
//     amountOk &&
//     !submitting &&
//     !checking &&
//     !!accountReference;

//   const goBackSuccess = useCallback(
//     (tx: MpesaTransaction, note?: string) => {
//       const returnTo = String(params.returnTo || ROUTES.tabs.payments);

//       router.replace({
//         pathname: returnTo as any,
//         params: {
//           deposited: "1",
//           payment_success: "1",
//           amount: cleanAmount,
//           phone: displayPhone,
//           purpose,
//           reference: accountReference,
//           groupId: params.groupId || "",
//           notice: note || "Payment confirmed successfully.",
//           tx_id: String(tx.id || ""),
//           tx_status: String(tx.status || ""),
//           checkout_request_id: tx.checkout_request_id || "",
//           mpesa_receipt_number: tx.mpesa_receipt_number || "",
//           allocation_status: tx.allocation_status || "",
//         },
//       });
//     },
//     [
//       accountReference,
//       cleanAmount,
//       displayPhone,
//       params.groupId,
//       params.returnTo,
//       purpose,
//     ]
//   );

//   const load = useCallback(async () => {
//     try {
//       setError("");

//       const [sessionRes, meRes, configRes] = await Promise.allSettled([
//         getSessionUser(),
//         getMe(),
//         getActiveMpesaConfig(),
//       ]);

//       const sessionUser =
//         sessionRes.status === "fulfilled" ? sessionRes.value : null;
//       const meUser = meRes.status === "fulfilled" ? meRes.value : null;

//       const mergedUser: DepositUser | null =
//         sessionUser || meUser
//           ? {
//               ...(sessionUser ?? {}),
//               ...(meUser ?? {}),
//             }
//           : null;

//       if (!mountedRef.current) return;

//       setUser(mergedUser);

//       if (mergedUser) {
//         await saveSessionUser(mergedUser);
//       }

//       const defaultPhone = String(
//         params.phone || meUser?.phone || sessionUser?.phone || ""
//       );
//       setPhone((prev) => (prev?.trim() ? prev : defaultPhone));

//       const defaultAmount = String(params.amount || "").trim();
//       if (defaultAmount) {
//         setAmount((prev) => (prev?.trim() ? prev : defaultAmount));
//       }

//       if (configRes.status === "fulfilled") {
//         setMpesaConfig(configRes.value);
//       } else {
//         setMpesaConfig(null);
//       }

//       if (meRes.status === "rejected") {
//         setError(getApiErrorMessage(meRes.reason));
//       }
//     } catch (e: any) {
//       if (!mountedRef.current) return;
//       setError(getApiErrorMessage(e));
//     }
//   }, [params.amount, params.phone]);

//   useFocusEffect(
//     useCallback(() => {
//       mountedRef.current = true;

//       const run = async () => {
//         try {
//           setLoading(true);
//           await load();
//         } finally {
//           if (mountedRef.current) {
//             setLoading(false);
//           }
//         }
//       };

//       run();

//       return () => {
//         mountedRef.current = false;
//       };
//     }, [load])
//   );

//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);
//     try {
//       await load();
//     } finally {
//       if (mountedRef.current) {
//         setRefreshing(false);
//       }
//     }
//   }, [load]);

//   const handleSubmit = useCallback(async () => {
//     if (!canSubmit) return;

//     try {
//       setSubmitting(true);
//       setError("");
//       setResult(null);
//       setStatusNote("Sending STK push...");

//       const res = await mpesaStkPush({
//         phone: displayPhone,
//         amount: cleanAmount,
//         purpose,
//         reference: accountReference,
//         narration,
//       });

//       if (!mountedRef.current) return;

//       setResult(res.tx);
//       setStatusNote(
//         res.message || "STK push sent. Check your phone and enter your M-Pesa PIN."
//       );

//       if (!res.tx?.id) {
//         throw new Error("Transaction id was not returned by the backend.");
//       }

//       setChecking(true);
//       setStatusNote("Waiting for M-Pesa confirmation...");

//       const finalTx = await pollMyMpesaTransactionById(res.tx.id, {
//         intervalMs: 3000,
//         timeoutMs: 120000,
//         stopOnAllocated: false,
//       });

//       if (!mountedRef.current) return;

//       setResult(finalTx);

//       if (isSuccessfulTxStatus(finalTx.status)) {
//         setStatusNote("Payment confirmed successfully.");
//         goBackSuccess(finalTx, "Payment confirmed successfully.");
//         return;
//       }

//       if (isFailedTxStatus(finalTx.status)) {
//         setStatusNote(finalTx.result_desc || "Payment was not completed.");
//         return;
//       }

//       setStatusNote("Payment request is still pending. You can check again below.");
//     } catch (e: any) {
//       if (!mountedRef.current) return;
//       setError(getApiErrorMessage(e));
//       setStatusNote("");
//     } finally {
//       if (mountedRef.current) {
//         setSubmitting(false);
//         setChecking(false);
//       }
//     }
//   }, [
//     accountReference,
//     canSubmit,
//     cleanAmount,
//     displayPhone,
//     goBackSuccess,
//     narration,
//     purpose,
//   ]);

//   const checkExistingManualPayment = useCallback(async () => {
//     if (!canManualCheck) return;

//     try {
//       setChecking(true);
//       setError("");
//       setStatusNote("Checking for your paybill payment...");

//       const existing = await findLatestMatchingMyMpesaTransaction({
//         purpose,
//         reference: accountReference,
//         payment_method: "PAYBILL",
//         channel: "C2B",
//         amount: cleanAmount,
//         phone: displayPhone,
//       });

//       if (!mountedRef.current) return;

//       if (existing && isSuccessfulTxStatus(existing.status)) {
//         setResult(existing);
//         setStatusNote("Manual paybill payment confirmed.");
//         goBackSuccess(existing, "Manual paybill payment confirmed.");
//         return;
//       }

//       setStatusNote(
//         "No confirmed paybill payment found yet. Complete the payment, then tap 'I Have Paid'."
//       );
//     } catch (e: any) {
//       if (!mountedRef.current) return;
//       setError(getApiErrorMessage(e));
//       setStatusNote("");
//     } finally {
//       if (mountedRef.current) {
//         setChecking(false);
//       }
//     }
//   }, [
//     accountReference,
//     canManualCheck,
//     cleanAmount,
//     displayPhone,
//     goBackSuccess,
//     purpose,
//   ]);

//   const handleManualPaid = useCallback(async () => {
//     if (!canManualCheck) return;

//     try {
//       setManualStarted(true);
//       setChecking(true);
//       setError("");
//       setStatusNote("Waiting for paybill confirmation from backend...");

//       const tx = await pollForMatchingManualPaybill({
//         purpose,
//         reference: accountReference,
//         totalAmountPaid: cleanAmount,
//         phone: displayPhone,
//         intervalMs: 5000,
//         timeoutMs: 300000,
//       });

//       if (!mountedRef.current) return;

//       if (tx) {
//         setResult(tx);
//         setStatusNote("Manual paybill payment confirmed.");
//         goBackSuccess(tx, "Manual paybill payment confirmed.");
//         return;
//       }

//       setStatusNote(
//         "We have not received your manual paybill confirmation yet. You can keep this screen open and try again."
//       );
//     } catch (e: any) {
//       if (!mountedRef.current) return;
//       setError(getApiErrorMessage(e));
//       setStatusNote("");
//     } finally {
//       if (mountedRef.current) {
//         setChecking(false);
//       }
//     }
//   }, [
//     accountReference,
//     canManualCheck,
//     cleanAmount,
//     displayPhone,
//     goBackSuccess,
//     purpose,
//   ]);

//   const handleCancel = useCallback(() => {
//     const returnTo = String(params.returnTo || ROUTES.tabs.payments);
//     router.back();
//     setTimeout(() => {
//       router.replace(returnTo as any);
//     }, 0);
//   }, [params.returnTo]);

//   const latestStatusTone = useMemo(() => {
//     if (isSuccessfulTxStatus(result?.status)) return COLORS.success;
//     if (isFailedTxStatus(result?.status)) return COLORS.danger;
//     if (isPendingTxStatus(result?.status)) return COLORS.warning;
//     return COLORS.text;
//   }, [result?.status]);

//   if (loading) {
//     return (
//       <View style={styles.loadingWrap}>
//         <ActivityIndicator color={COLORS.mpesa} />
//       </View>
//     );
//   }

//   if (!user) {
//     return (
//       <View style={styles.page}>
//         <EmptyState
//           title="Not signed in"
//           subtitle="Please login to make a deposit."
//           actionLabel="Go to Login"
//           onAction={() => router.replace(ROUTES.auth.login as any)}
//         />
//       </View>
//     );
//   }

//   return (
//     <ScrollView
//       style={styles.page}
//       contentContainerStyle={styles.content}
//       refreshControl={
//         <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//       }
//       showsVerticalScrollIndicator={false}
//       keyboardShouldPersistTaps="handled"
//     >
//       <View style={styles.heroCard}>
//         <View style={styles.heroTop}>
//           <View style={{ flex: 1, paddingRight: SPACING.md }}>
//             <Text style={styles.heroEyebrow}>{displayTitle}</Text>
//             <Text style={styles.heroTitle}>{formatDisplayName(user)}</Text>
//             <Text style={styles.heroSubtitle}>{displaySubtitle}</Text>
//           </View>

//           <View style={styles.heroIconWrap}>
//             <Ionicons
//               name="phone-portrait-outline"
//               size={24}
//               color={COLORS.white}
//             />
//           </View>
//         </View>

//         <View style={styles.heroPills}>
//           <View style={styles.heroPill}>
//             <Text style={styles.heroPillText}>STK</Text>
//           </View>
//           <View style={styles.heroPill}>
//             <Text style={styles.heroPillText}>Paybill</Text>
//           </View>
//           <View style={styles.heroPill}>
//             <Text style={styles.heroPillText}>Secure Flow</Text>
//           </View>
//         </View>
//       </View>

//       {error ? (
//         <Card style={styles.errorCard}>
//           <Ionicons
//             name="alert-circle-outline"
//             size={18}
//             color={COLORS.danger}
//           />
//           <Text style={styles.errorText}>{error}</Text>
//         </Card>
//       ) : null}

//       {statusNote ? (
//         <Card style={styles.noticeCard}>
//           <Ionicons
//             name={checking ? "time-outline" : "information-circle-outline"}
//             size={18}
//             color={checking ? COLORS.warning : COLORS.info}
//           />
//           <Text style={styles.noticeText}>{statusNote}</Text>
//         </Card>
//       ) : null}

//       <Section title="Method">
//         <View style={styles.methodGrid}>
//           <SmallMethodCard
//             active={method === "STK"}
//             title="STK Push"
//             subtitle="Prompt sent to phone"
//             icon="phone-portrait-outline"
//             onPress={() => setMethod("STK")}
//           />
//           <SmallMethodCard
//             active={method === "PAYBILL"}
//             title="Paybill"
//             subtitle={paybillEnabled ? "Manual payment" : "Not available"}
//             icon="grid-outline"
//             onPress={() => {
//               if (!paybillEnabled) {
//                 Alert.alert(
//                   "Paybill unavailable",
//                   "Manual paybill is not enabled yet."
//                 );
//               }
//               setMethod("PAYBILL");
//             }}
//           />
//         </View>
//       </Section>

//       <Section title="Payment Details">
//         <Card style={styles.formCard}>
//           <Text style={styles.label}>Phone Number</Text>
//           <TextInput
//             value={phone}
//             onChangeText={setPhone}
//             placeholder="07XXXXXXXX"
//             placeholderTextColor={COLORS.placeholder}
//             keyboardType="phone-pad"
//             autoCapitalize="none"
//             style={styles.input}
//           />

//           <Text style={styles.label}>Amount</Text>
//           <TextInput
//             value={amount}
//             onChangeText={(v) => setAmount(sanitizeAmount(v))}
//             placeholder="1000"
//             placeholderTextColor={COLORS.placeholder}
//             keyboardType="numeric"
//             style={styles.input}
//           />

//           <View style={styles.summaryBox}>
//             <InfoRow label="Member Phone" value={displayPhone || "—"} />
//             <InfoRow label="M-Pesa Phone" value={stkPhone || "—"} />
//             <InfoRow
//               label={method === "STK" ? "Base Amount" : "Amount To Pay"}
//               value={money(cleanAmount || 0)}
//             />
//             <InfoRow label="Purpose" value={purpose} />
//             <InfoRow label="Reference" value={accountReference || "—"} />
//             {purpose === "GROUP_CONTRIBUTION" && params.groupId ? (
//               <InfoRow label="Group ID" value={String(params.groupId)} />
//             ) : null}
//             <InfoRow label="Narration" value={narration || "—"} />
//           </View>
//         </Card>
//       </Section>

//       {method === "STK" ? (
//         <Section title="STK Push">
//           <Card style={styles.paybillCard}>
//             <Text style={styles.paybillTitle}>Complete in app</Text>
//             <Text style={styles.paybillSubtitle}>
//               We will send the STK prompt to your phone, then automatically check
//               the backend for confirmation.
//             </Text>

//             <Button
//               title={
//                 submitting
//                   ? "Sending STK..."
//                   : checking
//                   ? "Checking Status..."
//                   : "Send STK Push"
//               }
//               onPress={handleSubmit}
//               disabled={!canSubmit}
//               leftIcon={
//                 <Ionicons
//                   name="paper-plane-outline"
//                   size={18}
//                   color={COLORS.white}
//                 />
//               }
//             />
//           </Card>
//         </Section>
//       ) : (
//         <Section title="Manual Paybill">
//           <Card style={styles.paybillCard}>
//             <View style={styles.paybillTop}>
//               <View style={styles.paybillBadge}>
//                 <Ionicons name="grid-outline" size={18} color={COLORS.mpesa} />
//               </View>

//               <View style={{ flex: 1 }}>
//                 <Text style={styles.paybillTitle}>Paybill Instructions</Text>
//                 <Text style={styles.paybillSubtitle}>
//                   Pay from M-Pesa, then return here so we can confirm the payment
//                   from the backend.
//                 </Text>
//               </View>
//             </View>

//             <View style={styles.summaryBox}>
//               <InfoRow
//                 label="Business No."
//                 value={paybillEnabled ? paybillNumber : "Not set"}
//                 valueColor={!paybillEnabled ? COLORS.danger : undefined}
//               />
//               <InfoRow label="Account Number" value={accountReference || "—"} />
//               {purpose === "GROUP_CONTRIBUTION" && params.groupId ? (
//                 <InfoRow label="Group ID" value={String(params.groupId)} />
//               ) : null}
//               <InfoRow
//                 label="Your Phone"
//                 value={displayPhone || "Use your M-Pesa line"}
//               />
//               <InfoRow label="Amount To Pay" value={money(cleanAmount || 0)} />
//             </View>

//             <View style={styles.paybillSteps}>
//               <Text style={styles.stepText}>1. Open M-Pesa on your phone</Text>
//               <Text style={styles.stepText}>
//                 2. Select Lipa na M-Pesa → Paybill
//               </Text>
//               <Text style={styles.stepText}>
//                 3. Enter Business No. and Account Number exactly
//               </Text>
//               <Text style={styles.stepText}>
//                 4. Enter the same amount shown above
//               </Text>
//               <Text style={styles.stepText}>
//                 5. After paying, tap “I Have Paid” below
//               </Text>
//             </View>

//             <View style={styles.actionsRow}>
//               <View style={{ flex: 1 }}>
//                 <Button
//                   title={checking ? "Checking..." : "I Have Paid"}
//                   onPress={handleManualPaid}
//                   disabled={!canManualCheck}
//                   leftIcon={
//                     <Ionicons
//                       name="checkmark-done-outline"
//                       size={18}
//                       color={COLORS.white}
//                     />
//                   }
//                 />
//               </View>
//             </View>

//             <TouchableOpacity
//               disabled={checking}
//               onPress={checkExistingManualPayment}
//               style={styles.secondaryAction}
//             >
//               <Ionicons name="refresh-outline" size={16} color={COLORS.mpesa} />
//               <Text style={styles.secondaryActionText}>Check again now</Text>
//             </TouchableOpacity>

//             {manualStarted ? (
//               <Text style={styles.helperText}>
//                 Keep this screen open while we wait for paybill confirmation.
//               </Text>
//             ) : null}
//           </Card>
//         </Section>
//       )}

//       {result ? (
//         <Section title="Latest Transaction">
//           <Card style={styles.latestCard}>
//             <InfoRow
//               label="Status"
//               value={String(result.status || "—")}
//               valueColor={latestStatusTone}
//             />
//             <InfoRow label="Charged Amount" value={money(result.amount || 0)} />
//             <InfoRow
//               label="Base Amount"
//               value={money(result.base_amount || cleanAmount || 0)}
//             />
//             <InfoRow
//               label="Phone"
//               value={displayKenyaPhone(result.phone || displayPhone || "") || "—"}
//             />
//             <InfoRow
//               label="Reference"
//               value={result.reference || accountReference || "—"}
//             />
//             <InfoRow
//               label="Receipt"
//               value={result.mpesa_receipt_number || "—"}
//             />
//             <InfoRow
//               label="Checkout ID"
//               value={result.checkout_request_id || "—"}
//             />
//             <InfoRow
//               label="Allocation"
//               value={result.allocation_status || "—"}
//             />
//           </Card>
//         </Section>
//       ) : null}

//       <View style={styles.footerActions}>
//         <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
//           <Ionicons name="arrow-back-outline" size={16} color={COLORS.text} />
//           <Text style={styles.cancelBtnText}>Back</Text>
//         </TouchableOpacity>
//       </View>

//       <View style={{ height: 24 }} />
//     </ScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   page: {
//     ...P.page,
//   },
//   content: {
//     ...P.content,
//     paddingBottom: 24,
//   },
//   loadingWrap: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: COLORS.background,
//   },
//   heroCard: {
//     ...P.paymentHero,
//     marginBottom: SPACING.lg,
//   },
//   heroTop: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     justifyContent: "space-between",
//   },
//   heroEyebrow: {
//     ...TYPE.caption,
//     color: "rgba(255,255,255,0.78)",
//     fontFamily: FONT.bold,
//     letterSpacing: 1,
//   },
//   heroTitle: {
//     marginTop: 6,
//     color: COLORS.white,
//     fontFamily: FONT.bold,
//     fontSize: 24,
//     lineHeight: 30,
//   },
//   heroSubtitle: {
//     ...TYPE.subtext,
//     marginTop: 8,
//     color: "rgba(255,255,255,0.90)",
//   },
//   heroIconWrap: {
//     width: 54,
//     height: 54,
//     borderRadius: RADIUS.round,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: "rgba(255,255,255,0.16)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.20)",
//   },
//   heroPills: {
//     marginTop: SPACING.md,
//     flexDirection: "row",
//     flexWrap: "wrap",
//     gap: SPACING.sm,
//   },
//   heroPill: {
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: RADIUS.round,
//     backgroundColor: "rgba(255,255,255,0.12)",
//   },
//   heroPillText: {
//     color: COLORS.white,
//     fontFamily: FONT.bold,
//     fontSize: 11,
//   },
//   errorCard: {
//     ...P.paymentError,
//     marginBottom: SPACING.md,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.sm,
//   },
//   errorText: {
//     flex: 1,
//     ...TYPE.subtext,
//     color: COLORS.danger,
//   },
//   noticeCard: {
//     marginBottom: SPACING.md,
//     padding: SPACING.md,
//     borderWidth: 1,
//     borderColor: COLORS.cardBorder,
//     borderRadius: RADIUS.lg,
//     backgroundColor: COLORS.surface,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.sm,
//   },
//   noticeText: {
//     flex: 1,
//     ...TYPE.subtext,
//     color: COLORS.text,
//   },
//   methodGrid: {
//     gap: SPACING.sm,
//   },
//   methodCard: {
//     ...P.methodCard,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.md,
//   },
//   methodIconWrap: {
//     width: 42,
//     height: 42,
//     borderRadius: RADIUS.md,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   methodTitle: {
//     fontFamily: FONT.bold,
//     fontSize: 14,
//   },
//   methodSubtitle: {
//     marginTop: 4,
//     ...TYPE.subtext,
//   },
//   formCard: {
//     ...P.paymentCard,
//   },
//   label: {
//     ...TYPE.label,
//     marginBottom: 8,
//     color: COLORS.text,
//   },
//   input: {
//     ...P.input,
//     height: 50,
//     marginBottom: SPACING.md,
//   },
//   summaryBox: {
//     marginBottom: SPACING.md,
//     borderWidth: 1,
//     borderColor: COLORS.cardBorder,
//     borderRadius: RADIUS.lg,
//     padding: SPACING.md,
//     backgroundColor: COLORS.surfaceAlt,
//   },
//   infoRow: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     gap: SPACING.md,
//     paddingVertical: 6,
//   },
//   infoLabel: {
//     ...TYPE.subtext,
//     color: COLORS.textMuted,
//     flex: 1,
//   },
//   infoValue: {
//     ...TYPE.body,
//     color: COLORS.text,
//     fontFamily: FONT.medium,
//     flex: 1,
//     textAlign: "right",
//   },
//   paybillCard: {
//     ...P.paymentCard,
//   },
//   paybillTop: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     gap: SPACING.md,
//     marginBottom: SPACING.md,
//   },
//   paybillBadge: {
//     width: 42,
//     height: 42,
//     borderRadius: RADIUS.md,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: COLORS.surfaceAlt,
//   },
//   paybillTitle: {
//     fontFamily: FONT.bold,
//     fontSize: 16,
//     color: COLORS.text,
//   },
//   paybillSubtitle: {
//     marginTop: 4,
//     ...TYPE.subtext,
//     color: COLORS.textMuted,
//   },
//   paybillSteps: {
//     gap: 8,
//     marginBottom: SPACING.md,
//   },
//   stepText: {
//     ...TYPE.body,
//     color: COLORS.text,
//   },
//   actionsRow: {
//     flexDirection: "row",
//     gap: SPACING.sm,
//     marginBottom: SPACING.md,
//   },
//   secondaryAction: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     gap: 8,
//     paddingVertical: 10,
//   },
//   secondaryActionText: {
//     color: COLORS.mpesa,
//     fontFamily: FONT.medium,
//     fontSize: 14,
//   },
//   helperText: {
//     ...TYPE.subtext,
//     color: COLORS.textMuted,
//     textAlign: "center",
//   },
//   latestCard: {
//     ...P.paymentCard,
//   },
//   footerActions: {
//     marginTop: SPACING.md,
//     alignItems: "center",
//   },
//   cancelBtn: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     paddingHorizontal: 12,
//     paddingVertical: 10,
//   },
//   cancelBtnText: {
//     color: COLORS.text,
//     fontFamily: FONT.medium,
//     fontSize: 14,
//   },
// });