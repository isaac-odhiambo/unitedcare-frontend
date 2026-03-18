import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
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
  addGuarantor,
  getApiErrorMessage,
  getGuarantorCandidates,
  GuarantorCandidate,
} from "@/services/loans";

export default function AddGuarantorScreen() {
  const params = useLocalSearchParams();
  const loanFromParams = params.loan ? String(params.loan) : "";
  const defaultLoanId =
    loanFromParams && !Number.isNaN(Number(loanFromParams)) ? loanFromParams : "";

  const [loanId, setLoanId] = useState(defaultLoanId);
  const [search, setSearch] = useState("");
  const [guarantorId, setGuarantorId] = useState("");
  const [requestNote, setRequestNote] = useState("");

  const [candidates, setCandidates] = useState<GuarantorCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    const l = Number(loanId);
    const g = Number(guarantorId);
    return Number.isFinite(l) && l > 0 && Number.isFinite(g) && g > 0;
  }, [loanId, guarantorId]);

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.id === Number(guarantorId)) ?? null,
    [candidates, guarantorId]
  );

  const loadCandidates = useCallback(async (q?: string) => {
    try {
      setError("");
      const rows = await getGuarantorCandidates(q);
      setCandidates(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setCandidates([]);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoadingCandidates(true);
        const rows = await getGuarantorCandidates(search.trim());
        if (!mounted) return;
        setCandidates(Array.isArray(rows) ? rows : []);
        setError("");
      } catch (e: any) {
        if (!mounted) return;
        setCandidates([]);
        setError(getApiErrorMessage(e) || getErrorMessage(e));
      } finally {
        if (mounted) setLoadingCandidates(false);
      }
    };

    const timer = setTimeout(run, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [search]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadCandidates(search.trim());
    } finally {
      setRefreshing(false);
    }
  }, [loadCandidates, search]);

  const selectCandidate = useCallback((candidate: GuarantorCandidate) => {
    setGuarantorId(String(candidate.id));
  }, []);

  const submit = useCallback(async () => {
    try {
      if (!canSubmit) {
        Alert.alert("Add Guarantor", "Select a valid guarantor first.");
        return;
      }

      setSubmitting(true);
      setError("");

      const res = await addGuarantor({
        loan: Number(loanId),
        guarantor: Number(guarantorId),
        request_note: requestNote.trim(),
      });

      Alert.alert("Success", res?.message || "Guarantor request sent.");
      router.replace(`/(tabs)/loans/${Number(loanId)}` as any);
    } catch (e: any) {
      const msg = getApiErrorMessage(e) || getErrorMessage(e);
      setError(msg);
      Alert.alert("Add Guarantor", msg);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, guarantorId, loanId, requestNote]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Add Guarantor</Text>
        <Text style={styles.sub}>
          Choose a member to receive a guarantor request for this loan.
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

      <Section title="Loan">
        <Card style={styles.card}>
          <Input
            label="Loan ID"
            value={loanId}
            onChangeText={setLoanId}
            placeholder="e.g. 12"
            keyboardType="number-pad"
          />
          <Text style={styles.note}>
            This request will be attached to the selected loan.
          </Text>
        </Card>
      </Section>

      <Section title="Find Guarantor">
        <Card style={styles.card}>
          <Input
            label="Search member"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name"
          />

          <Text style={styles.note}>
            Pick a member from the list below. The backend will still validate
            whether they can guarantee this loan.
          </Text>
        </Card>
      </Section>

      <Section title="Candidates">
        {loadingCandidates ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No candidates found"
            subtitle="Try a different search term or pull to refresh."
          />
        ) : (
          candidates.map((candidate) => {
            const selected = guarantorId === String(candidate.id);

            return (
              <Card key={candidate.id} style={styles.itemCard}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.itemTitle}>{candidate.full_name}</Text>
                    <Text style={styles.itemSub}>Available member</Text>
                  </View>

                  {selected ? (
                    <Text style={[styles.badge, { color: COLORS.success }]}>
                      SELECTED
                    </Text>
                  ) : null}
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    title={selected ? "Selected" : "Select"}
                    onPress={() => selectCandidate(candidate)}
                    variant={selected ? "secondary" : "primary"}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            );
          })
        )}
      </Section>

      <Section title="Request Note">
        <Card style={styles.card}>
          <Input
            label="Optional note"
            value={requestNote}
            onChangeText={setRequestNote}
            placeholder="Add a short note for the guarantor"
          />
          {selectedCandidate ? (
            <Text style={styles.note}>
              Selected guarantor: {selectedCandidate.full_name}
            </Text>
          ) : (
            <Text style={styles.note}>No guarantor selected yet.</Text>
          )}
        </Card>
      </Section>

      <View style={styles.actions}>
        <Button
          title={submitting ? "Sending..." : "Send Request"}
          onPress={submit}
          loading={submitting}
          disabled={!canSubmit || submitting}
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

  note: {
    marginTop: 8,
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

  actions: {
    marginTop: SPACING.lg,
  },
});