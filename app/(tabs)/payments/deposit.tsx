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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { useNotification } from "@/context/NotificationContext";

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
  findLatestMatchingMyMpesaTransaction,
  getActiveMpesaConfig,
  getApiErrorMessage,
  getMpesaPaybillNumber,
  isFailedTxStatus,
  isPaybillEnabled,
  isPendingTxStatus,
  isSuccessfulTxStatus,
  MpesaConfig,
  MpesaPurpose,
  mpesaStkPush,
  MpesaTransaction,
  pollForMatchingManualPaybill,
  pollMyMpesaTransactionById,
} from "@/services/payments";
import { getMe, MeResponse } from "@/services/profile";
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

function getFailureMessage(tx?: Partial<MpesaTransaction> | null) {
  if (!tx) return "Payment was not completed.";
  if (String(tx.status || "").toUpperCase() === "CANCELLED") {
    return tx.result_desc || "Payment was cancelled.";
  }
  return tx.result_desc || "Payment failed.";
}

export default function DepositScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<DepositParams>();
  const { showToast } = useNotification();

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

  const [statusText, setStatusText] = useState("");

  const mountedRef = useRef(true);
  const redirectedRef = useRef(false);

  const purpose = useMemo(
    () => normalizePurpose(params.purpose),
    [params.purpose]
  );

  const displayTitle = useMemo(() => {
    if (params.title) return String(params.title);
    return getPurposeLabel(purpose);
  }, [params.title, purpose]);

  const displayPhone = useMemo(() => normalizeDisplayPhone(phone), [phone]);
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

  const redirectToReturn = useCallback(
    (
      tx: Partial<MpesaTransaction> | null,
      kind: "success" | "failed",
      note: string
    ) => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;

      if (kind === "success") {
        showToast({
          type: "SUCCESS",
          title: "Payment successful",
          message: note || `${displayTitle} completed successfully.`,
          duration: 3000,
        });
      } else {
        showToast({
          type: "ERROR",
          title: "Payment not completed",
          message: note || "The payment did not complete successfully.",
          duration: 5000,
        });
      }

      const returnTo = String(params.returnTo || ROUTES.tabs.payments);

      router.replace({
        pathname: returnTo as any,
        params: {
          deposited: kind === "success" ? "1" : "0",
          payment_success: kind === "success" ? "1" : "0",
          payment_failed: kind === "failed" ? "1" : "0",
          amount: cleanAmount,
          phone: displayPhone,
          purpose,
          reference: accountReference,
          groupId: params.groupId || "",
          notice: note,
          tx_id: String(tx?.id || ""),
          tx_status: String(tx?.status || ""),
          checkout_request_id: tx?.checkout_request_id || "",
          mpesa_receipt_number: tx?.mpesa_receipt_number || "",
          allocation_status: tx?.allocation_status || "",
          result_code: String(tx?.result_code || ""),
          result_desc: tx?.result_desc || "",
        },
      });
    },
    [
      accountReference,
      cleanAmount,
      displayPhone,
      displayTitle,
      params.groupId,
      params.returnTo,
      purpose,
      showToast,
    ]
  );

  const handleTerminalResult = useCallback(
    async (tx: MpesaTransaction) => {
      if (!mountedRef.current) return;

      if (shouldRedirectAsCompleted(tx)) {
        redirectToReturn(tx, "success", "Payment successful.");
        return;
      }

      if (isSuccessfulTxStatus(tx.status)) {
        try {
          setStatusText("Finalizing...");
          const finalized = await pollMyMpesaTransactionById(tx.id, {
            intervalMs: 3000,
            timeoutMs: 60000,
            stopOnAllocated: true,
          });

          if (!mountedRef.current) return;

          if (shouldRedirectAsCompleted(finalized)) {
            redirectToReturn(finalized, "success", "Payment successful.");
            return;
          }

          if (isSuccessfulTxStatus(finalized.status)) {
            redirectToReturn(finalized, "success", "Payment successful.");
            return;
          }

          if (isFailedTxStatus(finalized.status)) {
            redirectToReturn(finalized, "failed", getFailureMessage(finalized));
            return;
          }
        } catch {
          redirectToReturn(tx, "success", "Payment successful.");
          return;
        }
      }

      if (isFailedTxStatus(tx.status)) {
        redirectToReturn(tx, "failed", getFailureMessage(tx));
        return;
      }

      setStatusText("Still waiting...");
    },
    [redirectToReturn]
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
        const msg = getApiErrorMessage(meRes.reason);
        setError(msg);
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(getApiErrorMessage(e));
    }
  }, [params.amount, params.phone]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      redirectedRef.current = false;

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

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      setChecking(true);
      setError("");
      setStatusText("Sending...");

      const res = await mpesaStkPush({
        phone: displayPhone,
        amount: cleanAmount,
        purpose,
        reference: accountReference,
        narration,
      });

      if (!mountedRef.current) return;

      if (!res.tx?.id) {
        throw new Error("Transaction id was not returned by the backend.");
      }

      setStatusText("Waiting for confirmation...");

      const txAfterCallback = await pollMyMpesaTransactionById(res.tx.id, {
        intervalMs: 3000,
        timeoutMs: 120000,
        stopOnAllocated: false,
      });

      if (!mountedRef.current) return;
      await handleTerminalResult(txAfterCallback);
    } catch (e: any) {
      if (!mountedRef.current) return;
      const msg = getApiErrorMessage(e);
      setError(msg);
      setStatusText("");
      showToast({
        type: "ERROR",
        title: "Payment request failed",
        message: msg,
        duration: 5000,
      });
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
    handleTerminalResult,
    narration,
    purpose,
    showToast,
  ]);

  const checkExistingManualPayment = useCallback(async () => {
    if (!canManualCheck) return;

    try {
      setChecking(true);
      setError("");
      setStatusText("Checking...");

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
        setStatusText("Not found yet.");
        showToast({
          type: "INFO",
          title: "Payment not found yet",
          message: "We have not matched your paybill payment yet.",
          duration: 3200,
        });
        return;
      }

      if (isPendingTxStatus(existing.status)) {
        setStatusText("Still pending...");
        showToast({
          type: "INFO",
          title: "Payment still pending",
          message: "Your paybill payment is still being processed.",
          duration: 3200,
        });
        return;
      }

      await handleTerminalResult(existing);
    } catch (e: any) {
      if (!mountedRef.current) return;
      const msg = getApiErrorMessage(e);
      setError(msg);
      setStatusText("");
      showToast({
        type: "ERROR",
        title: "Check failed",
        message: msg,
        duration: 5000,
      });
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
    handleTerminalResult,
    purpose,
    showToast,
  ]);

  const handleManualPaid = useCallback(async () => {
    if (!canManualCheck) return;

    try {
      setChecking(true);
      setError("");
      setStatusText("Waiting for confirmation...");

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
        setStatusText("Not found yet.");
        showToast({
          type: "INFO",
          title: "Payment not found yet",
          message: "We are still waiting for the paybill payment to appear.",
          duration: 3200,
        });
        return;
      }

      await handleTerminalResult(tx);
    } catch (e: any) {
      if (!mountedRef.current) return;
      const msg = getApiErrorMessage(e);
      setError(msg);
      setStatusText("");
      showToast({
        type: "ERROR",
        title: "Manual confirmation failed",
        message: msg,
        duration: 5000,
      });
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
    handleTerminalResult,
    purpose,
    showToast,
  ]);

  const handleCancel = useCallback(() => {
    const returnTo = String(params.returnTo || ROUTES.tabs.payments);
    router.replace(returnTo as any);
  }, [params.returnTo]);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.mpesa} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.page}>
          <EmptyState
            title="Not signed in"
            subtitle="Please login to continue."
            actionLabel="Go to Login"
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{displayTitle}</Text>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {statusText ? (
          <Card style={styles.noticeCard}>
            <Text style={styles.noticeText}>{statusText}</Text>
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
              STK
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (!paybillEnabled) {
                Alert.alert("Paybill unavailable", "Manual paybill is not enabled.");
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
              title={submitting || checking ? "Please wait..." : "Pay"}
              onPress={handleSubmit}
              disabled={!canSubmit}
            />
          ) : (
            <View style={styles.paybillBox}>
              <View style={styles.paybillRow}>
                <Text style={styles.paybillLabel}>Business No</Text>
                <Text style={styles.paybillValue}>
                  {paybillEnabled ? paybillNumber : "Not set"}
                </Text>
              </View>

              <View style={styles.paybillRow}>
                <Text style={styles.paybillLabel}>Account No</Text>
                <Text style={styles.paybillValue}>{accountReference || "—"}</Text>
              </View>

              <Button
                title={checking ? "Please wait..." : "I Have Paid"}
                onPress={handleManualPaid}
                disabled={!canManualCheck}
              />

              <TouchableOpacity
                disabled={checking}
                onPress={checkExistingManualPayment}
                style={styles.inlineAction}
              >
                <Text style={styles.inlineActionText}>Check Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        <TouchableOpacity onPress={handleCancel} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    ...P.page,
  },
  content: {
    ...P.content,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  header: {
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONT.bold,
    fontSize: 24,
    color: COLORS.text,
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
  },
  noticeText: {
    ...TYPE.subtext,
    color: COLORS.text,
    textAlign: "center",
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
    gap: SPACING.sm,
  },
  paybillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: 4,
  },
  paybillLabel: {
    ...TYPE.subtext,
    color: COLORS.textMuted,
  },
  paybillValue: {
    ...TYPE.body,
    color: COLORS.text,
    fontFamily: FONT.bold,
  },
  inlineAction: {
    marginTop: SPACING.xs,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  inlineActionText: {
    color: COLORS.mpesa,
    fontFamily: FONT.medium,
    fontSize: 14,
  },
  backBtn: {
    marginTop: SPACING.md,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtnText: {
    color: COLORS.text,
    fontFamily: FONT.medium,
    fontSize: 14,
  },
});