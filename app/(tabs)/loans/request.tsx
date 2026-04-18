import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
    return "You already have an active support request. Finish it first before starting another one.";
  }

  if (lower.includes("already received your merry turn")) {
    return "You cannot start a new support request because your merry turn has already been received.";
  }

  if (lower.includes("merry turn")) {
    return "Your current merry status does not allow a new support request right now.";
  }

  if (lower.includes("principal")) {
    return "Please enter a valid support amount greater than zero.";
  }

  if (lower.includes("term_weeks")) {
    return "Please enter a repayment period of at least 1 week.";
  }

  if (lower.includes("their own guarantor")) {
    return "You cannot choose yourself as a supporting member.";
  }

  if (lower.includes("guarantor") && lower.includes("not found")) {
    return "One selected member could not be found. Refresh the list and choose again.";
  }

  if (lower.includes("not eligible") && lower.includes("guarantor")) {
    return "One selected member is not currently available to support this request. Please choose another one.";
  }

  if (lower.includes("insufficient security")) {
    return "This request may still need more support. You can reduce the amount or add supporting members.";
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
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function SelectedChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onRemove}
        style={styles.chipClose}
      >
        <Ionicons name="close" size={14} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

function MemberRow({
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
      style={[styles.memberRow, selected && styles.memberRowSelected]}
    >
      <View style={styles.memberLeft}>
        <View style={[styles.memberAvatar, selected && styles.memberAvatarSelected]}>
          <Ionicons
            name={selected ? "checkmark" : "person-outline"}
            size={16}
            color={selected ? UI.page : "#FFFFFF"}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.memberName} numberOfLines={1}>
            {item.full_name}
          </Text>
          <Text style={styles.memberMeta}>
            {selected ? "Selected for this request" : "Tap to add as supporting member"}
          </Text>
        </View>
      </View>

      <View style={selected ? styles.selectedBadge : styles.addBadge}>
        <Text style={styles.badgeLabel}>{selected ? "Selected" : "Add"}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function RequestLoanScreen() {
  const insets = useSafeAreaInsets();
  const palette = getSpaceTonePalette("support");

  const [principal, setPrincipal] = useState("");
  const [termWeeks, setTermWeeks] = useState("12");
  const [memberNote, setMemberNote] = useState("");

  const [eligibility, setEligibility] =
    useState<LoanEligibilityPreview | null>(null);
  const [securityPreview, setSecurityPreview] =
    useState<LoanSecurityPreview | null>(null);

  const [memberSearch, setMemberSearch] = useState("");
  const [memberCandidates, setMemberCandidates] = useState<GuarantorCandidate[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  const [loadingPage, setLoadingPage] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingSecurity, setCheckingSecurity] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  const hasValidAmount = isPositiveNumber(principal);
  const hasActiveLoan = Boolean(eligibility?.has_active_loan);
  const isEligible = eligibility ? Boolean(eligibility.eligible) : true;
  const eligibilityReason = normalizeApiMessage(eligibility?.reason || "");
  const blockedReason = !isEligible ? eligibilityReason : "";
  const fullySecured = Boolean(securityPreview?.fully_secured);

  const showMemberSupportSection =
    hasValidAmount &&
    isEligible &&
    !hasActiveLoan &&
    Boolean(securityPreview) &&
    toNumber(securityPreview?.shortfall) > 0;

  const formState = useMemo(() => {
    return buildLoanRequestPayload({
      principal,
      term_weeks: Number(termWeeks || 0),
      guarantor_ids: selectedMemberIds,
      member_note: memberNote.trim(),
    });
  }, [principal, termWeeks, selectedMemberIds, memberNote]);

  const amountLabel = useMemo(() => formatKes(principal || 0), [principal]);

  const selectedNamesById = useMemo(() => {
    const map = new Map<number, string>();
    memberCandidates.forEach((item) => {
      map.set(item.id, item.full_name);
    });
    return map;
  }, [memberCandidates]);

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

  const loadMembers = async (q?: string) => {
    try {
      const rows = await getGuarantorCandidates(q?.trim() || "");
      setMemberCandidates(Array.isArray(rows) ? rows.slice(0, 30) : []);
    } catch (e: any) {
      setMemberCandidates([]);
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

    if (!hasValidAmount || hasActiveLoan || !isEligible) {
      setSecurityPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingSecurity(true);
        setError("");

        const preview = await getLoanSecurityPreview({
          principal: Number(principal),
          guarantor_ids: selectedMemberIds,
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
  }, [principal, selectedMemberIds, hasValidAmount, hasActiveLoan, isEligible]);

  useEffect(() => {
    let active = true;

    if (!showMemberSupportSection) {
      setMemberCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoadingMembers(true);
        const rows = await getGuarantorCandidates(memberSearch.trim());
        if (!active) return;
        setMemberCandidates(Array.isArray(rows) ? rows.slice(0, 30) : []);
      } catch (e: any) {
        if (!active) return;
        setMemberCandidates([]);
        setError(normalizeApiMessage(getApiErrorMessage(e) || getErrorMessage(e)));
      } finally {
        if (active) setLoadingMembers(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [memberSearch, showMemberSupportSection]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEligibility();
      if (showMemberSupportSection) {
        await loadMembers(memberSearch);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const toggleMember = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const removeMember = (id: number) => {
    setSelectedMemberIds((prev) => prev.filter((x) => x !== id));
  };

  const clearSelectedMembers = () => {
    setSelectedMemberIds([]);
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
        Alert.alert(
          "Support request",
          "You already have an active support request. Finish it first before starting another one."
        );
        return;
      }

      if (!isEligible) {
        Alert.alert(
          "Support request",
          blockedReason || "You are not eligible to submit a support request right now."
        );
        return;
      }

      if (!formState.canSubmit || !formState.payload) {
        Alert.alert(
          "Support request",
          normalizeApiMessage(formState.error || "Please check your details.")
        );
        return;
      }

      setSubmitting(true);
      setError("");

      const res = await requestLoan(formState.payload);

      Alert.alert(
        "Request sent",
        res?.message || "Your support request was sent successfully and is now waiting for review.",
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
      Alert.alert("Support request", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const summaryState = useMemo(() => {
    if (!hasValidAmount) {
      return {
        title: "Enter support amount",
        amount: amountLabel,
        subtitle: "Start with the amount you need and your repayment period.",
        tone: "info" as const,
      };
    }

    if (!isEligible) {
      return {
        title: "Support request unavailable",
        amount: amountLabel,
        subtitle:
          blockedReason || "You are not eligible to start a new support request right now.",
        tone: "warning" as const,
      };
    }

    if (checkingSecurity) {
      return {
        title: "Checking your current support position",
        amount: amountLabel,
        subtitle: "We are reviewing your current coverage now.",
        tone: "info" as const,
      };
    }

    if (securityPreview?.fully_secured) {
      return {
        title: "Strong support position",
        amount: formatKes(securityPreview.secured_total),
        subtitle: "Your current coverage looks complete for this request.",
        tone: "success" as const,
      };
    }

    if (securityPreview) {
      return {
        title: "You can improve this request",
        amount: formatKes(securityPreview.shortfall),
        subtitle: "You can still send the request, but adding supporting members may improve approval.",
        tone: "warning" as const,
      };
    }

    return {
      title: "Support summary",
      amount: amountLabel,
      subtitle: "Enter your details to continue.",
      tone: "support" as const,
    };
  }, [hasValidAmount, checkingSecurity, securityPreview, amountLabel, isEligible, blockedReason]);

  if (loadingPage) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]} />
    );
  }

  if (hasActiveLoan || !isEligible) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <View style={styles.blockCard}>
            <View
              style={[
                styles.blockIconWrap,
                {
                  backgroundColor: hasActiveLoan
                    ? UI.warningIconBg
                    : UI.infoIconBg,
                },
              ]}
            >
              <Ionicons
                name={hasActiveLoan ? "time-outline" : "information-circle-outline"}
                size={18}
                color={hasActiveLoan ? UI.warningIcon : UI.infoIcon}
              />
            </View>
            <Text style={styles.blockTitle}>
              {hasActiveLoan ? "Support already active" : "Support request unavailable"}
            </Text>
            <Text style={styles.blockText}>
              {hasActiveLoan
                ? "You already have an active support request. Finish it first before starting another one."
                : blockedReason || "You are not eligible to start a support request right now."}
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          style={styles.page}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 32, 48) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
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
                  Enter the amount you need, choose a repayment period, and add supporting members if needed.
                  We will show your current position clearly before you send the request.
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

          <SectionCard
            title="Request details"
            subtitle="Fill in the amount, repayment period, and optional note."
          >
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

            <Input
              label="Short note (optional)"
              value={memberNote}
              onChangeText={setMemberNote}
              placeholder="Tell the team what this support is for"
              multiline
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
                <Text style={styles.metricLabel}>Request amount</Text>
                <Text style={styles.metricValue}>{amountLabel}</Text>
              </View>

              <View style={styles.metricTile}>
                <Text style={styles.metricLabel}>Covered now</Text>
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
                <Text style={styles.metricLabel}>Savings</Text>
                <Text style={styles.metricValue}>
                  {formatKes(securityPreview.borrower_savings)}
                </Text>
              </View>

              <View style={styles.metricTile}>
                <Text style={styles.metricLabel}>Merry</Text>
                <Text style={styles.metricValue}>
                  {formatKes(securityPreview.borrower_merry)}
                </Text>
              </View>

              <View style={styles.metricTile}>
                <Text style={styles.metricLabel}>Groups</Text>
                <Text style={styles.metricValue}>
                  {formatKes(securityPreview.borrower_group)}
                </Text>
              </View>

              <View style={styles.metricTile}>
                <Text style={styles.metricLabel}>Your total cover</Text>
                <Text style={styles.metricValue}>
                  {formatKes(securityPreview.borrower_total)}
                </Text>
              </View>

              <View style={styles.metricTile}>
                <Text style={styles.metricLabel}>Support from members</Text>
                <Text style={styles.metricValue}>
                  {formatKes(securityPreview.guarantor_total)}
                </Text>
              </View>
            </View>
          ) : null}

          {showMemberSupportSection ? (
            <SectionCard
              title="Add supporting members"
              subtitle="Search active approved members and tap to add them to this request."
            >
              <Input
                label="Search member"
                value={memberSearch}
                onChangeText={setMemberSearch}
                placeholder="Type a member name"
              />

              {selectedMemberIds.length > 0 ? (
                <>
                  <View style={styles.selectedHeader}>
                    <Text style={styles.selectedHeaderText}>
                      Selected members ({selectedMemberIds.length})
                    </Text>

                    <TouchableOpacity activeOpacity={0.9} onPress={clearSelectedMembers}>
                      <Text style={styles.clearText}>Clear all</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.chipsWrap}>
                    {selectedMemberIds.map((id) => (
                      <SelectedChip
                        key={id}
                        label={selectedNamesById.get(id) || `Member #${id}`}
                        onRemove={() => removeMember(id)}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.helperText}>
                  No supporting members selected yet. You can still submit without them, but adding support may improve approval.
                </Text>
              )}

              {loadingMembers ? (
                <View style={styles.inlineInfoCard}>
                  <Ionicons name="search-outline" size={16} color={UI.textSoft} />
                  <Text style={styles.inlineInfoText}>Searching members...</Text>
                </View>
              ) : memberCandidates.length === 0 ? (
                <View style={styles.emptyWrapBox}>
                  <EmptyState
                    icon="people-outline"
                    title="No members found"
                    subtitle="Try a different name or clear the search."
                  />
                </View>
              ) : (
                <View style={styles.memberList}>
                  {memberCandidates.map((item) => {
                    const selected = selectedMemberIds.includes(item.id);

                    return (
                      <MemberRow
                        key={item.id}
                        item={item}
                        selected={selected}
                        onPress={() => toggleMember(item.id)}
                      />
                    );
                  })}
                </View>
              )}
            </SectionCard>
          ) : null}

          <View style={styles.actionCard}>
            <Text style={styles.actionHint}>
              When you send this request, the backend will review it and place it in the pending review flow.
            </Text>

            <Button
              title={submitting ? "Sending..." : "Submit request"}
              onPress={submit}
              loading={false}
              disabled={submitting || !formState.canSubmit || hasActiveLoan || !isEligible}
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
      </KeyboardAvoidingView>
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
    marginBottom: 4,
  },

  sectionSubtitle: {
    color: UI.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
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

  selectedHeader: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectedHeaderText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  clearText: {
    color: UI.mint,
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  chipsWrap: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  chip: {
    maxWidth: "100%",
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    backgroundColor: "rgba(140,240,199,0.16)",
    borderWidth: 1,
    borderColor: "rgba(140,240,199,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  chipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.regular,
    maxWidth: 180,
  },

  chipClose: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  inlineInfoCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: UI.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: SPACING.sm,
  },

  inlineInfoText: {
    color: UI.textSoft,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  emptyWrapBox: {
    marginTop: SPACING.sm,
  },

  memberList: {
    marginTop: SPACING.sm,
  },

  memberRow: {
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

  memberRowSelected: {
    backgroundColor: "rgba(140,240,199,0.16)",
    borderColor: "rgba(140,240,199,0.22)",
  },

  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  memberAvatarSelected: {
    backgroundColor: UI.mint,
    borderColor: "rgba(140,240,199,0.26)",
  },

  memberName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONT.bold,
    marginBottom: 2,
  },

  memberMeta: {
    color: UI.textMuted,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  addBadge: {
    minWidth: 54,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    marginLeft: 12,
  },

  selectedBadge: {
    minWidth: 72,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(140,240,199,0.22)",
    marginLeft: 12,
  },

  badgeLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  actionCard: {
    borderRadius: 22,
    padding: SPACING.md,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.border,
    marginBottom: SPACING.md,
  },

  actionHint: {
    color: UI.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    marginBottom: SPACING.sm,
  },

  successText: {
    color: UI.mint,
  },

  warningText: {
    color: "#FFD27D",
  },
});