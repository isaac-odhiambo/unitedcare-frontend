import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";
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
  const [hasBootstrapped, setHasBootstrapped] = useState(false);

  const redirectedRef = useRef(false);

  const suggestedAmount = useMemo(() => {
    return toSafeAmount(group?.contribution_amount);
  }, [group?.contribution_amount]);

  const goToDeposit = useCallback(
    (loadedGroup?: Group | null) => {
      if (redirectedRef.current) return;
      if (!Number.isFinite(groupId) || groupId <= 0) return;

      redirectedRef.current = true;

      const groupName = String(loadedGroup?.name || "Community space").trim();

      const narration = groupName
        ? `${groupName} contribution`
        : "Community contribution";

      router.replace({
        pathname: ROUTES.tabs.paymentsDeposit as any,
        params: {
          title: "Community Contribution",
          purpose: "GROUP_CONTRIBUTION",

          // In-app STK can continue using group-based reference.
          reference: `GROUP${groupId}`,

          // Manual paybill can use this in deposit.tsx to build UN2, WF15, etc.
          groupCode: (loadedGroup as any)?.payment_code || "",

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

      const run = async () => {
        try {
          await loadAndContinue();
        } finally {
          setHasBootstrapped(true);
        }
      };

      run();
    }, [loadAndContinue])
  );

  if (!hasBootstrapped) {
    return <View style={styles.page} />;
  }

  if (failed) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Unable to open contribution"
          subtitle="We could not prepare your community contribution space right now."
          actionLabel="Back to space"
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
      <View style={styles.card}>
        <Text style={styles.title}>Preparing your contribution</Text>
        <Text style={styles.subtitle}>
          Taking you to your community contribution screen...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0C6A80",
    padding: SPACING.lg,
    justifyContent: "center",
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  card: {
    padding: SPACING.lg,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },

  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.90)",
  },

  title: {
    marginTop: SPACING.md,
    fontSize: 16,
    fontFamily: FONT.bold,
    color: "#FFFFFF",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
  },
});