import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

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
    return <ActivityIndicator color={COLORS.primary} />;
  }

  return (
    <ScrollView style={{ padding: SPACING.lg }}>
      <Section title="Guarantee Requests">
        {data.length === 0 ? (
          <EmptyState
            title="No requests"
            subtitle="You have no pending guarantee requests"
          />
        ) : (
          data.map((g) => (
            <Card key={g.id} style={{ marginBottom: SPACING.md }}>
              <Text>Loan ID: {g.loan}</Text>
              <Text>
                Borrower: {g.guarantor_detail?.full_name || "User"}
              </Text>
              <Text>Status: {g.accepted ? "Accepted" : "Pending"}</Text>

              {!g.accepted && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
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
  );
}