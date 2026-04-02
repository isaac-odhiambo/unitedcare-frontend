import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";

import { FONT } from "@/constants/theme";
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
        Alert.alert("Support", "Select a member first.");
        return;
      }

      setSubmitting(true);
      setError("");

      const res = await addGuarantor({
        loan: Number(loanId),
        guarantor: Number(guarantorId),
        request_note: requestNote.trim(),
      });

      Alert.alert("Success", res?.message || "Request sent.");
      router.replace(`/(tabs)/loans/${Number(loanId)}` as any);
    } catch (e: any) {
      const msg = getApiErrorMessage(e) || getErrorMessage(e);
      setError(msg);
      Alert.alert("Support", msg);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, guarantorId, loanId, requestNote]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* HEADER */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Add supporter</Text>
        <Text style={styles.heroSub}>
          Choose a community member to support this request
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* LOAN */}
      <Section title="Support">
        <View style={styles.card}>
          <Input
            label="Support ID"
            value={loanId}
            onChangeText={setLoanId}
            keyboardType="number-pad"
          />
        </View>
      </Section>

      {/* SEARCH */}
      <Section title="Find member">
        <View style={styles.card}>
          <Input
            label="Search member"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name"
          />
        </View>
      </Section>

      {/* LIST */}
      <Section title="Members">
        {loadingCandidates ? (
          <ActivityIndicator color="#8CF0C7" />
        ) : candidates.length === 0 ? (
          <EmptyState title="No members found" />
        ) : (
          candidates.map((c) => {
            const selected = guarantorId === String(c.id);

            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.item,
                  selected && { borderColor: "#8CF0C7" },
                ]}
                onPress={() => selectCandidate(c)}
              >
                <Text style={styles.itemTitle}>{c.full_name}</Text>
                <Text style={styles.itemSub}>
                  {selected ? "Selected" : "Tap to select"}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </Section>

      {/* NOTE */}
      <Section title="Note">
        <View style={styles.card}>
          <Input
            label="Optional note"
            value={requestNote}
            onChangeText={setRequestNote}
          />
        </View>
      </Section>

      {/* ACTIONS */}
      <View style={styles.actions}>
        <Button
          title={submitting ? "Sending..." : "Send request"}
          onPress={submit}
          disabled={!canSubmit}
        />
        <View style={{ height: 10 }} />
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  content: {
    padding: 16,
  },

  hero: {
    marginBottom: 16,
  },

  heroTitle: {
    fontSize: 22,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  heroSub: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },

  card: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  item: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(49,180,217,0.22)",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(189,244,255,0.15)",
  },

  itemTitle: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  itemSub: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },

  actions: {
    marginTop: 20,
  },

  errorBox: {
    padding: 12,
    backgroundColor: "rgba(220,53,69,0.18)",
    borderRadius: 12,
    marginBottom: 10,
  },

  errorText: {
    color: "#FFFFFF",
  },
});