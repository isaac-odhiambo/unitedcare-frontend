import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
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
        setCandidates(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (!mounted) return;
        setCandidates([]);
        setError(getApiErrorMessage(e) || getErrorMessage(e));
      } finally {
        if (mounted) setLoadingCandidates(false);
      }
    }, 300);

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

  const selectedNames = useMemo(() => {
    const map = new Map(candidates.map((c) => [c.id, c.full_name]));
    return selectedGuarantorIds.map((id) => map.get(id) || "Selected member");
  }, [candidates, selectedGuarantorIds]);

  const submit = async () => {
    try {
      if (!eligibility?.eligible) {
        Alert.alert(
          "Loan Request",
          eligibility?.reason || "You are not eligible to request a loan right now."
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

      Alert.alert("Success", res?.message || "Loan request submitted.");
      router.replace(`/(tabs)/loans/${res.loan.id}` as any);
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
      <View style={styles.header}>
        <Text style={styles.title}>Request Loan</Text>
        <Text style={styles.sub}>
          Enter the amount you need, choose repayment weeks, and select guarantor(s).
        </Text>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Section title="Eligibility">
        <Card style={styles.card}>
          {loadingEligibility ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : !eligibility ? (
            <EmptyState
              title="Eligibility unavailable"
              subtitle="Please try again in a moment."
            />
          ) : (
            <View style={styles.group}>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Eligible now</Text>
                <Text
                  style={[
                    styles.kvValue,
                    { color: eligibility.eligible ? COLORS.success : COLORS.warning },
                  ]}
                >
                  {eligibility.eligible ? "Yes" : "Not yet"}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Available savings</Text>
                <Text style={styles.kvValue}>
                  {formatKes(eligibility.available_savings)}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Maximum request</Text>
                <Text style={styles.kvValue}>
                  {formatKes(eligibility.max_allowed)}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Active loan</Text>
                <Text style={styles.kvValue}>
                  {eligibility.has_active_loan ? "Yes" : "No"}
                </Text>
              </View>

              {eligibility.reason ? (
                <Text style={styles.note}>{eligibility.reason}</Text>
              ) : null}
            </View>
          )}
        </Card>
      </Section>

      <Section title="Loan Details">
        <Card style={styles.card}>
          <Input
            label="Amount (KES)"
            value={principal}
            onChangeText={setPrincipal}
            placeholder="e.g. 10000"
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
            label="Optional note"
            value={memberNote}
            onChangeText={setMemberNote}
            placeholder="Reason for the loan"
          />
        </Card>
      </Section>

      <Section title="Search Guarantors">
        <Card style={styles.card}>
          <Input
            label="Search member"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name"
          />

          <Text style={styles.note}>
            Select one or more guarantors. The system will validate them before approval.
          </Text>
        </Card>
      </Section>

      <Section title="Available Guarantors">
        {loadingCandidates ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No guarantors found"
            subtitle="Try a different search term."
          />
        ) : (
          candidates.map((candidate) => {
            const selected = selectedGuarantorIds.includes(candidate.id);

            return (
              <Card key={candidate.id} style={styles.itemCard}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.itemTitle}>{candidate.full_name}</Text>
                    <Text style={styles.itemSub}>Available member</Text>
                  </View>

                  <Text
                    style={[
                      styles.badge,
                      { color: selected ? COLORS.success : COLORS.gray },
                    ]}
                  >
                    {selected ? "SELECTED" : "AVAILABLE"}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    title={selected ? "Remove" : "Select"}
                    variant={selected ? "secondary" : "primary"}
                    onPress={() => toggleGuarantor(candidate.id)}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            );
          })
        )}
      </Section>

      <Section title="Selected Guarantors">
        <Card style={styles.card}>
          {selectedNames.length === 0 ? (
            <Text style={styles.note}>No guarantor selected yet.</Text>
          ) : (
            <View style={styles.group}>
              {selectedNames.map((name, index) => (
                <Text key={`${name}-${index}`} style={styles.selectedItem}>
                  • {name}
                </Text>
              ))}
            </View>
          )}
        </Card>
      </Section>

      <View style={styles.actions}>
        <Button
          title={submitting ? "Submitting..." : "Submit Request"}
          onPress={submit}
          loading={submitting}
          disabled={!formState.canSubmit || !eligibility?.eligible || submitting}
        />
        <View style={{ height: SPACING.sm }} />
        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => router.back()}
          disabled={submitting}
        />
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  header: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  card: {
    padding: SPACING.md,
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
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  loadingWrap: {
    paddingVertical: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  group: {
    gap: 12,
  },

  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  kvLabel: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  kvValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },

  note: {
    marginTop: 8,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  itemTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  itemSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  badge: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  selectedItem: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.dark,
    lineHeight: 18,
  },

  actions: {
    marginTop: SPACING.lg,
  },
});