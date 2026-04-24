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
      card: "rgba(29, 196, 182, 0.14)",
      border: "rgba(129, 244, 231, 0.12)",
      iconBg: "rgba(220, 255, 250, 0.18)",
      icon: "#E8FFFB",
      chip: "rgba(255,255,255,0.10)",
      amountBg: "rgba(255,255,255,0.08)",
    },
    merry: {
      card: "rgba(98, 192, 98, 0.14)",
      border: "rgba(194, 255, 188, 0.12)",
      iconBg: "rgba(236, 255, 235, 0.18)",
      icon: "#ECFFEA",
      chip: "rgba(255,255,255,0.10)",
      amountBg: "rgba(255,255,255,0.08)",
    },
    groups: {
      card: "rgba(49, 180, 217, 0.14)",
      border: "rgba(189, 244, 255, 0.12)",
      iconBg: "rgba(236, 251, 255, 0.18)",
      icon: "#EAF9FF",
      chip: "rgba(255,255,255,0.10)",
      amountBg: "rgba(255,255,255,0.08)",
    },
    support: {
      card: "rgba(52, 198, 191, 0.14)",
      border: "rgba(195, 255, 250, 0.12)",
      iconBg: "rgba(236, 255, 252, 0.18)",
      icon: "#E9FFFC",
      chip: "rgba(255,255,255,0.10)",
      amountBg: "rgba(255,255,255,0.08)",
    },
  };

  return map[tone];
}

const UI = {
  page: "#062C49",
  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.78)",
  mint: "#8CF0C7",
  aqua: "#0CC0B7",
  glass: "rgba(255,255,255,0.07)",
  glassStrong: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.10)",
  dangerCard: "rgba(220,53,69,0.16)",
  successText: "#8CF0C7",
  warningText: "#FFD27D",
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

  if (lower.includes("active loan")) return "You already have an active request.";
  if (lower.includes("already received your merry turn")) return "You cannot start a new request after your merry turn.";
  if (lower.includes("merry turn")) return "Your merry status does not allow a new request right now.";
  if (lower.includes("principal")) return "Enter a valid amount above zero.";
  if (lower.includes("term_weeks")) return "Enter at least 1 week.";
  if (lower.includes("their own guarantor")) return "You cannot add yourself.";
  if (lower.includes("guarantor") && lower.includes("not found")) return "One selected person could not be found.";
  if (lower.includes("not eligible") && lower.includes("guarantor")) return "One selected person is not available right now.";
  if (lower.includes("insufficient security")) return "This request still needs more cover.";

  return message;
}

function SummaryCard({
  title,
  amount,
  subtitle,
}: {
  title: string;
  amount: string;
  subtitle: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summaryAmount}>{amount}</Text>
      </View>
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
        <Ionicons name="close" size={12} color="#FFFFFF" />
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
            size={14}
            color="#FFFFFF"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.memberName} numberOfLines={1}>
            {item.full_name || "Member"}
          </Text>
          <Text style={styles.memberMeta}>
            {selected ? "Added" : "Tap to add"}
          </Text>
        </View>
      </View>

      <View style={selected ? styles.selectedBadge : styles.addBadge}>
        <Text style={styles.badgeLabel}>{selected ? "Added" : "Add"}</Text>
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
  const [showGuarantorPicker, setShowGuarantorPicker] = useState(false);

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

  const formState = useMemo(() => {
    return buildLoanRequestPayload({
      principal,
      term_weeks: Number(termWeeks || 0),
      guarantor_ids: selectedMemberIds,
      member_note: memberNote.trim(),
    });
  }, [principal, termWeeks, selectedMemberIds, memberNote]);

  const amountLabel = useMemo(() => formatKes(principal || 0), [principal]);

  const totalRepaymentAmount = useMemo(() => {
    const p = Number(principal || 0);
    const weeks = Number(termWeeks || 0);

    if (!Number.isFinite(p) || p <= 0) return "KES 0";
    if (!Number.isFinite(weeks) || weeks <= 0) return amountLabel;

    const annualRate = 0.12;
    const total = p + p * annualRate * (weeks / 52);
    return formatKes(total);
  }, [principal, termWeeks, amountLabel]);

  const previewGuarantors = useMemo(() => {
    const rows = (securityPreview as any)?.guarantors;
    return Array.isArray(rows) ? rows : [];
  }, [securityPreview]);

  const fullySecured = Boolean(securityPreview?.fully_secured);
  const showGuarantorSection = hasValidAmount && isEligible && !hasActiveLoan;
  const showBreakdown = Boolean(securityPreview) && hasValidAmount && !checkingSecurity;

  const selectedNamesById = useMemo(() => {
    const map = new Map<number, string>();
    memberCandidates.forEach((item) => {
      map.set(item.id, item.full_name || "Member");
    });

    previewGuarantors.forEach((item: any) => {
      const id = Number(item?.guarantor_id);
      const name = String(item?.guarantor_name || `Member #${id}`);
      if (Number.isFinite(id) && id > 0) {
        map.set(id, name);
      }
    });

    return map;
  }, [memberCandidates, previewGuarantors]);

  const selectedGuarantorNames = useMemo(() => {
    return selectedMemberIds.map((id) => selectedNamesById.get(id) || `Member #${id}`);
  }, [selectedMemberIds, selectedNamesById]);

  const guarantorCoverById = useMemo(() => {
    const map = new Map<number, string>();

    previewGuarantors.forEach((item: any) => {
      const id = Number(item?.guarantor_id);
      const used = item?.used_security ?? 0;
      if (Number.isFinite(id) && id > 0) {
        map.set(id, formatKes(used));
      }
    });

    return map;
  }, [previewGuarantors]);

  const suggestionText = useMemo(() => {
    if (!hasValidAmount) return "Enter amount to continue.";
    if (!isEligible) return blockedReason || "Request unavailable.";
    if (checkingSecurity) return "Checking cover.";
    if (fullySecured) return "Cover complete.";
    if (securityPreview) return "Add more or reduce amount.";
    return "Fill in the details.";
  }, [hasValidAmount, isEligible, blockedReason, checkingSecurity, fullySecured, securityPreview]);

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

    if (!showGuarantorSection || !showGuarantorPicker) {
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
  }, [memberSearch, showGuarantorSection, showGuarantorPicker]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEligibility();
      if (showGuarantorSection && showGuarantorPicker) {
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

  const buildSubmissionSummary = () => {
    const guarantorText =
      selectedGuarantorNames.length > 0
        ? selectedGuarantorNames
            .map((name, index) => {
              const id = selectedMemberIds[index];
              const cover = guarantorCoverById.get(id) || "KES 0";
              return `${index + 1}. ${name} — ${cover}`;
            })
            .join("\n")
        : "None";

    const currentCover = securityPreview
      ? formatKes(securityPreview.secured_total)
      : "Not checked";

    const shortfall = securityPreview
      ? formatKes(securityPreview.shortfall)
      : "Not checked";

    const noteText = memberNote.trim() || "None";

    return (
      `Amount\n${amountLabel}\n\n` +
      `Repayment\n${totalRepaymentAmount}\n\n` +
      `Period\n${termWeeks || "0"} weeks\n\n` +
      `Cover\n${currentCover}\n\n` +
      `Shortfall\n${shortfall}\n\n` +
      `Added\n${selectedMemberIds.length}\n${guarantorText}\n\n` +
      `Note\n${noteText}`
    );
  };

  const performSubmit = async () => {
    try {
      if (hasActiveLoan) {
        Alert.alert("Request", "You already have an active request.");
        return;
      }

      if (!isEligible) {
        Alert.alert("Request", blockedReason || "You are not eligible right now.");
        return;
      }

      if (!formState.canSubmit || !formState.payload) {
        Alert.alert(
          "Request",
          normalizeApiMessage(formState.error || "Please check your details.")
        );
        return;
      }

      setSubmitting(true);
      setError("");

      const res = await requestLoan(formState.payload);

      Alert.alert(
        "Request sent",
        res?.message || "Your request was sent successfully.",
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
      Alert.alert("Request", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (checkingSecurity) {
      Alert.alert("Request", "Please wait while cover is being checked.");
      return;
    }

    Alert.alert(
      "Confirm request",
      buildSubmissionSummary(),
      [
        { text: "Edit", style: "cancel" },
        { text: "Submit", onPress: performSubmit },
      ]
    );
  };

  const summaryState = useMemo(() => {
    if (!hasValidAmount) {
      return {
        title: "Enter amount",
        amount: amountLabel,
        subtitle: "Add amount and period.",
      };
    }

    if (!isEligible) {
      return {
        title: "Unavailable",
        amount: amountLabel,
        subtitle: blockedReason || "You cannot start a new request right now.",
      };
    }

    if (checkingSecurity) {
      return {
        title: "Checking",
        amount: amountLabel,
        subtitle: "Please wait.",
      };
    }

    if (fullySecured) {
      return {
        title: "Ready",
        amount: formatKes(securityPreview?.secured_total),
        subtitle: "Cover complete.",
      };
    }

    if (securityPreview) {
      return {
        title: "More cover",
        amount: formatKes(securityPreview.shortfall),
        subtitle: "Add more or reduce amount.",
      };
    }

    return {
      title: "Summary",
      amount: amountLabel,
      subtitle: "Fill in the details.",
    };
  }, [hasValidAmount, isEligible, blockedReason, checkingSecurity, fullySecured, securityPreview, amountLabel]);

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
            <View style={styles.blockIconWrap}>
              <Ionicons
                name={hasActiveLoan ? "time-outline" : "information-circle-outline"}
                size={18}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.blockTitle}>
              {hasActiveLoan ? "Request active" : "Unavailable"}
            </Text>

            <Text style={styles.blockText}>
              {hasActiveLoan
                ? "You already have an active request."
                : blockedReason || "You cannot start a request right now."}
            </Text>

            <View style={{ marginTop: SPACING.md, width: "100%" }}>
              <Button title="Back" onPress={goBack} />
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
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
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
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.heroTopRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={goBack}
                style={[styles.backButton, { backgroundColor: palette.chip }]}
              >
                <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.heroBadge}>
                <Ionicons name="heart-outline" size={13} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>MEMBER SUPPORT</Text>
              </View>
            </View>

            <View style={styles.heroHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Ask for support</Text>
                <Text style={styles.heroSubtitle}>
                  Savings, merry, and groups are checked first.
                </Text>
              </View>

              <View
                style={[
                  styles.heroIconWrap,
                  { backgroundColor: palette.iconBg },
                ]}
              >
                <Ionicons name="wallet-outline" size={18} color={palette.icon} />
              </View>
            </View>

            <View style={styles.heroMiniWrap}>
              <View
                style={[
                  styles.heroMiniPill,
                  { backgroundColor: palette.amountBg },
                ]}
              >
                <Ionicons name="cash-outline" size={13} color="#FFFFFF" />
                <Text style={styles.heroMiniText}>{amountLabel}</Text>
              </View>

              <View
                style={[
                  styles.heroMiniPill,
                  { backgroundColor: palette.amountBg },
                ]}
              >
                <Ionicons name="calendar-outline" size={13} color="#FFFFFF" />
                <Text style={styles.heroMiniText}>
                  {termWeeks ? `${termWeeks} weeks` : "Period"}
                </Text>
              </View>

              <View
                style={[
                  styles.heroMiniPill,
                  { backgroundColor: palette.amountBg },
                ]}
              >
                <Ionicons name="receipt-outline" size={13} color="#FFFFFF" />
                <Text style={styles.heroMiniText}>{totalRepaymentAmount}</Text>
              </View>
            </View>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <SectionCard title="Details" subtitle="Amount, period, and note.">
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Amount</Text>
              <Input
                value={principal}
                onChangeText={setPrincipal}
                placeholder="e.g. 5000"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Period</Text>
              <Input
                value={termWeeks}
                onChangeText={setTermWeeks}
                placeholder="e.g. 12"
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Note</Text>
              <Input
                value={memberNote}
                onChangeText={setMemberNote}
                placeholder="Optional"
                multiline
              />
            </View>
          </SectionCard>

          <SectionCard title="Guide" subtitle={suggestionText}>
            <View style={styles.breakdownList}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Amount</Text>
                <Text style={styles.breakdownValue}>{amountLabel}</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Repayment</Text>
                <Text style={styles.breakdownValue}>{totalRepaymentAmount}</Text>
              </View>

              {showBreakdown ? (
                <>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Savings</Text>
                    <Text style={styles.breakdownValue}>
                      {formatKes(securityPreview?.borrower_savings)}
                    </Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Merry</Text>
                    <Text style={styles.breakdownValue}>
                      {formatKes(securityPreview?.borrower_merry)}
                    </Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Groups</Text>
                    <Text style={styles.breakdownValue}>
                      {formatKes(securityPreview?.borrower_group)}
                    </Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Added cover</Text>
                    <Text style={styles.breakdownValue}>
                      {formatKes(securityPreview?.guarantor_total)}
                    </Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Shortfall</Text>
                    <Text
                      style={[
                        styles.breakdownValue,
                        fullySecured ? styles.successText : styles.warningText,
                      ]}
                    >
                      {formatKes(securityPreview?.shortfall)}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </SectionCard>

          <SummaryCard
            title={summaryState.title}
            amount={summaryState.amount}
            subtitle={summaryState.subtitle}
          />

          {previewGuarantors.length > 0 ? (
            <SectionCard title="Added people" subtitle="Current cover">
              <View style={styles.memberList}>
                {previewGuarantors.map((item: any) => (
                  <View key={String(item?.guarantor_id)} style={styles.coverRow}>
                    <Text style={styles.coverName}>
                      {String(item?.guarantor_name || "Member")}
                    </Text>
                    <Text style={styles.coverAmount}>
                      {formatKes(item?.used_security || 0)}
                    </Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          ) : null}

          {showGuarantorSection ? (
            <SectionCard
              title="Add people"
              subtitle={fullySecured ? "Cover complete. Add more if you want." : "Add one or more."}
            >
              {selectedMemberIds.length > 0 ? (
                <>
                  <View style={styles.selectedHeader}>
                    <Text style={styles.selectedHeaderText}>
                      Added ({selectedMemberIds.length})
                    </Text>

                    <TouchableOpacity activeOpacity={0.9} onPress={clearSelectedMembers}>
                      <Text style={styles.clearText}>Clear</Text>
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
                <Text style={styles.helperText}>None added yet.</Text>
              )}

              <View style={styles.guarantorActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => setShowGuarantorPicker((prev) => !prev)}
                  style={styles.addAnotherButton}
                >
                  <Ionicons
                    name={showGuarantorPicker ? "chevron-up-outline" : "add-outline"}
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.addAnotherButtonText}>
                    {showGuarantorPicker ? "Hide list" : "Add person"}
                  </Text>
                </TouchableOpacity>
              </View>

              {showGuarantorPicker ? (
                <>
                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLabel}>Search</Text>
                    <Input
                      value={memberSearch}
                      onChangeText={setMemberSearch}
                      placeholder="Type a name"
                    />
                  </View>

                  {loadingMembers ? (
                    <View style={styles.inlineInfoCard}>
                      <Ionicons name="search-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.inlineInfoText}>Searching...</Text>
                    </View>
                  ) : memberCandidates.length === 0 ? (
                    <View style={styles.emptyWrapBox}>
                      <EmptyState
                        icon="people-outline"
                        title="No one found"
                        subtitle="Try another name."
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
                </>
              ) : null}
            </SectionCard>
          ) : null}

          <View style={styles.actionCard}>
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
    padding: 12,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.page,
    padding: SPACING.lg,
  },

  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONT.bold,
    letterSpacing: 0.6,
  },

  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: FONT.bold,
  },

  heroSubtitle: {
    marginTop: 4,
    color: UI.textSoft,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.regular,
  },

  heroMiniWrap: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },

  heroMiniPill: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  heroMiniText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  errorCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: UI.dangerCard,
    borderWidth: 1,
    borderColor: UI.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.regular,
  },

  blockCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    padding: SPACING.md,
    backgroundColor: UI.glassStrong,
    borderWidth: 1,
    borderColor: UI.border,
    alignItems: "center",
  },

  blockIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  blockTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  blockText: {
    color: UI.textSoft,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.regular,
    textAlign: "center",
  },

  sectionCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.border,
    marginBottom: 10,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONT.bold,
    marginBottom: 3,
  },

  sectionSubtitle: {
    color: UI.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: FONT.regular,
    marginBottom: 8,
  },

  inputWrap: {
    marginBottom: 10,
  },

  inputLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  summaryCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: UI.glassStrong,
    borderWidth: 1,
    borderColor: UI.border,
    marginBottom: 10,
  },

  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },

  summaryTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  summaryAmount: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  summarySubtitle: {
    color: UI.textSoft,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.regular,
  },

  breakdownList: {
    gap: 8,
  },

  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 26,
  },

  breakdownLabel: {
    flex: 1,
    color: UI.textSoft,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  breakdownValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.bold,
    textAlign: "right",
  },

  helperText: {
    marginTop: 4,
    color: UI.textSoft,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: FONT.regular,
  },

  selectedHeader: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectedHeaderText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  clearText: {
    color: UI.mint,
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  chipsWrap: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },

  chip: {
    maxWidth: "100%",
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    backgroundColor: "rgba(140,240,199,0.16)",
    borderWidth: 1,
    borderColor: "rgba(140,240,199,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  chipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONT.regular,
    maxWidth: 180,
  },

  chipClose: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  inlineInfoCard: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: UI.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },

  inlineInfoText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONT.regular,
  },

  emptyWrapBox: {
    marginTop: 8,
  },

  memberList: {
    marginTop: 8,
  },

  memberRow: {
    marginBottom: 8,
    borderRadius: 14,
    padding: 10,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  memberRowSelected: {
    backgroundColor: "rgba(140,240,199,0.14)",
    borderColor: "rgba(140,240,199,0.20)",
  },

  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  memberAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: UI.border,
  },

  memberAvatarSelected: {
    backgroundColor: "rgba(140,240,199,0.18)",
    borderColor: "rgba(140,240,199,0.24)",
  },

  memberName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONT.bold,
    marginBottom: 2,
  },

  memberMeta: {
    color: UI.textSoft,
    fontSize: 11,
    fontFamily: FONT.regular,
  },

  addBadge: {
    minWidth: 48,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    marginLeft: 10,
  },

  selectedBadge: {
    minWidth: 54,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(140,240,199,0.18)",
    marginLeft: 10,
  },

  badgeLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONT.bold,
  },

  coverRow: {
    minHeight: 30,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: UI.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },

  coverName: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  coverAmount: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.bold,
    textAlign: "right",
  },

  guarantorActionsRow: {
    marginTop: 8,
    marginBottom: 8,
  },

  addAnotherButton: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: UI.border,
  },

  addAnotherButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  actionCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.border,
    marginBottom: 10,
  },

  successText: {
    color: UI.successText,
  },

  warningText: {
    color: UI.warningText,
  },
});