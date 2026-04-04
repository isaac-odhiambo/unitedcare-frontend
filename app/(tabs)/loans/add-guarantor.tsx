// app/(tabs)/loans/add-guarantor.tsx
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
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";

import { FONT, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  addGuarantor,
  getApiErrorMessage,
  getGuarantorCandidates,
  GuarantorCandidate,
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

  infoCard: "rgba(49, 180, 217, 0.22)",
  infoBorder: "rgba(189, 244, 255, 0.15)",
  infoIconBg: "rgba(236, 251, 255, 0.76)",
  infoIcon: "#0A6E8A",

  dangerCard: "rgba(220,53,69,0.18)",
};

function toPositiveInt(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function normalizeApiMessage(message: string) {
  if (!message) return "Something went wrong. Please try again.";

  const lower = message.toLowerCase();

  if (lower.includes("guarantor")) {
    return "Please select a valid member and try again.";
  }

  if (lower.includes("loan")) {
    return "Support record not found.";
  }

  if (lower.includes("already")) {
    return "This member is already linked to the support request.";
  }

  return message;
}

function CandidateRow({
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
        styles.item,
        selected && styles.itemSelected,
      ]}
    >
      <View style={styles.itemLeft}>
        <View
          style={[
            styles.itemIconWrap,
            selected ? styles.itemIconWrapSelected : null,
          ]}
        >
          <Ionicons
            name={selected ? "checkmark" : "person-outline"}
            size={16}
            color={selected ? UI.page : UI.infoIcon}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.full_name}</Text>
          <Text style={styles.itemSub}>
            {selected ? "Selected" : "Tap to select"}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
    </TouchableOpacity>
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

export default function AddGuarantorScreen() {
  const params = useLocalSearchParams<{
    loan?: string;
    loanId?: string;
  }>();

  const palette = getSpaceTonePalette("support");

  const defaultLoanId = useMemo(() => {
    return String(params.loanId ?? params.loan ?? "");
  }, [params.loan, params.loanId]);

  const [loanId, setLoanId] = useState(defaultLoanId);
  const [search, setSearch] = useState("");
  const [guarantorId, setGuarantorId] = useState("");
  const [requestNote, setRequestNote] = useState("");

  const [candidates, setCandidates] = useState<GuarantorCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const parsedLoanId = useMemo(() => toPositiveInt(loanId), [loanId]);

  const canSubmit = useMemo(() => {
    const g = toPositiveInt(guarantorId);
    return parsedLoanId > 0 && g > 0;
  }, [guarantorId, parsedLoanId]);

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
      setError(normalizeApiMessage(getApiErrorMessage(e) || getErrorMessage(e)));
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
        setError(normalizeApiMessage(getApiErrorMessage(e) || getErrorMessage(e)));
      } finally {
        if (mounted) setLoadingCandidates(false);
      }
    };

    const timer = setTimeout(run, 250);
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

  const handleBack = useCallback(() => {
    const canGoBack =
      typeof (router as any)?.canGoBack === "function"
        ? (router as any).canGoBack()
        : false;

    if (canGoBack) {
      router.back();
      return;
    }

    if (parsedLoanId > 0) {
      router.replace({
        pathname: "/(tabs)/loans/[id]" as any,
        params: { id: String(parsedLoanId) },
      });
      return;
    }

    router.replace("/(tabs)/loans" as any);
  }, [parsedLoanId]);

  const submit = useCallback(async () => {
    try {
      if (!canSubmit) {
        Alert.alert("Support", "Select a member first.");
        return;
      }

      setSubmitting(true);
      setError("");

      const res = await addGuarantor({
        loan: parsedLoanId,
        guarantor: Number(guarantorId),
        request_note: requestNote.trim(),
      });

      Alert.alert("Success", res?.message || "Request sent.", [
        {
          text: "OK",
          onPress: () =>
            router.replace({
              pathname: "/(tabs)/loans/[id]" as any,
              params: { id: String(parsedLoanId) },
            }),
        },
      ]);
    } catch (e: any) {
      const msg = normalizeApiMessage(getApiErrorMessage(e) || getErrorMessage(e));
      setError(msg);
      Alert.alert("Support", msg);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, guarantorId, parsedLoanId, requestNote]);

  if (loadingCandidates) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={UI.mint} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={UI.mint}
            colors={[UI.mint, UI.aqua]}
          />
        }
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
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroOrbThree} />

          <View style={styles.heroTopRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleBack}
              style={[styles.backButton, { backgroundColor: palette.chip }]}
            >
              <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.heroBadge}>
              <Ionicons name="people-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>MEMBER SUPPORT</Text>
            </View>
          </View>

          <View style={styles.heroHeader}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.heroTitle}>Add supporter</Text>
              <Text style={styles.heroSubtitle}>
                Choose a community member to support this request.
              </Text>
            </View>

            <View
              style={[
                styles.heroIconWrap,
                { backgroundColor: palette.iconBg },
              ]}
            >
              <Ionicons name="people-outline" size={22} color={palette.icon} />
            </View>
          </View>

          <View style={styles.heroMiniWrap}>
            <View
              style={[
                styles.heroMiniPill,
                { backgroundColor: palette.amountBg },
              ]}
            >
              <Ionicons name="document-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroMiniText}>
                Support #{parsedLoanId || "—"}
              </Text>
            </View>

            <View
              style={[
                styles.heroMiniPill,
                { backgroundColor: palette.amountBg },
              ]}
            >
              <Ionicons name="person-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroMiniText}>
                {selectedCandidate ? selectedCandidate.full_name : "Select member"}
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

        <SectionCard title="Support">
          <Input
            label="Support ID"
            value={loanId}
            onChangeText={setLoanId}
            keyboardType="number-pad"
          />
        </SectionCard>

        <SectionCard title="Find member">
          <Input
            label="Search member"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name"
          />
        </SectionCard>

        <SectionCard title="Members">
          {candidates.length === 0 ? (
            <EmptyState title="No members found" subtitle="Try another name." />
          ) : (
            <View style={styles.list}>
              {candidates.map((c) => {
                const selected = guarantorId === String(c.id);

                return (
                  <CandidateRow
                    key={c.id}
                    item={c}
                    selected={selected}
                    onPress={() => selectCandidate(c)}
                  />
                );
              })}
            </View>
          )}
        </SectionCard>

        <SectionCard title="Note">
          <Input
            label="Optional note"
            value={requestNote}
            onChangeText={setRequestNote}
            placeholder="Add a short message"
          />
        </SectionCard>

        <View style={styles.actions}>
          <Button
            title={submitting ? "Sending..." : "Send request"}
            onPress={submit}
            loading={submitting}
            disabled={!canSubmit || submitting}
          />
          <View style={{ height: 10 }} />
          <Button title="Cancel" variant="secondary" onPress={handleBack} />
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
    paddingBottom: SPACING.xl,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: UI.page,
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
    top: 260,
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

  heroOrbOne: {
    position: "absolute",
    top: -34,
    right: -14,
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroOrbTwo: {
    position: "absolute",
    bottom: -26,
    left: -16,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  heroOrbThree: {
    position: "absolute",
    top: 76,
    right: 42,
    width: 74,
    height: 74,
    borderRadius: 37,
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
    fontSize: 18,
    lineHeight: 24,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 8,
  },

  heroSubtitle: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 21,
    color: UI.textSoft,
    fontFamily: FONT.regular,
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

  list: {
    gap: SPACING.sm,
  },

  item: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: UI.infoCard,
    borderWidth: 1,
    borderColor: UI.infoBorder,
  },

  itemSelected: {
    borderColor: "rgba(140,240,199,0.30)",
    backgroundColor: "rgba(140,240,199,0.16)",
  },

  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  itemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: UI.infoIconBg,
  },

  itemIconWrapSelected: {
    backgroundColor: UI.mint,
  },

  itemTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  itemSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  actions: {
    marginTop: SPACING.sm,
  },
});