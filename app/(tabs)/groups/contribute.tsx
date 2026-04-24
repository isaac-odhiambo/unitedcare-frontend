import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ROUTES } from "@/constants/routes";
import { SPACING } from "@/constants/theme";

type Params = {
  id?: string | string[];
  groupId?: string | string[];
  group_id?: string | string[];

  groupCode?: string | string[];
  payment_code?: string | string[];
  userId?: string | string[];

  title?: string | string[];
  subtitle?: string | string[];
  helperText?: string | string[];
  ctaLabel?: string | string[];
  amount?: string | string[];
  amountLabel?: string | string[];
  group_name?: string | string[];
  returnTo?: string | string[];
};

function getFirstParam(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim();
  }
  return String(value ?? "").trim();
}

function getNumericRouteParam(value: unknown): number | null {
  if (Array.isArray(value)) {
    const first = value[0];
    const n = Number(first);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toDisplayAmount(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return "";

  const num = Number(clean.replace(/,/g, ""));
  if (!Number.isFinite(num) || num <= 0) return clean;

  return `KES ${num.toLocaleString()}`;
}

export default function GroupContributeScreen() {
  const params = useLocalSearchParams<Params>();

  const groupId =
    getNumericRouteParam(params.groupId) ??
    getNumericRouteParam(params.group_id) ??
    getNumericRouteParam(params.id);

  const groupCode = useMemo(() => {
    return (
      getFirstParam(params.groupCode) || getFirstParam(params.payment_code)
    ).toUpperCase();
  }, [params.groupCode, params.payment_code]);

  const userId = useMemo(() => {
    return getFirstParam(params.userId);
  }, [params.userId]);

  const title = useMemo(() => {
    return getFirstParam(params.title) || "Group contribution";
  }, [params.title]);

  const subtitle = useMemo(() => {
    return (
      getFirstParam(params.subtitle) ||
      getFirstParam(params.group_name) ||
      "Community space"
    );
  }, [params.subtitle, params.group_name]);

  const helperText = useMemo(() => {
    return (
      getFirstParam(params.helperText) ||
      "Review your contribution and continue to payment."
    );
  }, [params.helperText]);

  const ctaLabel = useMemo(() => {
    return getFirstParam(params.ctaLabel) || "Continue to payment";
  }, [params.ctaLabel]);

  const amountLabel = useMemo(() => {
    const explicit = getFirstParam(params.amountLabel);
    if (explicit) return toDisplayAmount(explicit);

    const rawAmount = getFirstParam(params.amount);
    return toDisplayAmount(rawAmount);
  }, [params.amount, params.amountLabel]);

  const returnTo = useMemo(() => {
    const explicit = getFirstParam(params.returnTo);
    if (explicit) return explicit;

    if (groupId) {
      return ROUTES.dynamic.groupDetail(groupId) as string;
    }

    return ROUTES.tabs.groups as string;
  }, [params.returnTo, groupId]);

  const paymentReference = useMemo(() => {
    if (!groupCode || !userId) return "";
    return `${groupCode}${userId}`.toUpperCase();
  }, [groupCode, userId]);

  const goBack = () => {
    router.replace(returnTo as any);
  };

  const continueToPayment = () => {
    const payload = {
      purpose: "GROUP_CONTRIBUTION",
      title: "Group Contribution",
      groupId: groupId ? String(groupId) : "",
      groupCode,
      payment_code: groupCode,
      userId,
      reference: paymentReference,
      narration: `Group contribution (${paymentReference})`,
      returnTo,
    };

    if (!groupId || !groupCode || !userId || !paymentReference) {
      return;
    }

    router.push({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: payload,
    });
  };

  const canContinue = !!groupId && !!groupCode && !!userId && !!paymentReference;

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.subtitle}>{subtitle}</Text>

          <Text style={styles.helperText}>{helperText}</Text>

          {amountLabel ? (
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Contribution amount</Text>
              <Text style={styles.amountValue}>{amountLabel}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, !canContinue && styles.buttonDisabled]}
            onPress={continueToPayment}
            activeOpacity={0.9}
            disabled={!canContinue}
          >
            <Text style={styles.buttonText}>{ctaLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={goBack}
            activeOpacity={0.9}
          >
            <Text style={styles.secondaryButtonText}>
              {groupId ? "Back to Space" : "Back to Groups"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#062C49",
  },

  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: SPACING.lg,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },

  subtitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },

  helperText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
    lineHeight: 22,
  },

  amountCard: {
    marginTop: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
  },

  amountLabel: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 13,
    marginBottom: 8,
  },

  amountValue: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
  },

  button: {
    marginTop: 28,
    backgroundColor: "#197D71",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  secondaryButton: {
    marginTop: 14,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});