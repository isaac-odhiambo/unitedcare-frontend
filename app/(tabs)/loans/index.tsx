// app/(tabs)/loans/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  getLoanEligibilityPreview,
  getMyGuaranteeRequests,
  getMyLoans,
  Loan,
  LoanEligibilityPreview,
  LoanGuarantor,
} from "@/services/loans";
import {
  canRequestLoan,
  getMe,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type LoanUser = Partial<MeResponse> & Partial<SessionUser>;

const UI = {
  bg: "#F3F8F7",
  surface: "#FFFFFF",
  surfaceSoft: "#F8FCFB",
  border: "#D8E8E4",

  text: "#20313F",
  textSoft: "#5E7282",
  textMuted: "#7E90A0",

  primary: "#0F766E",
  primaryDark: "#115E59",
  primarySoft: "#DFF6F2",

  blue: "#2563EB",
  blueSoft: "#EAF1FF",

  gold: "#D97706",
  goldSoft: "#FFF4E4",

  green: "#15803D",
  greenSoft: "#EAF8EF",

  red: "#DC2626",
  redSoft: "#FDEEEE",
};

function toNum(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtKES(amount?: string | number | null) {
  const n = toNum(amount);
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function getActiveLoan(loans: Loan[]) {
  if (!Array.isArray(loans) || loans.length === 0) return null;

  return (
    loans.find((loan) => {
      const status = String(loan?.status || "").toUpperCase();
      return [
        "PENDING",
        "UNDER_REVIEW",
        "APPROVED",
        "ACTIVE",
        "DISBURSED",
        "DEFAULTED",
      ].includes(status);
    }) || null
  );
}

function HeroCard({
  eligibility,
  activeLoan,
  kycComplete,
  loanAllowed,
  onPrimary,
  onSecondary,
}: {
  eligibility: LoanEligibilityPreview | null;
  activeLoan: Loan | null;
  kycComplete: boolean;
  loanAllowed: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const maxAllowed = toNum(eligibility?.max_allowed);
  const outstanding = toNum(activeLoan?.outstanding_balance);

  const showAvailableAmount =
    !activeLoan && kycComplete && loanAllowed && !!eligibility?.eligible;

  const amount = showAvailableAmount
    ? fmtKES(maxAllowed)
    : activeLoan
      ? fmtKES(outstanding)
      : "KES 0";

  const title = activeLoan
    ? "My Support"
    : !kycComplete
      ? "Complete profile"
      : showAvailableAmount
        ? "Support available"
        : "Member Support";

  const subtitle = activeLoan
    ? "Use the actions below to add support or open details."
    : !kycComplete
      ? "Finish verification to continue."
      : showAvailableAmount
        ? "You can continue from the options below."
        : "Simple support options for members.";

  const primaryLabel = activeLoan
    ? "Pay now"
    : !kycComplete
      ? "Complete profile"
      : showAvailableAmount
        ? "Ask for support"
        : "Open support";

  const secondaryLabel = activeLoan
    ? "Details"
    : !kycComplete
      ? "Profile"
      : "Past activity";

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroGlowOne} />
      <View style={styles.heroGlowTwo} />

      <View style={styles.heroTopRow}>
        <View style={styles.heroBadge}>
          <Ionicons name="heart-outline" size={14} color="#FFFFFF" />
          <Text style={styles.heroBadgeText}>Member Support</Text>
        </View>
      </View>

      <Text style={styles.heroLabel}>{title}</Text>
      <Text style={styles.heroAmount}>{amount}</Text>
      <Text style={styles.heroHelper}>{subtitle}</Text>

      <View style={styles.heroActions}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onPrimary}
          style={styles.heroPrimaryBtn}
        >
          <Text style={styles.heroPrimaryBtnText}>{primaryLabel}</Text>
          <Ionicons name="arrow-forward" size={16} color={UI.primaryDark} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onSecondary}
          style={styles.heroSecondaryBtn}
        >
          <Text style={styles.heroSecondaryBtnText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ActionRow({
  title,
  subtitle,
  icon,
  onPress,
  badge,
  iconTone = "primary",
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: string;
  iconTone?: "primary" | "blue" | "gold" | "green";
}) {
  const toneMap = {
    primary: {
      bg: UI.primarySoft,
      color: UI.primary,
    },
    blue: {
      bg: UI.blueSoft,
      color: UI.blue,
    },
    gold: {
      bg: UI.goldSoft,
      color: UI.gold,
    },
    green: {
      bg: UI.greenSoft,
      color: UI.green,
    },
  };

  const tone = toneMap[iconTone];

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={styles.actionRow}
    >
      <View style={styles.actionLeft}>
        <View
          style={[
            styles.actionIcon,
            {
              backgroundColor: tone.bg,
              borderColor: "rgba(255,255,255,0.55)",
            },
          ]}
        >
          <Ionicons name={icon} size={20} color={tone.color} />
        </View>

        <View style={styles.actionTextWrap}>
          <Text style={styles.actionTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.actionSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionRight}>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}

        <View style={styles.chevronWrap}>
          <Ionicons name="chevron-forward" size={18} color={UI.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function LoansIndexScreen() {
  const [user, setUser] = useState<LoanUser | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [guaranteeRequests, setGuaranteeRequests] = useState<LoanGuarantor[]>(
    []
  );
  const [eligibility, setEligibility] = useState<LoanEligibilityPreview | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, loansRes, guaranteesRes, eligibilityRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getMyLoans(),
          getMyGuaranteeRequests(),
          getLoanEligibilityPreview(),
        ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: LoanUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      if (mergedUser) {
        await saveSessionUser(mergedUser);
      }

      setLoans(
        loansRes.status === "fulfilled" && Array.isArray(loansRes.value)
          ? loansRes.value
          : []
      );

      setGuaranteeRequests(
        guaranteesRes.status === "fulfilled" &&
          Array.isArray(guaranteesRes.value)
          ? guaranteesRes.value
          : []
      );

      setEligibility(
        eligibilityRes.status === "fulfilled"
          ? eligibilityRes.value ?? null
          : null
      );

      let nextError = "";

      if (meRes.status === "rejected") {
        nextError =
          getApiErrorMessage(meRes.reason) || getErrorMessage(meRes.reason);
      } else if (loansRes.status === "rejected") {
        nextError =
          getApiErrorMessage(loansRes.reason) || getErrorMessage(loansRes.reason);
      } else if (guaranteesRes.status === "rejected") {
        nextError =
          getApiErrorMessage(guaranteesRes.reason) ||
          getErrorMessage(guaranteesRes.reason);
      } else if (eligibilityRes.status === "rejected") {
        nextError =
          getApiErrorMessage(eligibilityRes.reason) ||
          getErrorMessage(eligibilityRes.reason);
      }

      setError(nextError);
    } catch (e: any) {
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        try {
          setLoading(true);
          await load();
        } finally {
          setLoading(false);
        }
      };

      run();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const kycComplete = isKycComplete(user);
  const loanAllowed = canRequestLoan(user);
  const activeLoan = useMemo(() => getActiveLoan(loans), [loans]);

  const guaranteeCount = useMemo(() => {
    return guaranteeRequests.filter((item) => !item.accepted).length;
  }, [guaranteeRequests]);

  const openPayment = useCallback(() => {
    if (activeLoan) {
      router.replace({
        pathname: "/(tabs)/payments/deposit" as any,
        params: {
          source: "loan",
          loanId: String(activeLoan.id),
          amount: "",
          editableAmount: "true",
        },
      });
      return;
    }

    router.replace({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        source: "loan",
        amount: "",
        editableAmount: "true",
      },
    });
  }, [activeLoan]);

  const handleHeroPrimary = useCallback(() => {
    if (activeLoan) {
      openPayment();
      return;
    }

    if (!kycComplete) {
      router.push(ROUTES.tabs.profileKyc as any);
      return;
    }

    if (loanAllowed && eligibility?.eligible) {
      router.push(ROUTES.tabs.loansRequest as any);
      return;
    }

    router.push(ROUTES.tabs.loans as any);
  }, [activeLoan, kycComplete, loanAllowed, eligibility, openPayment]);

  const handleHeroSecondary = useCallback(() => {
    if (activeLoan) {
      router.push(ROUTES.dynamic.loanDetail(activeLoan.id) as any);
      return;
    }

    if (!kycComplete) {
      router.push(ROUTES.tabs.profile as any);
      return;
    }

    router.push(ROUTES.tabs.loansHistory as any);
  }, [activeLoan, kycComplete]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={UI.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please log in to continue."
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
    >
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>UNITED CARE</Text>
        <Text style={styles.headerTitle}>Member Support</Text>
        <Text style={styles.headerSubtitle}>
          Simple community support for members when needed.
        </Text>
      </View>

      <HeroCard
        eligibility={eligibility}
        activeLoan={activeLoan}
        kycComplete={kycComplete}
        loanAllowed={loanAllowed}
        onPrimary={handleHeroPrimary}
        onSecondary={handleHeroSecondary}
      />

      {error ? (
        <TouchableOpacity activeOpacity={0.92} onPress={openPayment}>
          <Card style={styles.errorCard} variant="default">
            <View style={styles.errorIconWrap}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={COLORS.danger}
              />
            </View>

            <View style={styles.errorContent}>
              <Text style={styles.errorText}>{error}</Text>
              <View style={styles.errorActionRow}>
                <Text style={styles.errorActionText}>Open payment</Text>
                <Ionicons
                  name="arrow-forward"
                  size={15}
                  color={COLORS.danger}
                />
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      ) : null}

      <Section title="More">
        <View style={styles.actionsWrap}>
          {!activeLoan ? (
            <ActionRow
              title="Ask for support"
              subtitle="Start a simple support request"
              icon="create-outline"
              iconTone="primary"
              onPress={() =>
                kycComplete && loanAllowed
                  ? router.push(ROUTES.tabs.loansRequest as any)
                  : router.push(ROUTES.tabs.profileKyc as any)
              }
            />
          ) : null}

          <ActionRow
            title="Member requests"
            subtitle="Review requests that need your response"
            icon="people-outline"
            iconTone="gold"
            badge={guaranteeCount > 0 ? String(guaranteeCount) : undefined}
            onPress={() => router.push(ROUTES.tabs.loansGuarantees as any)}
          />

          <ActionRow
            title="Past activity"
            subtitle="See earlier support activity"
            icon="time-outline"
            iconTone="green"
            onPress={() => router.push(ROUTES.tabs.loansHistory as any)}
          />
        </View>
      </Section>

      <View style={{ height: 18 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: UI.bg,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.bg,
  },

  header: {
    marginBottom: SPACING.md,
  },

  headerEyebrow: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: 1,
    color: UI.primary,
  },

  headerTitle: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: UI.text,
  },

  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: UI.textMuted,
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: UI.primary,
    borderRadius: 28,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOW.soft,
  },

  heroGlowOne: {
    position: "absolute",
    top: -20,
    right: -10,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroGlowTwo: {
    position: "absolute",
    bottom: -30,
    left: -25,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  heroLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.82)",
  },

  heroAmount: {
    marginTop: 8,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  heroHelper: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    color: "rgba(255,255,255,0.82)",
    maxWidth: "92%",
  },

  heroActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  heroPrimaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  heroPrimaryBtnText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: UI.primaryDark,
  },

  heroSecondaryBtn: {
    minWidth: 110,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  heroSecondaryBtnText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  errorCard: {
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: UI.redSoft,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  errorIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
  },

  errorContent: {
    flex: 1,
  },

  errorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: COLORS.danger,
  },

  errorActionRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  errorActionText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: COLORS.danger,
  },

  actionsWrap: {
    gap: SPACING.sm,
  },

  actionRow: {
    minHeight: 78,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.soft,
  },

  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  actionTextWrap: {
    flex: 1,
    paddingRight: 6,
  },

  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  actionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: UI.text,
  },

  actionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    color: UI.textMuted,
  },

  actionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginLeft: SPACING.sm,
  },

  badge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.redSoft,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.08)",
  },

  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: UI.red,
  },

  chevronWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F7F8",
  },
});