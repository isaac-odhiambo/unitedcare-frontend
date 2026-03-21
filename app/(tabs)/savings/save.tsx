import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getMe } from "@/services/profile";
import { listMySavingsAccounts, SavingsAccount } from "@/services/savings";

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getPrimaryAccount(accounts: SavingsAccount[]) {
  return (
    accounts.find((a) => a.account_type === "FLEXIBLE") || accounts[0]
  );
}

export default function SavingsSaveScreen() {
  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const primaryAccount = useMemo(
    () => getPrimaryAccount(accounts),
    [accounts]
  );

  const load = useCallback(async () => {
    try {
      const [me, acc] = await Promise.all([
        getMe(),
        listMySavingsAccounts(),
      ]);

      setUser(me);
      setAccounts(acc);
    } catch (e: any) {
      console.log(getErrorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        setLoading(true);
        await load();
        setLoading(false);
      };
      run();
    }, [load])
  );

  const handleContinue = () => {
    if (!primaryAccount) return;

    router.push({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        purpose: "SAVINGS_DEPOSIT",
        reference: `saving${user?.id}`,
        narration: "Savings deposit",
        phone: user?.phone || "",
        returnTo: ROUTES.tabs.savings,
        title: "Save Money",
        subtitle: "Deposit to Main Wallet",
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

  if (!primaryAccount) {
    return (
      <EmptyState
        title="No Wallet"
        subtitle="Create wallet first"
        actionLabel="Create Wallet"
        onAction={() => router.push(ROUTES.tabs.savingsCreate as any)}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Save Money</Text>
        <Text style={styles.subtitle}>
          Deposit directly to your main wallet
        </Text>
      </View>

      <Section title="Main Wallet">
        <Card>
          <Text style={styles.walletName}>
            {primaryAccount.name || "Main Wallet"}
          </Text>

          <Text style={styles.balance}>
            {formatKes(primaryAccount.balance)}
          </Text>

          <Text style={styles.label}>
            Available: {formatKes(primaryAccount.available_balance)}
          </Text>

          <View style={{ marginTop: 16 }}>
            <Button title="Continue to Payment" onPress={handleContinue} />
          </View>
        </Card>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  hero: {
    padding: SPACING.lg,
    backgroundColor: COLORS.primary,
  },

  title: {
    color: "#fff",
    fontSize: 20,
    fontFamily: FONT.bold,
  },

  subtitle: {
    color: "#fff",
    marginTop: 4,
  },

  walletName: {
    fontSize: 16,
    fontFamily: FONT.bold,
  },

  balance: {
    fontSize: 22,
    marginTop: 6,
    fontFamily: FONT.bold,
  },

  label: {
    marginTop: 6,
    color: "#64748B",
  },
});