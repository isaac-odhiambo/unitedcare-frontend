// app/(tabs)/profile/index.tsx
import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { clearAuthTokens, getErrorMessage } from "@/services/api";
import {
  canJoinGroup,
  canJoinMerry,
  canRequestLoan,
  canWithdraw,
  getMe,
  isAdminUser,
  isApprovedUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import {
  clearSessionUser,
  getSessionUser,
  mergeSessionUser,
  SessionUser,
} from "@/services/session";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ProfileUser = Partial<MeResponse> & Partial<SessionUser>;

export default function ProfileHome() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const merged: ProfileUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(merged);

      if (meUser) {
        const next = await mergeSessionUser({
          username: meUser?.username,
          phone: meUser?.phone,
          email: meUser?.email ?? null,
          role: meUser?.role,
          status: meUser?.status,
          is_admin: !!(meUser?.is_admin || meUser?.role === "admin"),
          kyc_completed: !!meUser?.kyc_completed,
          kyc_status: meUser?.kyc_status ?? null,
        } as any);
        setUser((prev) => ({
          ...(prev ?? {}),
          ...(next ?? {}),
          ...(meUser ?? {}),
        }));
      }

      if (meRes.status === "rejected") {
        const err: any = meRes.reason;
        const msg = (getErrorMessage(err) || "").toLowerCase();

        if (msg.includes("token") || err?.response?.status === 401) {
          await clearAuthTokens();
          await clearSessionUser();
          router.replace(ROUTES.auth.login);
          return;
        }

        setError(getErrorMessage(err));
      }
    } catch (e: any) {
      const msg = (getErrorMessage(e) || "").toLowerCase();
      if (msg.includes("token") || e?.response?.status === 401) {
        await clearAuthTokens();
        await clearSessionUser();
        router.replace(ROUTES.auth.login);
        return;
      }
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const role = user?.role || "member";
  const status = user?.status || "pending";
  const isAdmin = useMemo(() => isAdminUser(user), [user]);
  const approved = useMemo(() => isApprovedUser(user), [user]);
  const kycComplete = useMemo(() => isKycComplete(user), [user]);

  const loanAllowed = useMemo(() => canRequestLoan(user), [user]);
  const groupAllowed = useMemo(() => canJoinGroup(user), [user]);
  const merryAllowed = useMemo(() => canJoinMerry(user), [user]);
  const withdrawAllowed = useMemo(() => canWithdraw(user), [user]);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await clearAuthTokens();
          await clearSessionUser();
          router.replace(ROUTES.auth.login);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No profile found</Text>
        <Text style={styles.emptySub}>Please login again to continue.</Text>
        <View style={{ height: SPACING.md }} />
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace(ROUTES.auth.login)}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryBtnText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = user?.username || "User";
  const displayPhone = user?.phone || "—";
  const displayEmail = user?.email ?? "—";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={22} color={COLORS.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{displayName}</Text>
          <Text style={styles.sub}>
            {displayPhone} • {isAdmin ? "Admin" : "Member"} • {status}
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!kycComplete ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Complete KYC</Text>
          <Text style={styles.bannerText}>
            You can already use savings and merry features, but loan requests,
            group joining and withdrawals require completed KYC.
          </Text>

          <TouchableOpacity
            style={styles.bannerBtn}
            onPress={() => router.push(ROUTES.tabs.profileKyc)}
            activeOpacity={0.9}
          >
            <Text style={styles.bannerBtnText}>Submit KYC</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.banner, styles.bannerSuccess]}>
          <Text style={[styles.bannerTitle, styles.bannerSuccessTitle]}>
            KYC Complete
          </Text>
          <Text style={[styles.bannerText, styles.bannerSuccessText]}>
            Loan requests, group joining and withdrawals are available according
            to your account status.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>

        <Row label="Username" value={displayName} />
        <Row label="Phone" value={displayPhone} />
        <Row label="Email" value={String(displayEmail || "—")} />
        <Row label="Role" value={String(role)} />
        <Row label="Status" value={String(status)} />
        <Row label="Approved" value={approved ? "Yes" : "No"} />
        <Row label="KYC" value={kycComplete ? "Complete" : "Pending"} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Feature Access</Text>

        <Row label="Can join merry" value={merryAllowed ? "Yes" : "No"} />
        <Row label="Can request loan" value={loanAllowed ? "Yes" : "No"} />
        <Row label="Can join group" value={groupAllowed ? "Yes" : "No"} />
        <Row label="Can withdraw" value={withdrawAllowed ? "Yes" : "No"} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>

        <ActionRow
          icon="create-outline"
          text="Edit Profile"
          onPress={() => router.push(ROUTES.tabs.profileEdit)}
        />

        <ActionRow
          icon="shield-checkmark-outline"
          text={kycComplete ? "View KYC" : "Submit KYC"}
          onPress={() => router.push(ROUTES.tabs.profileKyc)}
        />

        <ActionRow
          icon="wallet-outline"
          text="Open Savings"
          onPress={() => router.push(ROUTES.tabs.savings)}
        />

        <ActionRow
          icon="repeat-outline"
          text="Open Merry-Go-Round"
          onPress={() => router.push(ROUTES.tabs.merry)}
        />

        <ActionRow
          icon="log-out-outline"
          text="Logout"
          danger
          onPress={handleLogout}
        />
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "—"}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  text,
  onPress,
  danger,
}: {
  icon: any;
  text: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.actionIcon, danger && { backgroundColor: "#FEE2E2" }]}>
        <Ionicons name={icon} size={18} color={danger ? "#B91C1C" : COLORS.primary} />
      </View>
      <Text style={[styles.actionText, danger && { color: "#B91C1C" }]}>{text}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
  },

  loadingText: {
    marginTop: 8,
    color: COLORS.gray,
  },

  emptyTitle: {
    fontSize: FONT.section,
    fontWeight: "900",
    color: COLORS.dark,
  },

  emptySub: {
    marginTop: 6,
    color: COLORS.gray,
    textAlign: "center",
  },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },

  primaryBtnText: {
    color: COLORS.white,
    fontWeight: "900",
  },

  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },

  title: {
    fontSize: FONT.section,
    fontWeight: "900",
    color: COLORS.dark,
  },

  sub: {
    marginTop: 2,
    color: COLORS.gray,
  },

  errorCard: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    lineHeight: 18,
  },

  banner: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: "#FFE08A",
    backgroundColor: "#FFF8E1",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: 8,
  },

  bannerSuccess: {
    borderColor: "#B7F0C4",
    backgroundColor: "#ECFDF3",
  },

  bannerTitle: {
    fontWeight: "900",
    color: "#7A5B00",
  },

  bannerText: {
    color: "#7A5B00",
    lineHeight: 18,
  },

  bannerSuccessTitle: {
    color: "#0F7A2A",
  },

  bannerSuccessText: {
    color: "#0F7A2A",
  },

  bannerBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#7A5B00",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },

  bannerBtnText: {
    color: "white",
    fontWeight: "900",
  },

  card: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  cardTitle: {
    fontSize: FONT.body,
    fontWeight: "900",
    color: COLORS.dark,
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },

  label: {
    color: COLORS.gray,
    fontWeight: "700",
  },

  value: {
    color: COLORS.dark,
    fontWeight: "800",
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },

  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },

  actionText: {
    flex: 1,
    color: COLORS.dark,
    fontWeight: "900",
  },
});