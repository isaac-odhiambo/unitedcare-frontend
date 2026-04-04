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

const PAGE_BG = "#062C49";
const SURFACE = "rgba(255,255,255,0.96)";
const SURFACE_SOFT = "rgba(248,250,252,0.92)";
const INNER_BORDER = "rgba(15, 23, 42, 0.06)";
const TEXT_MAIN = "#0F172A";
const TEXT_SOFT = "#64748B";

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
        ? `GROUP${parsedGroupId}`
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
      return "Savings Contribution";
    default:
      return "Payment";
  }
}

function getFailureMessage(tx?: Partial<MpesaTransaction> | null) {
  if (!tx) return "Payment was not completed.";
  if (String(tx?.status || "").toUpperCase() === "CANCELLED") {
    return tx?.result_desc || "Payment was cancelled.";
  }
  return tx?.result_desc || "Payment failed.";
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
  const paymentRunRef = useRef(0);
  const screenSessionRef = useRef(0);

  const resetUiState = useCallback(() => {
    paymentRunRef.current += 1;
    if (!mountedRef.current) return;
    setError("");
    setStatusText("");
    setSubmitting(false);
    setChecking(false);
    redirectedRef.current = false;
  }, []);

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

  // ✅ PAYBILL → use group code + user id (UN2)
  if (method === "PAYBILL" && purpose === "GROUP_CONTRIBUTION") {
    const groupCode = (params as any)?.groupCode || (params as any)?.payment_code;
    const userId = getUserId(user);

    if (groupCode && userId) {
      return `${String(groupCode).toUpperCase()}${userId}`;
    }
  }

  // ✅ fallback (STK and others)
  return buildFallbackReference(purpose, user, params.groupId);
}, [params.reference, params.groupId, purpose, user, method]);

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

      if (isSuccessfulTxStatus(tx.status)) {
        setStatusText("Payment received ✅");
        redirectToReturn(tx, "success", "Payment successful.");
        return;
      }

      if (isFailedTxStatus(tx.status)) {
        redirectToReturn(tx, "failed", getFailureMessage(tx));
        return;
      }

      if (isPendingTxStatus(tx.status)) {
        setStatusText("Still waiting for confirmation...");
        return;
      }

      setStatusText("Still waiting for confirmation...");
    },
    [redirectToReturn]
  );

  const load = useCallback(async () => {
    try {
      setError("");
      setStatusText("");

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
      screenSessionRef.current += 1;
      paymentRunRef.current += 1;

      const sessionId = screenSessionRef.current;

      const run = async () => {
        try {
          setLoading(true);
          setError("");
          setStatusText("");
          setSubmitting(false);
          setChecking(false);
          await load();
        } finally {
          if (mountedRef.current && screenSessionRef.current === sessionId) {
            setLoading(false);
          }
        }
      };

      run();

      return () => {
        paymentRunRef.current += 1;
        mountedRef.current = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      paymentRunRef.current += 1;
      setStatusText("");
      setSubmitting(false);
      setChecking(false);
      await load();
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [load]);

  const setMethodSafely = useCallback(
    (nextMethod: DepositMethod) => {
      resetUiState();
      setMethod(nextMethod);
    },
    [resetUiState]
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const runId = paymentRunRef.current + 1;
    paymentRunRef.current = runId;

    try {
      if (!mountedRef.current) return;

      setError("");
      setStatusText("Sending...");
      setSubmitting(true);
      setChecking(true);
      redirectedRef.current = false;

      const res = await mpesaStkPush({
        phone: displayPhone,
        amount: cleanAmount,
        purpose,
        reference: accountReference,
        narration,
      });

      if (!mountedRef.current || paymentRunRef.current !== runId) return;

      if (!res.tx?.id) {
        throw new Error("Transaction id was not returned by the backend.");
      }

      setStatusText("Waiting for confirmation...");

      const txAfterCallback = await pollMyMpesaTransactionById(res.tx.id, {
        intervalMs: 3000,
        timeoutMs: 120000,
        stopOnAllocated: false,
      });

      if (!mountedRef.current || paymentRunRef.current !== runId) return;

      await handleTerminalResult(txAfterCallback);
    } catch (e: any) {
      if (!mountedRef.current || paymentRunRef.current !== runId) return;

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
      if (mountedRef.current && paymentRunRef.current === runId) {
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

    const runId = paymentRunRef.current + 1;
    paymentRunRef.current = runId;

    try {
      if (!mountedRef.current) return;

      setError("");
      setChecking(true);
      setSubmitting(false);
      setStatusText("Checking...");
      redirectedRef.current = false;

      const existing = await findLatestMatchingMyMpesaTransaction({
        purpose,
        reference: accountReference,
        payment_method: "PAYBILL",
        channel: "C2B",
        amount: cleanAmount,
        phone: displayPhone,
      });

      if (!mountedRef.current || paymentRunRef.current !== runId) return;

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
      if (!mountedRef.current || paymentRunRef.current !== runId) return;

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
      if (mountedRef.current && paymentRunRef.current === runId) {
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

    const runId = paymentRunRef.current + 1;
    paymentRunRef.current = runId;

    try {
      if (!mountedRef.current) return;

      setError("");
      setChecking(true);
      setSubmitting(false);
      setStatusText("Waiting for confirmation...");
      redirectedRef.current = false;

      const tx = await pollForMatchingManualPaybill({
        purpose,
        reference: accountReference,
        totalAmountPaid: cleanAmount,
        phone: displayPhone,
        intervalMs: 5000,
        timeoutMs: 300000,
      });

      if (!mountedRef.current || paymentRunRef.current !== runId) return;

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
      if (!mountedRef.current || paymentRunRef.current !== runId) return;

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
      if (mountedRef.current && paymentRunRef.current === runId) {
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
    paymentRunRef.current += 1;
    if (mountedRef.current) {
      setError("");
      setStatusText("");
      setSubmitting(false);
      setChecking(false);
    }
    redirectedRef.current = false;

    const returnTo = String(params.returnTo || ROUTES.tabs.payments);
    router.replace(returnTo as any);
  }, [params.returnTo]);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8CF0C7" />
          <Text style={styles.loadingText}>Preparing payment...</Text>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8CF0C7"
            colors={["#8CF0C7", "#0CC0B7"]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.header}>
          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.subtitle}>
            Choose how you want to complete your contribution.
          </Text>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {statusText ? (
          <Card style={styles.noticeCard}>
            <View style={styles.noticeGlow} />
            <Text style={styles.noticeText}>{statusText}</Text>
          </Card>
        ) : null}

        <View style={styles.switchRow}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setMethodSafely("STK")}
            style={[
              styles.switchBtn,
              method === "STK" ? styles.switchBtnActive : null,
            ]}
          >
            <Ionicons
              name="flash-outline"
              size={16}
              color={method === "STK" ? COLORS.white : COLORS.mpesa}
            />
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
              setMethodSafely("PAYBILL");
            }}
            style={[
              styles.switchBtn,
              method === "PAYBILL" ? styles.switchBtnActive : null,
            ]}
          >
            <Ionicons
              name="business-outline"
              size={16}
              color={method === "PAYBILL" ? COLORS.white : COLORS.mpesa}
            />
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
          <View style={styles.cardGlow} />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              if (statusText) setStatusText("");
            }}
            placeholder="07XXXXXXXX"
            placeholderTextColor={COLORS.placeholder}
            keyboardType="phone-pad"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => {
              setAmount(sanitizeAmount(v));
              if (statusText) setStatusText("");
            }}
            placeholder="1000"
            placeholderTextColor={COLORS.placeholder}
            keyboardType="numeric"
            style={styles.input}
          />

          <View style={styles.referenceBox}>
            <Text style={styles.referenceLabel}>Reference</Text>
            <Text style={styles.referenceValue}>{accountReference || "—"}</Text>
          </View>

          {method === "STK" ? (
            <Button
              title={submitting || checking ? "Please wait..." : "Pay now"}
              onPress={handleSubmit}
              disabled={!canSubmit}
              leftIcon={
                submitting || checking ? undefined : (
                  <Ionicons
                    name="arrow-forward-outline"
                    size={18}
                    color={COLORS.white}
                  />
                )
              }
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
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    ...P.content,
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
    color: "rgba(255,255,255,0.75)",
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

  header: {
    marginBottom: SPACING.md,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 24,
    color: COLORS.white,
  },

  subtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  errorCard: {
    marginBottom: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "#FFF4F4",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },

  errorText: {
    flex: 1,
    ...TYPE.subtext,
    color: COLORS.danger,
  },

  noticeCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: INNER_BORDER,
    borderRadius: RADIUS.xl,
    backgroundColor: SURFACE,
    shadowColor: "#001B2F",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  noticeGlow: {
    position: "absolute",
    right: -18,
    top: -12,
    width: 90,
    height: 90,
    borderRadius: 999,
    backgroundColor: "rgba(12,106,128,0.05)",
  },

  noticeText: {
    ...TYPE.subtext,
    color: TEXT_MAIN,
    textAlign: "center",
    fontFamily: FONT.medium,
  },

  switchRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  switchBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: INNER_BORDER,
    borderRadius: RADIUS.xl,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: SURFACE,
    shadowColor: "#001B2F",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  switchBtnActive: {
    borderColor: "rgba(22, 163, 74, 0.18)",
    backgroundColor: COLORS.mpesa,
  },

  switchBtnText: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: COLORS.mpesa,
  },

  switchBtnTextActive: {
    color: COLORS.white,
    fontFamily: FONT.bold,
  },

  formCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: INNER_BORDER,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    shadowColor: "#001B2F",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  cardGlow: {
    position: "absolute",
    right: -18,
    top: -18,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "rgba(12,106,128,0.05)",
  },

  label: {
    ...TYPE.label,
    marginBottom: 8,
    color: TEXT_MAIN,
  },

  input: {
    ...P.input,
    height: 52,
    marginBottom: SPACING.md,
    backgroundColor: SURFACE_SOFT,
    borderColor: INNER_BORDER,
  },

  referenceBox: {
    marginBottom: SPACING.md,
    backgroundColor: SURFACE_SOFT,
    borderWidth: 1,
    borderColor: INNER_BORDER,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  referenceLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: TEXT_SOFT,
  },

  referenceValue: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 14,
    color: TEXT_MAIN,
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
    paddingVertical: 6,
    paddingHorizontal: 4,
  },

  paybillLabel: {
    ...TYPE.subtext,
    color: TEXT_SOFT,
  },

  paybillValue: {
    ...TYPE.body,
    color: TEXT_MAIN,
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
    color: COLORS.white,
    fontFamily: FONT.medium,
    fontSize: 14,
  },
});