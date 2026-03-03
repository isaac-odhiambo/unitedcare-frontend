// app/(tabs)/dashboard/index.tsx

import { Ionicons } from "@expo/vector-icons";
import type { RelativePathString } from "expo-router";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getSessionUser, SessionUser } from "@/services/session";

/* =========================================================
   ROUTES (RELATIVE to /dashboard)
   ✅ This matches your app/(tabs) folder structure
========================================================= */
const ROUTES = {
  profile: "../profile",
  savings: "../savings",
  loans: "../loans",
  merry: "../merry",
  payments: "../payments",
  paymentHistory: "../payments/history",
} as const satisfies Record<string, RelativePathString>;

const go = (href: RelativePathString) => router.push(href);

/* =========================================================
   Tile UI
========================================================= */
function Tile({
  title,
  subtitle,
  icon,
  onPress,
  disabled,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.tile, disabled && styles.tileDisabled]}
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
    >
      <View style={styles.tileIcon}>{icon}</View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSubtitle}>{subtitle}</Text>

      {disabled ? (
        <View style={styles.lockPill}>
          <Ionicons name="lock-closed-outline" size={14} color={COLORS.gray} />
          <Text style={styles.lockText}>Locked</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/* =========================================================
   Types
========================================================= */
type Ctx = {
  user: SessionUser | null;
  isAdmin: boolean;
  kycApproved: boolean;
  openLocked: () => void;
};

type DashboardTile = {
  key: string;
  title: string;
  subtitle: (ctx: Ctx) => string;
  icon: (color: string) => React.ReactNode;
  route?: RelativePathString;
  onPress?: (ctx: Ctx) => void;
  requiresKyc?: boolean;
  requiresAdmin?: boolean;
};

type DashboardSection = {
  title: string;
  tiles: DashboardTile[];
};

/* =========================================================
   Sections (organized links)
========================================================= */
const SECTIONS: DashboardSection[] = [
  {
    title: "Savings",
    tiles: [
      {
        key: "add-savings",
        title: "Add Savings",
        subtitle: () => "Deposit into your wallet",
        icon: (c) => <Ionicons name="add-circle-outline" size={22} color={c} />,
        route: ROUTES.savings,
      },
      {
        key: "withdraw",
        title: "Withdraw",
        subtitle: (ctx) =>
          ctx.kycApproved ? "Withdraw to M-Pesa" : "Locked until KYC approved",
        icon: (c) =>
          <Ionicons name="arrow-down-circle-outline" size={22} color={c} />,
        requiresKyc: true,
        onPress: (ctx) => {
          if (!ctx.kycApproved) return ctx.openLocked();
          Alert.alert("Withdraw", "Create a withdraw screen inside savings.");
          go(ROUTES.savings);
        },
      },
    ],
  },
  {
    title: "Loans",
    tiles: [
      {
        key: "apply-loan",
        title: "Apply Loan",
        subtitle: (ctx) =>
          ctx.kycApproved ? "Request a loan instantly" : "Locked until KYC approved",
        icon: (c) =>
          <Ionicons name="document-text-outline" size={22} color={c} />,
        requiresKyc: true,
        route: ROUTES.loans,
      },
      {
        key: "loan-payment",
        title: "Loan Repayment",
        subtitle: (ctx) =>
          ctx.kycApproved ? "Pay your loan installment" : "Locked until KYC approved",
        icon: (c) => <Ionicons name="cash-outline" size={22} color={c} />,
        requiresKyc: true,
        route: ROUTES.payments,
      },
    ],
  },
  {
    title: "Payments",
    tiles: [
      {
        key: "pay",
        title: "Make Payment",
        subtitle: () => "Pay contributions / loans",
        icon: (c) => <Ionicons name="card-outline" size={22} color={c} />,
        route: ROUTES.payments,
      },
      {
        key: "history",
        title: "Payment History",
        subtitle: () => "View all transactions",
        icon: (c) => <Ionicons name="receipt-outline" size={22} color={c} />,
        route: ROUTES.paymentHistory,
      },
    ],
  },
  {
    title: "Merry Go Round",
    tiles: [
      {
        key: "merry",
        title: "Merry Go Round",
        subtitle: (ctx) =>
          ctx.kycApproved ? "View rotation & status" : "Locked until KYC approved",
        icon: (c) => <Ionicons name="people-outline" size={22} color={c} />,
        requiresKyc: true,
        route: ROUTES.merry,
      },
      {
        key: "merry-pay",
        title: "Merry Payments",
        subtitle: (ctx) =>
          ctx.kycApproved ? "Pay your turn contribution" : "Locked until KYC approved",
        icon: (c) => <Ionicons name="repeat-outline" size={22} color={c} />,
        requiresKyc: true,
        onPress: (ctx) => {
          if (!ctx.kycApproved) return ctx.openLocked();
          Alert.alert("Merry Payments", "Put this inside /merry or /payments.");
          go(ROUTES.merry);
        },
      },
    ],
  },
  {
    title: "Account",
    tiles: [
      {
        key: "profile",
        title: "My Profile",
        subtitle: () => "Account & settings",
        icon: (c) =>
          <Ionicons name="person-circle-outline" size={22} color={c} />,
        route: ROUTES.profile,
      },
      {
        key: "support",
        title: "Support",
        subtitle: () => "Help & contact",
        icon: (c) => <Ionicons name="help-circle-outline" size={22} color={c} />,
        onPress: () => Alert.alert("Support", "Add support screen later."),
      },
    ],
  },
];

/* helper: split array into rows of N */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* =========================================================
   Screen
========================================================= */
export default function DashboardScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);

  const load = useCallback(async () => {
    const u = await getSessionUser();
    setUser(u);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isAdmin = useMemo(
    () => !!(user?.is_admin || user?.role === "admin"),
    [user]
  );

  const kycApproved = useMemo(() => user?.status === "approved", [user]);

  const openLocked = useCallback(() => {
    Alert.alert(
      "KYC Required",
      "Complete your KYC to unlock loans, merry-go-round, and withdrawals."
    );
  }, []);

  const ctx: Ctx = useMemo(
    () => ({ user, isAdmin, kycApproved, openLocked }),
    [user, isAdmin, kycApproved, openLocked]
  );

  const onTilePress = useCallback(
    (tile: DashboardTile) => {
      if (tile.requiresAdmin && !ctx.isAdmin) return;

      if (tile.requiresKyc && !ctx.kycApproved) return ctx.openLocked();

      if (tile.onPress) return tile.onPress(ctx);

      if (tile.route) return go(tile.route);

      Alert.alert("Route missing", "Add a route or onPress for this tile.");
    },
    [ctx]
  );

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 18 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.appName}>UNITED CARE</Text>
            <Text style={styles.subtitle}>
              {isAdmin ? "Admin Panel" : "Self Help Group"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => go(ROUTES.profile)}
            style={styles.profilePill}
            activeOpacity={0.9}
          >
            <Ionicons
              name="person-circle-outline"
              size={24}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />
      </View>

      {/* KYC banner */}
      {!isAdmin && !kycApproved ? (
        <View style={styles.kycBanner}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Ionicons name="alert-circle-outline" size={20} color="#7A5B00" />
            <Text style={styles.kycTitle}>Complete KYC to unlock features</Text>
          </View>

          <Text style={styles.kycText}>
            Savings are available now. Loans, merry-go-round and withdrawals will
            unlock after approval.
          </Text>

          <TouchableOpacity
            onPress={() => go(ROUTES.profile)}
            style={styles.kycBtn}
            activeOpacity={0.9}
          >
            <Text style={styles.kycBtnText}>Go to Profile</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Summary Cards (replace with API later) */}
      <View style={styles.cardRow}>
        <View style={[styles.card, { backgroundColor: COLORS.success }]}>
          <Ionicons name="wallet" size={28} color={COLORS.white} />
          <Text style={styles.cardLabel}>
            {isAdmin ? "Total Collections" : "Total Savings"}
          </Text>
          <Text style={styles.cardValue}>
            {isAdmin ? "KES 540,000" : "KES 25,000"}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: COLORS.accent }]}>
          <Ionicons name="cash" size={28} color={COLORS.white} />
          <Text style={styles.cardLabel}>
            {isAdmin ? "Active Loans" : "Outstanding Loans"}
          </Text>
          <Text style={styles.cardValue}>{isAdmin ? "62" : "KES 10,000"}</Text>
        </View>
      </View>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <View key={section.title} style={{ marginBottom: SPACING.md }}>
          <Text style={styles.sectionTitle}>{section.title}</Text>

          {chunk(section.tiles, 2).map((row, idx) => (
            <View key={`${section.title}-row-${idx}`} style={styles.tileRow}>
              {row.map((tile) => {
                const disabled =
                  (tile.requiresKyc && !ctx.kycApproved) ||
                  (tile.requiresAdmin && !ctx.isAdmin);

                return (
                  <Tile
                    key={tile.key}
                    title={tile.title}
                    subtitle={tile.subtitle(ctx)}
                    icon={tile.icon(COLORS.primary)}
                    disabled={disabled}
                    onPress={() => onTilePress(tile)}
                  />
                );
              })}

              {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/* =========================================================
   Styles
========================================================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
  },

  header: {
    marginBottom: SPACING.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appName: {
    fontSize: FONT.title,
    fontWeight: "800",
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: FONT.subtitle,
    color: COLORS.gray,
    marginTop: 2,
  },
  profilePill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginTop: SPACING.md,
    opacity: 0.7,
  },

  kycBanner: {
    borderWidth: 1,
    borderColor: "#FFE08A",
    backgroundColor: "#FFF8E1",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    gap: 8,
  },
  kycTitle: {
    fontWeight: "800",
    color: "#7A5B00",
    fontSize: 14,
  },
  kycText: {
    color: "#7A5B00",
    lineHeight: 18,
  },
  kycBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#7A5B00",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 6,
  },
  kycBtnText: {
    color: "white",
    fontWeight: "800",
  },

  cardRow: {
    flexDirection: "row",
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  card: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 2,
  },
  cardLabel: {
    color: COLORS.white,
    fontSize: 14,
    marginTop: SPACING.sm,
    opacity: 0.95,
  },
  cardValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "800",
    marginTop: SPACING.xs,
  },

  sectionTitle: {
    fontSize: FONT.section,
    fontWeight: "800",
    color: COLORS.dark,
    marginVertical: SPACING.sm,
  },

  tileRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  tileDisabled: {
    opacity: 0.55,
  },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  tileTitle: {
    fontSize: FONT.body,
    fontWeight: "800",
    color: COLORS.dark,
  },
  tileSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.gray,
  },

  lockPill: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: "#F3F4F6",
  },
  lockText: {
    color: COLORS.gray,
    fontWeight: "700",
    fontSize: 12,
  },
});