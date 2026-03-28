import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { COLORS, SPACING } from "@/constants/theme";
import {
  acceptGuarantee,
  getMyGuaranteeRequests,
  rejectGuarantee,
} from "@/services/loans";

export default function GuaranteeRequestsScreen() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await getMyGuaranteeRequests();
      setData(res);
    } catch (e) {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const handleAccept = async (id: number) => {
    await acceptGuarantee(id);
    load();
  };

  const handleReject = async (id: number) => {
    await rejectGuarantee(id);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Section title="Guarantee Requests">
          {data.length === 0 ? (
            <EmptyState
              title="No requests"
              subtitle="You have no pending guarantee requests"
            />
          ) : (
            data.map((g) => (
              <Card key={g.id} style={styles.card}>
                <Text>Loan ID: {g.loan}</Text>
                <Text>
                  Borrower: {g.guarantor_detail?.full_name || "User"}
                </Text>
                <Text>Status: {g.accepted ? "Accepted" : "Pending"}</Text>

                {!g.accepted && (
                  <View style={styles.actionsRow}>
                    <Button
                      title="Accept"
                      onPress={() => handleAccept(g.id)}
                    />
                    <Button
                      title="Reject"
                      variant="secondary"
                      onPress={() => handleReject(g.id)}
                    />
                  </View>
                )}
              </Card>
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  card: {
    marginBottom: SPACING.md,
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
});