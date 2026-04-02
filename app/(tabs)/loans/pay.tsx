// app/(tabs)/loans/pay.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getSessionUser } from "@/services/session";

function normalizePhone(phone: string) {
  const p = String(phone || "").trim().replace(/\s+/g, "");
  if (p.startsWith("+254")) return `0${p.slice(4)}`;
  if (p.startsWith("254")) return `0${p.slice(3)}`;
  return p;
}

function isValidPhone(phone: string) {
  return /^(07|01)\d{8}$/.test(phone);
}

function cleanAmount(v: string) {
  return (v || "").replace(/[^\d.]/g, "");
}

export default function PayLoanScreen() {
  const params = useLocalSearchParams<{
    loan?: string;
    id?: string;
    amount?: string;
    due?: string;
  }>();

  const loanId = Number(params.loan ?? params.id ?? 0);

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(
    cleanAmount(String(params.amount ?? params.due ?? ""))
  );

  useEffect(() => {
    (async () => {
      try {
        const user = await getSessionUser();
        if (user?.phone) {
          setPhone(normalizePhone(user.phone));
        }
      } catch {}
    })();
  }, []);

  const cleanPhone = useMemo(() => normalizePhone(phone), [phone]);
  const cleanAmt = useMemo(() => cleanAmount(amount), [amount]);

  const canSubmit = useMemo(() => {
    return (
      isValidPhone(cleanPhone) &&
      Number(cleanAmt) > 0 &&
      Number.isFinite(loanId) &&
      loanId > 0
    );
  }, [cleanPhone, cleanAmt, loanId]);

  const handlePay = () => {
    if (!canSubmit) return;

    router.push({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        title: "Support Repayment",
        purpose: "LOAN_REPAYMENT",
        reference: `loan${loanId}`,
        narration: `Support repayment (Support#${loanId})`,
        amount: cleanAmt,
        phone: cleanPhone,
        returnTo: ROUTES.dynamic.loanDetail(loanId),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroGlowThree} />

          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.heroTag}>SUPPORT REPAYMENT</Text>
              <Text style={styles.title}>Continue support repayment</Text>
              <Text style={styles.subtitle}>
                Enter the phone number and amount you want to contribute toward
                this support.
              </Text>
            </View>

            <View style={styles.heroIconWrap}>
              <Ionicons name="cash-outline" size={22} color={COLORS.white} />
            </View>
          </View>

          <View style={styles.heroMiniWrap}>
            <View style={styles.heroMiniPill}>
              <Ionicons name="document-text-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroMiniText}>Support #{loanId || "—"}</Text>
            </View>

            <View style={styles.heroMiniPill}>
              <Ionicons name="wallet-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroMiniText}>
                {cleanAmt ? `KES ${Number(cleanAmt).toLocaleString("en-KE")}` : "Enter amount"}
              </Text>
            </View>
          </View>
        </View>

        <Card style={styles.card}>
          <View style={styles.cardGlowPrimary} />
          <View style={styles.cardGlowAccent} />

          <Input
            label="Phone number"
            value={phone}
            onChangeText={(v) => setPhone(normalizePhone(v))}
            placeholder="07XXXXXXXX"
            keyboardType="phone-pad"
          />

          <Input
            label="Amount"
            value={amount}
            onChangeText={(v) => setAmount(cleanAmount(v))}
            placeholder="500"
            keyboardType="numeric"
          />

          <View style={styles.helperBox}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="rgba(255,255,255,0.82)"
            />
            <Text style={styles.helperText}>
              You will continue to the payment screen to complete this support
              repayment.
            </Text>
          </View>

          <View style={{ height: SPACING.lg }} />

          <Button
            title="Continue"
            onPress={handlePay}
            disabled={!canSubmit}
          />
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  container: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  content: {
    padding: SPACING.lg,
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 240,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    borderRadius: RADIUS.xl || RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
    ...SHADOW.card,
  },

  heroGlowOne: {
    position: "absolute",
    right: -28,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.09)",
  },

  heroGlowTwo: {
    position: "absolute",
    left: -20,
    bottom: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  heroGlowThree: {
    position: "absolute",
    right: 30,
    bottom: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#DFFFE8",
    fontSize: 11,
    fontFamily: FONT.bold,
    marginBottom: 12,
  },

  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 20,
    color: "#FFFFFF",
  },

  subtitle: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.85)",
  },

  heroMiniWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: SPACING.md,
  },

  heroMiniPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroMiniText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: "#FFFFFF",
  },

  card: {
    position: "relative",
    overflow: "hidden",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    ...SHADOW.card,
  },

  cardGlowPrimary: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  cardGlowAccent: {
    position: "absolute",
    bottom: -25,
    left: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(236,251,255,0.06)",
  },

  helperBox: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },

  helperText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.82)",
  },
});