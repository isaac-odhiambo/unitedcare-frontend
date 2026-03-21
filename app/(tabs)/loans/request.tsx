import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";

import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  buildLoanRequestPayload,
  getApiErrorMessage,
  getGuarantorCandidates,
  getLoanEligibilityPreview,
  GuarantorCandidate,
  LoanEligibilityPreview,
  requestLoan,
} from "@/services/loans";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function RequestLoanScreen() {
  const [principal, setPrincipal] = useState("");
  const [termWeeks, setTermWeeks] = useState("12");
  const [memberNote, setMemberNote] = useState("");

  const [search, setSearch] = useState("");
  const [selectedGuarantorIds, setSelectedGuarantorIds] = useState<number[]>([]);

  const [eligibility, setEligibility] = useState<LoanEligibilityPreview | null>(null);
  const [candidates, setCandidates] = useState<GuarantorCandidate[]>([]);

  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const formState = useMemo(() => {
    return buildLoanRequestPayload({
      principal,
      term_weeks: Number(termWeeks || 0),
      guarantor_ids: selectedGuarantorIds,
      member_note: memberNote,
    });
  }, [principal, termWeeks, selectedGuarantorIds, memberNote]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoadingEligibility(true);
        const res = await getLoanEligibilityPreview();
        if (!mounted) return;
        setEligibility(res);
      } catch (e: any) {
        if (!mounted) return;
        setEligibility(null);
        setError(getApiErrorMessage(e) || getErrorMessage(e));
      } finally {
        if (mounted) setLoadingEligibility(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const timer = setTimeout(async () => {
      try {
        setLoadingCandidates(true);
        const rows = await getGuarantorCandidates(search.trim());
        if (!mounted) return;
        setCandidates(Array.isArray(rows) ? rows.slice(0, 10) : []);
      } catch (e: any) {
        if (!mounted) return;
        setCandidates([]);
        setError(getApiErrorMessage(e) || getErrorMessage(e));
      } finally {
        if (mounted) setLoadingCandidates(false);
      }
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [search]);

  const toggleGuarantor = (id: number) => {
    setSelectedGuarantorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedGuarantors = useMemo(() => {
    const map = new Map(candidates.map((c) => [c.id, c]));
    return selectedGuarantorIds.map((id) => map.get(id)).filter(Boolean) as GuarantorCandidate[];
  }, [candidates, selectedGuarantorIds]);

  const amountPreview = useMemo(() => formatKes(principal || 0), [principal]);

  const hasActiveLoan = Boolean(eligibility?.has_active_loan);
  const showEligibilitySection = !loadingEligibility && !!eligibility && !hasActiveLoan;
  const canSubmit = Boolean(formState.canSubmit && eligibility?.eligible && !submitting && !hasActiveLoan);

  const submit = async () => {
    try {
      if (hasActiveLoan) {
        Alert.alert("Loan Request", "You already have an active loan.");
        return;
      }

      if (!eligibility?.eligible) {
        Alert.alert(
          "Loan Request",
          "You are not eligible to request a loan right now."
        );
        return;
      }

      if (!formState.canSubmit || !formState.payload) {
        Alert.alert("Loan Request", formState.error || "Please complete the form.");
        return;
      }

      setSubmitting(true);
      setError("");

      const res = await requestLoan(formState.payload);

      Alert.alert("Success", res?.message || "Loan request submitted successfully.");
      router.replace("/(tabs)/loans" as any);
    } catch (e: any) {
      const msg = getApiErrorMessage(e) || getErrorMessage(e);
      setError(msg);
      Alert.alert("Request Loan", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Ionicons name="wallet-outline" size={22} color={COLORS.white} />
          </View>

          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Loan Request</Text>
            <Text style={styles.heroSub}>
              Apply for a loan in a simple and clear process.
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {loadingEligibility ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>Checking your loan status...</Text>
        </Card>
      ) : null}

      {hasActiveLoan ? (
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="time-outline" size={18} color={COLORS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Loan request unavailable</Text>
              <Text style={styles.infoText}>
                You already have an active loan or a pending loan request. Clear the current loan process before making a new request.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {showEligibilitySection ? (
        <Section title="Overview">
          <Card style={styles.overviewCard}>
            <View style={styles.gridRow}>
              <View style={[styles.infoTile, styles.infoTilePrimary]}>
                <Text style={styles.infoLabelLight}>Status</Text>
                <Text style={styles.infoValueLight}>
                  {eligibility?.eligible ? "Ready to Apply" : "Not Ready"}
                </Text>
              </View>

              <View style={styles.infoTile}>
                <Text style={styles.infoLabel}>Maximum Loan</Text>
                <Text style={styles.infoValue}>{formatKes(eligibility?.max_allowed)}</Text>
              </View>
            </View>

            <View style={styles.gridRow}>
              <View style={styles.infoTile}>
                <Text style={styles.infoLabel}>Available Savings</Text>
                <Text style={styles.infoValue}>
                  {formatKes(eligibility?.available_savings)}
                </Text>
              </View>

              <View style={styles.infoTile}>
                <Text style={styles.infoLabel}>Application Status</Text>
                <Text style={styles.infoValue}>No Active Request</Text>
              </View>
            </View>
          </Card>
        </Section>
      ) : null}

      {!hasActiveLoan ? (
        <Section title="Loan Information">
          <Card style={styles.card}>
            <Input
              label="Amount (KES)"
              value={principal}
              onChangeText={setPrincipal}
              placeholder="e.g. 10000"
              keyboardType="decimal-pad"
            />

            <Input
              label="Repayment Period (Weeks)"
              value={termWeeks}
              onChangeText={setTermWeeks}
              placeholder="e.g. 12"
              keyboardType="number-pad"
            />

            <Input
              label="Reason (Optional)"
              value={memberNote}
              onChangeText={setMemberNote}
              placeholder="Why do you need this loan?"
            />

            <View style={styles.amountPreviewBox}>
              <Text style={styles.amountPreviewLabel}>Requested Amount</Text>
              <Text style={styles.amountPreviewValue}>{amountPreview}</Text>
            </View>
          </Card>
        </Section>
      ) : null}

      {!hasActiveLoan ? (
        <Section title="Selected Guarantors">
          <Card style={styles.card}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedTitle}>
                {selectedGuarantorIds.length} selected
              </Text>

              {selectedGuarantorIds.length > 0 ? (
                <TouchableOpacity onPress={() => setSelectedGuarantorIds([])}>
                  <Text style={styles.clearText}>Clear all</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {selectedGuarantors.length === 0 ? (
              <Text style={styles.helperText}>No guarantor selected yet.</Text>
            ) : (
              <View style={styles.chipsWrap}>
                {selectedGuarantors.map((item) => (
                  <View key={item.id} style={styles.chip}>
                    <Text style={styles.chipText}>{item.full_name}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Section>
      ) : null}

      {!hasActiveLoan ? (
        <Section title="Find Guarantor">
          <Card style={styles.card}>
            <Input
              label="Search Member"
              value={search}
              onChangeText={setSearch}
              placeholder="Type member name"
            />
            <Text style={styles.helperText}>
              Select one or more members to support your application.
            </Text>
          </Card>
        </Section>
      ) : null}

      {!hasActiveLoan ? (
        <Section title="Available Members">
          {loadingCandidates ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : candidates.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No members found"
              subtitle="Try another search name."
            />
          ) : (
            candidates.map((candidate) => {
              const selected = selectedGuarantorIds.includes(candidate.id);

              return (
                <TouchableOpacity
                  key={candidate.id}
                  activeOpacity={0.9}
                  onPress={() => toggleGuarantor(candidate.id)}
                >
                  <Card style={[styles.memberCard, selected && styles.memberCardSelected]}>
                    <View style={styles.memberCardTop}>
                      <View style={styles.memberLeft}>
                        <View style={[styles.avatar, selected && styles.avatarSelected]}>
                          <Ionicons
                            name={selected ? "checkmark" : "person-outline"}
                            size={16}
                            color={selected ? COLORS.white : COLORS.primary}
                          />
                        </View>

                        <View style={styles.memberTextWrap}>
                          <Text style={styles.memberName}>{candidate.full_name}</Text>
                          <Text style={styles.memberMeta}>
                            {selected ? "Selected" : "Tap to select"}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.statusPill,
                          selected ? styles.statusPillSelected : styles.statusPillDefault,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            { color: selected ? COLORS.success : COLORS.gray },
                          ]}
                        >
                          {selected ? "Selected" : "Available"}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </Section>
      ) : null}

      {!hasActiveLoan ? (
        <Card style={styles.submitCard}>
          <View style={styles.submitSummary}>
            <View style={styles.submitSummaryBox}>
              <Text style={styles.submitSummaryLabel}>Amount</Text>
              <Text style={styles.submitSummaryValue}>{amountPreview}</Text>
            </View>

            <View style={styles.submitSummaryBox}>
              <Text style={styles.submitSummaryLabel}>Guarantors</Text>
              <Text style={styles.submitSummaryValue}>{selectedGuarantorIds.length}</Text>
            </View>
          </View>

          <View style={{ height: SPACING.md }} />

          <Button
            title={submitting ? "Submitting..." : "Submit Loan Request"}
            onPress={submit}
            loading={submitting}
            disabled={!canSubmit}
          />

          <View style={{ height: SPACING.sm }} />

          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => router.back()}
            disabled={submitting}
          />
        </Card>
      ) : null}

      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 28,
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    ...SHADOW.card,
  },

  heroGlow: {
    position: "absolute",
    right: -30,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.lg,
  },

  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    marginRight: SPACING.md,
  },

  heroTextWrap: {
    flex: 1,
  },

  heroTitle: {
    fontFamily: FONT.bold,
    fontSize: 20,
    color: COLORS.white,
  },

  heroSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 18,
  },

  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    ...SHADOW.card,
  },

  overviewCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    ...SHADOW.card,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  loadingCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.card,
  },

  loadingText: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  infoCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    ...SHADOW.card,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8E8",
  },

  infoTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
    marginBottom: 4,
  },

  infoText: {
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray,
  },

  loadingWrap: {
    paddingVertical: SPACING.xl,
    alignItems: "center",
    justifyContent: "center",
  },

  gridRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  infoTile: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 88,
    justifyContent: "center",
  },

  infoTilePrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  infoLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 6,
  },

  infoValue: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  infoLabelLight: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 6,
  },

  infoValueLight: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: COLORS.white,
  },

  amountPreviewBox: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: `${COLORS.primary}10`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}18`,
  },

  amountPreviewLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 4,
  },

  amountPreviewValue: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.primary,
  },

  selectedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  selectedTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  clearText: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.primary,
  },

  helperText: {
    marginTop: 8,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  chipsWrap: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },

  chip: {
    backgroundColor: `${COLORS.primary}12`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },

  chipText: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.primary,
  },

  memberCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    ...SHADOW.card,
  },

  memberCardSelected: {
    borderColor: COLORS.success,
    backgroundColor: `${COLORS.success}08`,
  },

  memberCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.primary}14`,
    marginRight: SPACING.sm,
  },

  avatarSelected: {
    backgroundColor: COLORS.success,
  },

  memberTextWrap: {
    flex: 1,
  },

  memberName: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  memberMeta: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
  },

  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },

  statusPillDefault: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },

  statusPillSelected: {
    backgroundColor: `${COLORS.success}12`,
    borderColor: `${COLORS.success}30`,
  },

  statusPillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  submitCard: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    ...SHADOW.card,
  },

  submitSummary: {
    flexDirection: "row",
    gap: SPACING.sm,
  },

  submitSummaryBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  submitSummaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 6,
  },

  submitSummaryValue: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },
});