import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

type LoanGuarantor = {
  id: number;
  loan: number;
  guarantor: number;
  accepted: boolean;
  accepted_at?: string | null;
  reserved_amount?: string;
};

async function addGuarantor(payload: {
  loan: number;
  guarantor: number;
}): Promise<{ message: string; guarantor: LoanGuarantor }> {
  const res = await api.post("/loans/loan/add-guarantor/", payload);
  return res.data;
}

function digitsOnly(v: string) {
  return v.replace(/[^\d]/g, "");
}

export default function AddGuarantorScreen() {
  const params = useLocalSearchParams<{ loanId?: string }>();

  const [loanId, setLoanId] = useState("");
  const [guarantorId, setGuarantorId] = useState("");
  const [saving, setSaving] = useState(false);

  // If route param exists, auto-fill
  useEffect(() => {
    if (params?.loanId) setLoanId(String(params.loanId));
  }, [params?.loanId]);

  const canSubmit = useMemo(() => {
    return !!loanId.trim() && !!guarantorId.trim() && !saving;
  }, [loanId, guarantorId, saving]);

  const submit = async () => {
    const lId = Number(loanId);
    const gId = Number(guarantorId);

    if (!Number.isFinite(lId) || lId <= 0) {
      Alert.alert("Invalid Loan", "Enter a valid Loan ID.");
      return;
    }
    if (!Number.isFinite(gId) || gId <= 0) {
      Alert.alert("Invalid Guarantor", "Enter a valid Guarantor User ID.");
      return;
    }

    try {
      setSaving(true);
      const res = await addGuarantor({ loan: lId, guarantor: gId });

      Alert.alert(
        "Request Sent",
        res?.message || "Guarantor request sent successfully.",
        [
          { text: "Back to Loans", onPress: () => router.replace("/(tabs)/loans") },
          { text: "Add Another", style: "cancel", onPress: () => setGuarantorId("") },
        ]
      );
    } catch (e: any) {
      Alert.alert("Failed", getErrorMessage(e));
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
            <Text style={styles.h1}>Add Guarantor</Text>
            <Text style={styles.h2}>Send a guarantee request to another member</Text>
          </View>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Guarantee Request</Text>
            <Text style={styles.cardSub}>
              Enter the Loan ID and the Guarantor User ID. The guarantor will see the request
              under “Guarantees” and can Accept/Reject.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Loan ID (e.g. 12)"
              value={loanId}
              onChangeText={(t) => setLoanId(digitsOnly(t))}
              keyboardType="number-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Guarantor User ID (e.g. 45)"
              value={guarantorId}
              onChangeText={(t) => setGuarantorId(digitsOnly(t))}
              keyboardType="number-pad"
            />

            <View style={styles.tip}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.tipText}>
                When the guarantor accepts, the backend may reserve a portion of their savings
                as security for this loan (depending on your rules).
              </Text>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && { opacity: 0.6 }]}
            onPress={submit}
            disabled={!canSubmit}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color={COLORS.white} />
                <Text style={styles.submitText}>Send Request</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => router.back()}
            activeOpacity={0.9}
          >
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