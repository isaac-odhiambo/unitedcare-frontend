import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";

import { FONT, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  buildLoanRequestPayload,
  getApiErrorMessage,
  getGuarantorCandidates,
  getLoanEligibilityPreview,
  getLoanSecurityPreview,
  GuarantorCandidate,
  LoanEligibilityPreview,
  LoanSecurityPreview,
  requestLoan,
} from "@/services/loans";

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

  glass: "rgba(255,255,255,0.10)",
  glassStrong: "rgba(255,255,255,0.14)",
  border: "rgba(255,255,255,0.12)",

  supportCard: "rgba(52, 198, 191, 0.22)",
  supportBorder: "rgba(195, 255, 250, 0.16)",
  supportIconBg: "rgba(236, 255, 252, 0.76)",
  supportIcon: "#148C84",

  successCard: "rgba(98, 192, 98, 0.23)",
  successBorder: "rgba(194, 255, 188, 0.16)",
  successIconBg: "rgba(236, 255, 235, 0.76)",
  successIcon: "#379B4A",

  warningCard: "rgba(255, 204, 102, 0.16)",
  warningBorder: "rgba(255, 220, 140, 0.18)",
  warningIconBg: "rgba(255, 247, 224, 0.88)",
  warningIcon: "#B7791F",

  infoCard: "rgba(49, 180, 217, 0.22)",
  infoBorder: "rgba(189, 244, 255, 0.15)",
  infoIconBg: "rgba(236, 251, 255, 0.76)",
  infoIcon: "#0A6E8A",

  dangerCard: "rgba(220,53,69,0.18)",
};

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function toNumber(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isPositiveNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function normalizeApiMessage(message: string) {
  if (!message) return "Something went wrong. Please try again.";

  const lower = message.toLowerCase();

  if (lower.includes("active loan")) {
    return "You already have an active support request.";
  }

  if (lower.includes("principal")) {
    return "Enter a valid amount.";
  }

  if (lower.includes("term_weeks")) {
    return "Choose a valid repayment period.";
  }

  if (lower.includes("guarantor")) {
    return "Please check the selected members and try again.";
  }

  if (lower.includes("insufficient security")) {
    return "This amount needs more security. Add member support or reduce the amount.";
  }

  return message;
}

function SummaryCard({
  title,
  amount,
  subtitle,
  tone,
}: {
  title: string;
  amount: string;
  subtitle: string;
  tone: "support" | "success" | "warning" | "info";
}) {
  const palette = {
    support: {
      card: UI.supportCard,
      border: UI.supportBorder,
      iconBg: UI.supportIconBg,
      icon: UI.supportIcon,
      iconName: "wallet-outline" as const,
    },
    success: {
      card: UI.successCard,
      border: UI.successBorder,
      iconBg: UI.successIconBg,
      icon: UI.successIcon,
      iconName: "checkmark-circle-outline" as const,
    },
    warning: {
      card: UI.warningCard,
      border: UI.warningBorder,
      iconBg: UI.warningIconBg,
      icon: UI.warningIcon,
      iconName: "alert-circle-outline" as const,
    },
    info: {
      card: UI.infoCard,
      border: UI.infoBorder,
      iconBg: UI.infoIconBg,
      icon: UI.infoIcon,
      iconName: "information-circle-outline" as const,
    },
  }[tone];

  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.summaryTopRow}>
        <View style={[styles.summaryIconWrap, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={palette.iconName} size={18} color={palette.icon} />
        </View>
        <Text style={styles.summaryAmount}>{amount}</Text>
      </View>

      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summarySubtitle}>{subtitle}</Text>
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function GuarantorRow({
  item,
  selected,
  onPress,
}: {
  item: GuarantorCandidate;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.guarantorRow,
        selected && styles.guarantorRowSelected,
      ]}
    >
      <View style={styles.guarantorLeft}>
        <View
          style={[
            styles.guarantorAvatar,
            selected && styles.guarantorAvatarSelected,
          ]}
        >
          <Ionicons
            name={selected ? "checkmark" : "person-outline"}
            size={16}
            color={selected ? UI.page : "#FFFFFF"}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.guarantorName}>{item.full_name}</Text>
          <Text style={styles.guarantorMeta}>
            {selected ? "Selected" : "Tap to add"}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={UI.textMuted} />
    </TouchableOpacity>
  );
}

export default function RequestLoanScreen() {
  const insets = useSafeAreaInsets();
  const palette = getSpaceTonePalette("support");

  const [principal, setPrincipal] = useState("");
  const [termWeeks, setTermWeeks] = useState("12");

  const [eligibility, setEligibility] =
    useState<LoanEligibilityPreview | null>(null);
  const [securityPreview, setSecurityPreview] =
    useState<LoanSecurityPreview | null>(null);

  const [guarantorSearch, setGuarantorSearch] = useState("");
  const [guarantorCandidates, setGuarantorCandidates] = useState<
    GuarantorCandidate[]
  >([]);
  const [selectedGuarantorIds, setSelectedGuarantorIds] = useState<number[]>([]);

  const [loadingPage, setLoadingPage] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingSecurity, setCheckingSecurity] = useState(false);
  const [loadingGuarantors, setLoadingGuarantors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  const hasValidAmount = isPositiveNumber(principal);
  const hasActiveLoan = Boolean(eligibility?.has_active_loan);
  const fullySecured = Boolean(securityPreview?.fully_secured);

  const needsGuarantors =
    hasValidAmount &&
    !hasActiveLoan &&
    Boolean(securityPreview) &&
    !fullySecured &&
    toNumber(securityPreview?.shortfall) > 0;

  const formState = useMemo(() => {
    return buildLoanRequestPayload({
      principal,
      term_weeks: Number(termWeeks || 0),
      guarantor_ids: selectedGuarantorIds,
      member_note: "",
    });
  }, [principal, termWeeks, selectedGuarantorIds]);

  const amountLabel = useMemo(() => formatKes(principal || 0), [principal]);

  const selectedGuarantors = useMemo(() => {
    const ids = new Set(selectedGuarantorIds);
    return guarantorCandidates.filter((item) => ids.has(item.id));
  }, [selectedGuarantorIds, guarantorCandidates]);

  const loadEligibility = async () => {
    try {
      setError("");
      const res = await getLoanEligibilityPreview();
      setEligibility(res);
    } catch (e: any) {
      setEligibility(null);
      setError(normalizeApiMessage(getApiErrorMessage(e) || getErrorMessage(e)));
    }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoadingPage(true);
        await loadEligibility();
      } finally {
        if (active) setLoadingPage(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!hasValidAmount || hasActiveLoan) {
      setSecurityPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingSecurity(true);
        setError("");

        const preview = await getLoanSecurityPreview({
          principal: Number(principal),
          guarantor_ids: selectedGuarantorIds,
        });

        if (!active) return;
        setSecurityPreview(preview);
      } catch (e: any) {
        if (!active) return;
        setSecurityPreview(null);
        setError(normalizeApiMessage(getApiErrorMessage(e) || getErrorMessage(e)));
      } finally {
        if (active) setCheckingSecurity(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [principal, selectedGuarantorIds, hasValidAmount, hasActiveLoan]);

  useEffect(() => {
    let active = true;

    if (!needsGuarantors) {
      setGuarantorCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoadingGuarantors(true);
        const rows = await getGuarantorCandidates(guarantorSearch.trim());
        if (!active) return;
        setGuarantorCandidates(Array.isArray(rows) ? rows.slice(0, 20) : []);
      } catch (e: any) {
        if (!active) return;
        setGuarantorCandidates([]);
        setError(normalizeApiMessage(getApiErrorMessage(e) || getErrorMessage(e)));
      } finally {
        if (active) setLoadingGuarantors(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [guarantorSearch, needsGuarantors]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEligibility();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleGuarantor = (id: number) => {
    setSelectedGuarantorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const goBack = () => {
    if (submitting) return;

    const canGoBack =
      typeof (router as any)?.canGoBack === "function"
        ? (router as any).canGoBack()
        : false;

    if (canGoBack) {
      router.back();
      return;
    }

    router.replace("/(tabs)/loans" as any);
  };

  const submit = async () => {
    try {
      if (hasActiveLoan) {
        Alert.alert("Support", "You already have an active support request.");
        return;
      }

      if (!formState.canSubmit || !formState.payload) {
        Alert.alert(
          "Support",
          normalizeApiMessage(formState.error || "Please check your details.")
        );
        return;
      }

      if (!securityPreview?.fully_secured) {
        Alert.alert(
          "Support",
          normalizeApiMessage(
            securityPreview?.message ||
              "This amount still needs more security."
          )
        );
        return;
      }

      setSubmitting(true);
      setError("");

      const res = await requestLoan(formState.payload);

      Alert.alert(
        "Request sent",
        res?.message || "Your support request was sent successfully.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(tabs)/loans" as any),
          },
        ]
      );
    } catch (e: any) {
      const msg = normalizeApiMessage(
        getApiErrorMessage(e) || getErrorMessage(e)
      );
      setError(msg);
      Alert.alert("Support", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const summaryState = useMemo(() => {
    if (!hasValidAmount) {
      return {
        title: "Enter amount first",
        amount: amountLabel,
        subtitle: "We will check whether your current security is enough.",
        tone: "info" as const,
      };
    }

    if (checkingSecurity) {
      return {
        title: "Checking security",
        amount: amountLabel,
        subtitle: "Please wait while we review your current coverage.",
        tone: "info" as const,
      };
    }

    if (securityPreview?.fully_secured) {
      return {
        title: "Ready to submit",
        amount: formatKes(securityPreview.secured_total),
        subtitle: "Your request is fully secured and ready to send.",
        tone: "success" as const,
      };
    }

    if (securityPreview) {
      return {
        title: "More support needed",
        amount: formatKes(securityPreview.shortfall),
        subtitle: "Add member support or reduce the amount.",
        tone: "warning" as const,
      };
    }

    return {
      title: "Support summary",
      amount: amountLabel,
      subtitle: "Enter details to continue.",
      tone: "support" as const,
    };
  }, [hasValidAmount, checkingSecurity, securityPreview, amountLabel]);

  if (loadingPage) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]} />
    );
  }

  if (hasActiveLoan) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <View style={styles.blockCard}>
            <View
              style={[
                styles.blockIconWrap,
                { backgroundColor: UI.warningIconBg },
              ]}
            >
              <Ionicons name="time-outline" size={18} color={UI.warningIcon} />
            </View>
            <Text style={styles.blockTitle}>Support already active</Text>
            <Text style={styles.blockText}>
              Finish the current one before starting another.
            </Text>

            <View style={{ marginTop: SPACING.md, width: "100%" }}>
              <Button title="Back to support" onPress={goBack} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={UI.mint}
            colors={[UI.mint, UI.aqua]}
          />
        }
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
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroOrbThree} />

          <View style={styles.heroTopRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={goBack}
              style={[styles.backButton, { backgroundColor: palette.chip }]}
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
              <Text style={styles.heroTitle}>Ask for support</Text>
              <Text style={styles.heroSubtitle}>
                Enter amount and repayment period. We check your current
                security right away and show whether you are ready to submit.
              </Text>
            </View>

            <View
              style={[
                styles.heroIconWrap,
                { backgroundColor: palette.iconBg },
              ]}
            >
              <Ionicons name="create-outline" size={22} color={palette.icon} />
            </View>
          </View>

          <View style={styles.heroMiniWrap}>
            <View
              style={[
                styles.heroMiniPill,
                { backgroundColor: palette.amountBg },
              ]}
            >
              <Ionicons name="wallet-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroMiniText}>{amountLabel}</Text>
            </View>

            <View
              style={[
                styles.heroMiniPill,
                { backgroundColor: palette.amountBg },
              ]}
            >
              <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroMiniText}>
                {termWeeks ? `${termWeeks} weeks` : "Repayment period"}
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <SectionCard title="Support details">
          <Input
            label="Amount"
            value={principal}
            onChangeText={setPrincipal}
            placeholder="e.g. 5000"
            keyboardType="decimal-pad"
          />

          <Input
            label="Repayment period (weeks)"
            value={termWeeks}
            onChangeText={setTermWeeks}
            placeholder="e.g. 12"
            keyboardType="number-pad"
          />
        </SectionCard>

        <SummaryCard
          title={summaryState.title}
          amount={summaryState.amount}
          subtitle={summaryState.subtitle}
          tone={summaryState.tone}
        />

        {securityPreview && hasValidAmount && !checkingSecurity ? (
          <View style={styles.metricsWrap}>
            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>Amount</Text>
              <Text style={styles.metricValue}>{amountLabel}</Text>
            </View>

            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>Covered</Text>
              <Text style={styles.metricValue}>
                {formatKes(securityPreview.secured_total)}
              </Text>
            </View>

            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>Still needed</Text>
              <Text
                style={[
                  styles.metricValue,
                  fullySecured ? styles.successText : styles.warningText,
                ]}
              >
                {formatKes(securityPreview.shortfall)}
              </Text>
            </View>

            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>Your savings</Text>
              <Text style={styles.metricValue}>
                {formatKes(securityPreview.borrower_savings)}
              </Text>
            </View>
          </View>
        ) : null}

        {needsGuarantors ? (
          <SectionCard title="Add member support">
            <Input
              label="Search member"
              value={guarantorSearch}
              onChangeText={setGuarantorSearch}
              placeholder="Type member name"
            />

            {selectedGuarantors.length > 0 ? (
              <View style={styles.chipsWrap}>
                {selectedGuarantors.map((item) => (
                  <View key={item.id} style={styles.chip}>
                    <Text style={styles.chipText}>{item.full_name}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.helperText}>
                Select members who can support this request.
              </Text>
            )}
          </SectionCard>
        ) : null}

        {needsGuarantors ? (
          loadingGuarantors ? null : guarantorCandidates.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="people-outline"
                title="No members found"
                subtitle="Try another name."
              />
            </View>
          ) : (
            <View style={styles.guarantorList}>
              {guarantorCandidates.map((item) => {
                const selected = selectedGuarantorIds.includes(item.id);

                return (
                  <GuarantorRow
                    key={item.id}
                    item={item}
                    selected={selected}
                    onPress={() => toggleGuarantor(item.id)}
                  />
                );
              })}
            </View>
          )
        ) : null}

        <View style={styles.actionCard}>
          <Button
            title={submitting ? "Sending..." : "Submit request"}
            onPress={submit}
            loading={false}
            disabled={!fullySecured || submitting || !formState.canSubmit}
          />

          <View style={{ height: SPACING.sm }} />

          <Button
            title="Cancel"
            variant="secondary"
            onPress={goBack}
            disabled={submitting}
          />
        </View>
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
    padding: SPACING.md,
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
    top: -100,
    right: -40,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 250,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -100,
    right: -30,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 110,
    right: 20,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 140,
    left: 10,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    padding: 20,
    marginBottom: SPACING.md,
  },

  heroOrbOne: {
    position: "absolute",
    top: -26,
    right: -16,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroOrbTwo: {
    position: "absolute",
    bottom: -24,
    left: -18,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  heroOrbThree: {
    position: "absolute",
    top: 74,
    right: 40,
    width: 70,
    height: 70,
    borderRadius: 999,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
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
    color: "#FFFFFF",
    fontSize: 23,
    lineHeight: 29,
    fontFamily: FONT.bold,
  },

  heroSubtitle: {
    marginTop: 8,
    color: UI.textSoft,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONT.regular,
    maxWidth: "96%",
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

  errorCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: UI.dangerCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: SPACING.md,
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.regular,
  },

  blockCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    padding: SPACING.lg,
    backgroundColor: UI.glassStrong,
    borderWidth: 1,
    borderColor: UI.border,
    alignItems: "center",
  },

  blockIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  blockTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  blockText: {
    color: UI.textSoft,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.regular,
    textAlign: "center",
  },

  sectionCard: {
    borderRadius: 22,
    padding: SPACING.md,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.border,
    marginBottom: SPACING.md,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONT.bold,
    marginBottom: SPACING.sm,
  },

  summaryCard: {
    borderRadius: 22,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },

  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  summaryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryAmount: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: FONT.bold,
  },

  summaryTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  summarySubtitle: {
    color: UI.textSoft,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.regular,
  },

  metricsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  metricTile: {
    width: "48%",
    minHeight: 84,
    borderRadius: 18,
    padding: SPACING.md,
    backgroundColor: UI.glassStrong,
    borderWidth: 1,
    borderColor: UI.border,
    justifyContent: "center",
  },

  metricLabel: {
    color: UI.textMuted,
    fontSize: 11,
    fontFamily: FONT.regular,
    marginBottom: 6,
  },

  metricValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  helperText: {
    marginTop: 6,
    color: UI.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  chipsWrap: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },

  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(140,240,199,0.16)",
    borderWidth: 1,
    borderColor: "rgba(140,240,199,0.18)",
  },

  chipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  inlineLoader: {
    paddingVertical: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyWrap: {
    marginBottom: SPACING.md,
  },

  guarantorList: {
    marginBottom: SPACING.md,
  },

  guarantorRow: {
    marginBottom: SPACING.sm,
    borderRadius: 18,
    padding: SPACING.md,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  guarantorRowSelected: {
    backgroundColor: "rgba(140,240,199,0.16)",
    borderColor: "rgba(140,240,199,0.22)",
  },

  guarantorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  guarantorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },

  guarantorAvatarSelected: {
    backgroundColor: UI.mint,
  },

  guarantorName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  guarantorMeta: {
    marginTop: 4,
    color: UI.textMuted,
    fontSize: 11,
    fontFamily: FONT.regular,
  },

  actionCard: {
    marginTop: SPACING.sm,
    borderRadius: 22,
    padding: SPACING.md,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.border,
  },

  successText: {
    color: UI.mint,
  },

  warningText: {
    color: UI.warningIcon,
  },
});