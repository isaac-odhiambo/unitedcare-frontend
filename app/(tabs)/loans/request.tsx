import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Loan = {
  id: number;
  borrower: number;
  merry: number | null;
  group: number | null;
  product: number;
  principal: string;
  term_weeks: number;
  status: string;
  total_payable?: string;
  total_paid?: string;
  outstanding_balance?: string;
  security_target?: string;
};

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

function sanitizeNumberText(v: string) {
  // keep digits only
  return v.replace(/[^\d]/g, "");
}

function sanitizeDecimalText(v: string) {
  // allow digits + one dot
  let x = v.replace(/[^\d.]/g, "");
  const parts = x.split(".");
  if (parts.length <= 1) return x;
  return parts[0] + "." + parts.slice(1).join("");
}

export default function RequestLoanScreen() {
  const [context, setContext] = useState<"merry" | "group">("merry");

  const [merryId, setMerryId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [productId, setProductId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [termWeeks, setTermWeeks] = useState("");

  const [saving, setSaving] = useState(false);

  const isMerry = context === "merry";

  const isValidContext = useMemo(() => {
    if (isMerry) return !!merryId.trim();
    return !!groupId.trim();
  }, [isMerry, merryId, groupId]);

  const canSubmit = useMemo(() => {
    return (
      isValidContext &&
      !!productId.trim() &&
      !!principal.trim() &&
      !!termWeeks.trim()
    );
  }, [isValidContext, productId, principal, termWeeks]);

  const submit = async () => {
    if (!isValidContext) {
      Alert.alert("Missing Context", isMerry ? "Enter Merry ID." : "Enter Group ID.");
      return;
    }

    const pId = Number(productId);
    const tWeeks = Number(termWeeks);

    if (!Number.isFinite(pId) || pId <= 0) {
      Alert.alert("Invalid Product", "Enter a valid Loan Product ID.");
      return;
    }
    if (!principal.trim() || Number(principal) <= 0) {
      Alert.alert("Invalid Principal", "Enter a principal amount greater than 0.");
      return;
    }
    if (!Number.isFinite(tWeeks) || tWeeks <= 0) {
      Alert.alert("Invalid Term", "Term weeks must be greater than 0.");
      return;
    }

    const payload: any = {
      product: pId,
      principal: principal.trim(),
      term_weeks: tWeeks,
    };

    // Exactly one context
    if (isMerry) payload.merry = Number(merryId);
    else payload.group = Number(groupId);

    try {
      setSaving(true);
      const res = await requestLoan(payload);

      Alert.alert(
        "Submitted",
        res?.message || "Loan request submitted successfully.",
        [
          {
            text: "View Loan",
            onPress: () => router.replace(`/(tabs)/loans/${res.loan.id}`),
          },
          {
            text: "Back to Loans",
            style: "cancel",
            onPress: () => router.replace("/(tabs)/loans"),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Request Failed", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

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
            <Text style={styles.h1}>Request Loan</Text>
            <Text style={styles.h2}>Choose context and submit a loan request</Text>
          </View>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Context switch */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Loan Context</Text>
            <Text style={styles.cardSub}>
              Select exactly one: Merry or Group (backend enforces this).
            </Text>

            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segBtn, isMerry && styles.segBtnActive]}
                onPress={() => setContext("merry")}
                activeOpacity={0.9}
              >
                <Ionicons
                  name="repeat-outline"
                  size={16}
                  color={isMerry ? COLORS.white : COLORS.gray}
                />
                <Text style={[styles.segText, isMerry && styles.segTextActive]}>
                  Merry
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segBtn, !isMerry && styles.segBtnActive]}
                onPress={() => setContext("group")}
                activeOpacity={0.9}
              >
                <Ionicons
                  name="people-outline"
                  size={16}
                  color={!isMerry ? COLORS.white : COLORS.gray}
                />
                <Text style={[styles.segText, !isMerry && styles.segTextActive]}>
                  Group
                </Text>
              </TouchableOpacity>
            </View>

            {isMerry ? (
              <TextInput
                style={styles.input}
                placeholder="Merry ID"
                value={merryId}
                onChangeText={(t) => setMerryId(sanitizeNumberText(t))}
                keyboardType="number-pad"
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Group ID"
                value={groupId}
                onChangeText={(t) => setGroupId(sanitizeNumberText(t))}
                keyboardType="number-pad"
              />
            )}
          </View>

          {/* Loan inputs */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Loan Details</Text>

            <TextInput
              style={styles.input}
              placeholder="Loan Product ID"
              value={productId}
              onChangeText={(t) => setProductId(sanitizeNumberText(t))}
              keyboardType="number-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Principal amount (e.g. 25000)"
              value={principal}
              onChangeText={(t) => setPrincipal(sanitizeDecimalText(t))}
              keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
            />

            <TextInput
              style={styles.input}
              placeholder="Term weeks (e.g. 12)"
              value={termWeeks}
              onChangeText={(t) => setTermWeeks(sanitizeNumberText(t))}
              keyboardType="number-pad"
            />

            <View style={styles.tip}>
              <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.tipText}>
                Eligibility (3 months deposits, max 3× savings, etc.) is checked by the backend.
              </Text>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && { opacity: 0.6 }]}
            onPress={submit}
            disabled={!canSubmit || saving}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color={COLORS.white} />
                <Text style={styles.submitText}>Submit Request</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={() => router.back()} activeOpacity={0.9}>
            <Text style={styles.ghostText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },

  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
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

  container: { flex: 1, padding: SPACING.md },

  card: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: FONT.body,
    fontWeight: "900",
    color: COLORS.dark,
    marginBottom: 6,
  },
  cardSub: { color: COLORS.gray, lineHeight: 18, marginBottom: 12 },

  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    marginBottom: 10,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: COLORS.white,
  },
  segBtnActive: { backgroundColor: COLORS.primary },
  segText: { fontWeight: "800", color: COLORS.gray },
  segTextActive: { color: COLORS.white },

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

  tip: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    padding: 12,
    borderRadius: RADIUS.lg,
  },
  tipText: { color: COLORS.dark, lineHeight: 18, flex: 1 },

  submitBtn: {
    marginTop: 4,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  submitText: { color: COLORS.white, fontWeight: "900" },

  ghostBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostText: { color: COLORS.gray, fontWeight: "900" },
});