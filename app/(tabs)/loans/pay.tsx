// app/(tabs)/loans/pay.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";
import {
  buildLoanRepaymentNarration,
  buildLoanRepaymentReference,
} from "@/services/loans";
import { getSessionUser } from "@/services/session";

type SpaceTone = "savings" | "merry" | "groups" | "support";

function getSpaceTonePalette(tone: SpaceTone) {
  const map = {
    savings: {
      card: "rgba(29, 196, 182, 0.22)",
      border: "rgba(129, 244, 231, 0.15)",
      iconBg: "rgba(220, 255, 250, 0.75)",
      icon: "#0B6A80",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
    merry: {
      card: "rgba(98, 192, 98, 0.23)",
      border: "rgba(194, 255, 188, 0.16)",
      iconBg: "rgba(236, 255, 235, 0.76)",
      icon: "#379B4A",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
    groups: {
      card: "rgba(49, 180, 217, 0.22)",
      border: "rgba(189, 244, 255, 0.15)",
      iconBg: "rgba(236, 251, 255, 0.76)",
      icon: "#0A6E8A",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
    support: {
      card: "rgba(52, 198, 191, 0.22)",
      border: "rgba(195, 255, 250, 0.16)",
      iconBg: "rgba(236, 255, 252, 0.76)",
      icon: "#148C84",
      chip: "rgba(255,255,255,0.14)",
      amountBg: "rgba(255,255,255,0.10)",
    },
  };

  return map[tone];
}

const UI = {
  page: "#062C49",
  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.88)",
  textMuted: "rgba(255,255,255,0.72)",
  mint: "#8CF0C7",
  aqua: "#0CC0B7",
  careGreen: "#197D71",
  glassStrong: "rgba(255,255,255,0.14)",
  border: "rgba(255,255,255,0.12)",
  dangerCard: "rgba(220,53,69,0.18)",
};

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
  return String(v || "").replace(/[^\d.]/g, "");
}

function toPositiveNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatKES(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "Enter amount";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default function PayLoanScreen() {
  const params = useLocalSearchParams<{
    loan?: string;
    id?: string;
    loanId?: string;
    borrower?: string;
    borrowerId?: string;
    borrower_user_id?: string;
    userId?: string;
    amount?: string;
    due?: string;
    outstanding?: string;
  }>();

  const palette = getSpaceTonePalette("support");

  const loanId = useMemo(() => {
    return toPositiveNumber(params.loan ?? params.loanId ?? params.id ?? 0);
  }, [params.id, params.loan, params.loanId]);

  const borrowerUserId = useMemo(() => {
    return toPositiveNumber(
      params.borrower_user_id ??
        params.borrowerId ??
        params.borrower ??
        params.userId ??
        0
    );
  }, [
    params.borrower,
    params.borrowerId,
    params.borrower_user_id,
    params.userId,
  ]);

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(
    cleanAmount(String(params.amount ?? params.due ?? params.outstanding ?? ""))
  );
  const [loadingPhone, setLoadingPhone] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const user = await getSessionUser();
        if (!active) return;

        if (user?.phone) {
          setPhone(normalizePhone(user.phone));
        }
      } catch {
      } finally {
        if (active) setLoadingPhone(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const cleanPhone = useMemo(() => normalizePhone(phone), [phone]);
  const cleanAmt = useMemo(() => cleanAmount(amount), [amount]);

  const amountValue = useMemo(() => formatKES(cleanAmt), [cleanAmt]);

  const canSubmit = useMemo(() => {
    return (
      isValidPhone(cleanPhone) &&
      Number(cleanAmt) > 0 &&
      Number.isFinite(loanId) &&
      loanId > 0 &&
      Number.isFinite(borrowerUserId) &&
      borrowerUserId > 0
    );
  }, [cleanPhone, cleanAmt, loanId, borrowerUserId]);

  const validationMessage = useMemo(() => {
    if (!loanId) return "Support record is missing.";
    if (!borrowerUserId) return "Borrower information is missing.";
    if (!cleanPhone) return "Enter your M-Pesa phone number.";
    if (!isValidPhone(cleanPhone)) return "Enter a valid Safaricom number.";
    if (!cleanAmt || Number(cleanAmt) <= 0) return "Enter a valid amount.";
    return "";
  }, [loanId, borrowerUserId, cleanPhone, cleanAmt]);

  const handleBack = () => {
    const canGoBack =
      typeof (router as any)?.canGoBack === "function"
        ? (router as any).canGoBack()
        : false;

    if (canGoBack) {
      router.back();
      return;
    }

    if (loanId > 0) {
      router.replace(ROUTES.dynamic.loanDetail(loanId) as any);
      return;
    }

    router.replace(ROUTES.tabs.loans as any);
  };

  const handlePay = () => {
    if (!canSubmit) return;

    router.push({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        title: "Support Repayment",
        source: "loan",
        purpose: "LOAN_REPAYMENT",
        loanId: String(loanId),
        borrowerUserId: String(borrowerUserId),
        reference: buildLoanRepaymentReference(borrowerUserId),
        narration: buildLoanRepaymentNarration({
          borrowerUserId,
          loanId,
        }),
        amount: cleanAmt,
        phone: cleanPhone,
        editableAmount: "true",
        returnTo: ROUTES.dynamic.loanDetail(loanId),
      },
    });
  };

  if (loadingPhone) {
    return <SafeAreaView style={styles.safe} edges={["top", "bottom"]} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroGlowThree} />

          <View style={styles.heroTopRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleBack}
              style={[styles.heroBackButton, { backgroundColor: palette.chip }]}
            >
              <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.heroBadge}>
              <Ionicons name="heart-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>MEMBER SUPPORT</Text>
            </View>
          </View>

          <View style={styles.heroHeader}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.heroTitle}>Continue support repayment</Text>
              <Text style={styles.heroSubtitle}>
                Enter the phone number and amount you want to pay. Any amount is
                accepted, and if you pay more than the remaining balance, the
                extra goes to your savings automatically.
              </Text>
            </View>

            <View
              style={[
                styles.heroIconWrap,
                { backgroundColor: palette.iconBg },
              ]}
            >
              <Ionicons name="cash-outline" size={22} color={palette.icon} />
            </View>
          </View>

          <View style={styles.heroMiniWrap}>
            <View
              style={[
                styles.heroMiniPill,
                { backgroundColor: palette.amountBg },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.heroMiniText}>Support #{loanId || "—"}</Text>
            </View>

            <View
              style={[
                styles.heroMiniPill,
                { backgroundColor: palette.amountBg },
              ]}
            >
              <Ionicons name="person-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroMiniText}>
                Borrower #{borrowerUserId || "—"}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.heroAmountRow,
              { backgroundColor: palette.amountBg },
            ]}
          >
            <Text style={styles.heroAmountLabel}>Amount</Text>
            <Text style={styles.heroAmountValue}>{amountValue}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.cardGlowPrimary} />
          <View style={styles.cardGlowAccent} />

          <Text style={styles.sectionTitle}>Payment details</Text>

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
            <View
              style={[
                styles.helperIconWrap,
                { backgroundColor: palette.iconBg },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={palette.icon}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.helperTitle}>How this payment works</Text>
              <Text style={styles.helperText}>
                This repayment is sent through the central payment screen using
                your borrower reference. Partial payments reduce the balance,
                and overpayments move the extra amount to your savings.
              </Text>
            </View>
          </View>

          {!canSubmit && validationMessage ? (
            <View style={styles.errorCard}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.errorText}>{validationMessage}</Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Button
              title="Continue"
              onPress={handlePay}
              disabled={!canSubmit}
            />
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.page,
  },

  page: {
    flex: 1,
    backgroundColor: UI.page,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.page,
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
    borderRadius: 26,
    padding: 20,
    marginBottom: SPACING.lg,
    borderWidth: 1,
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

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  heroBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  heroBadgeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    letterSpacing: 0.8,
  },

  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  heroTitle: {
    fontFamily: FONT.bold,
    fontSize: 21,
    lineHeight: 28,
    color: "#FFFFFF",
  },

  heroSubtitle: {
    marginTop: 8,
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 21,
    color: UI.textSoft,
  },

  heroMiniWrap: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    flexWrap: "wrap",
  },

  heroMiniPill: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  heroMiniText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  heroAmountRow: {
    marginTop: 14,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  heroAmountLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: FONT.medium,
  },

  heroAmountValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONT.bold,
  },

  formCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: UI.glassStrong,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 24,
    padding: 18,
  },

  cardGlowPrimary: {
    position: "absolute",
    top: -40,
    right: -16,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  cardGlowAccent: {
    position: "absolute",
    left: -20,
    bottom: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(12,192,183,0.06)",
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: FONT.bold,
    marginBottom: 14,
  },

  helperBox: {
    marginTop: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },

  helperIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  helperTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  helperText: {
    color: UI.textSoft,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
  },

  errorCard: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: UI.dangerCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.medium,
  },

  actionRow: {
    marginTop: 18,
  },
});