// app/(tabs)/groups/contribute.tsx
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getGroup } from "@/services/groups";

function cleanAmount(v: string) {
  return (v || "").replace(/[^\d.]/g, "");
}

export default function GroupContributeScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId ?? 0);

  const [group, setGroup] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);

  const cleanAmt = useMemo(() => cleanAmount(amount), [amount]);

  const canSubmit = useMemo(() => {
    return Number(cleanAmt) > 0 && Number.isFinite(groupId) && groupId > 0;
  }, [cleanAmt, groupId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getGroup(groupId);
      setGroup(data);
    } catch {
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handlePay = () => {
    if (!canSubmit) return;

    router.push({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        title: "Group Contribution",
        purpose: "GROUP_CONTRIBUTION",
        reference: `grp${groupId}`,
        narration: "Group contribution",
        amount: cleanAmt,
        groupId: String(groupId),
        returnTo: ROUTES.dynamic.groupDetail(groupId),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Group Contribution</Text>
        <Text style={styles.sub}>{group?.name || ""}</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.label}>Amount</Text>

        <TextInput
          value={amount}
          onChangeText={(v) => setAmount(cleanAmount(v))}
          placeholder="500"
          keyboardType="numeric"
          style={styles.input}
        />

        <View style={{ height: SPACING.lg }} />

        <Button
          title="Pay"
          onPress={handlePay}
          disabled={!canSubmit}
        />
      </Card>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { marginBottom: SPACING.lg },

  title: {
    fontSize: 18,
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  sub: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },

  label: {
    fontSize: 12,
    marginBottom: 8,
    color: COLORS.textMuted,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 14,
  },
});