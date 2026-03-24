// app/(tabs)/groups/contribute.tsx

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getGroup, Group } from "@/services/groups";

type Params = {
  groupId?: string;
};

function toSafeAmount(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

export default function GroupContributeScreen() {
  const params = useLocalSearchParams<Params>();
  const groupId = Number(params.groupId ?? 0);

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const redirectedRef = useRef(false);

  const suggestedAmount = useMemo(() => {
    return toSafeAmount(group?.contribution_amount);
  }, [group?.contribution_amount]);

  const goToDeposit = useCallback(
    (loadedGroup?: Group | null) => {
      if (redirectedRef.current) return;
      if (!Number.isFinite(groupId) || groupId <= 0) return;

      redirectedRef.current = true;

      const groupName = String(loadedGroup?.name || "Group").trim();
      const narration = groupName
        ? `${groupName} contribution`
        : "Group contribution";

      router.replace({
        pathname: ROUTES.tabs.paymentsDeposit as any,
        params: {
          title: "Group Contribution",
          purpose: "GROUP_CONTRIBUTION",
          reference: `grp${groupId}`,
          narration,
          amount: suggestedAmount,
          groupId: String(groupId),
          returnTo: ROUTES.dynamic.groupDetail(groupId),
        },
      });
    },
    [groupId, suggestedAmount]
  );

  const loadAndContinue = useCallback(async () => {
    if (!Number.isFinite(groupId) || groupId <= 0) {
      setFailed(true);
      setLoading(false);
      return;
    }

    try {
      setFailed(false);
      setLoading(true);

      const data = await getGroup(groupId);
      setGroup(data ?? null);
      goToDeposit(data ?? null);
    } catch {
      setGroup(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [goToDeposit, groupId]);

  useFocusEffect(
    useCallback(() => {
      redirectedRef.current = false;
      loadAndContinue();
    }, [loadAndContinue])
  );

  if (loading) {
    return (
      <View style={styles.page}>
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingTitle}>Preparing payment</Text>
          <Text style={styles.loadingText}>
            Opening the payment screen for this group contribution.
          </Text>
        </Card>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Unable to open contribution"
          subtitle="We could not prepare the payment screen for this group."
          actionLabel="Back to Group"
          onAction={() => {
            if (Number.isFinite(groupId) && groupId > 0) {
              router.replace(ROUTES.dynamic.groupDetail(groupId) as any);
            } else {
              router.back();
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Card style={styles.loadingCard}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.loadingTitle}>Preparing payment</Text>
        <Text style={styles.loadingText}>
          Opening the payment screen for this group contribution.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    justifyContent: "center",
  },

  loadingCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl || RADIUS.lg,
    backgroundColor: COLORS.card || "#14202f",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    ...SHADOW.card,
  },

  loadingTitle: {
    marginTop: SPACING.md,
    fontSize: 16,
    fontFamily: FONT.bold,
    color: COLORS.text,
    textAlign: "center",
  },

  loadingText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});