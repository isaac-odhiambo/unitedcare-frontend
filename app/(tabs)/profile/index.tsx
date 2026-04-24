// app/(tabs)/profile/index.tsx

import { ROUTES } from "@/constants/routes";
import { SPACING } from "@/constants/theme";
import { clearAuthTokens, getErrorMessage } from "@/services/api";
import {
  canJoinGroup,
  canJoinMerry,
  canRequestLoan,
  canWithdraw,
  getMe,
  isAdminUser,
  isApprovedUser,
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
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ProfileUser = Partial<MeResponse> & Partial<SessionUser>;

function isActiveMember(user: ProfileUser | null): boolean {
  if (!user) return false;

  const role = String(user?.role || "")
    .trim()
    .toLowerCase();

  const status = String(user?.status || "")
    .trim()
    .toLowerCase();

  return role === "member" && status === "active";
}

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
          id_number: (meUser as any)?.id_number ?? null,
          role: meUser?.role,
          status: meUser?.status,
          is_admin: !!(meUser?.is_admin || meUser?.role === "admin"),
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
  const activeMember = useMemo(() => isActiveMember(user), [user]);

  const loanAllowed = useMemo(() => {
    if (activeMember) return true;
    return canRequestLoan(user);
  }, [activeMember, user]);

  const groupAllowed = useMemo(() => {
    if (activeMember) return true;
    return canJoinGroup(user);
  }, [activeMember, user]);

  const merryAllowed = useMemo(() => {
    return canJoinMerry(user);
  }, [user]);

  const withdrawAllowed = useMemo(() => {
    if (activeMember) return true;
    return canWithdraw(user);
  }, [activeMember, user]);

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

  const displayName = user?.username || " ";
  const displayPhone = user?.phone || " ";
  const displayEmail = user?.email ?? " ";
  const displayIdNumber = (user as any)?.id_number ?? "—";

  if (!loading && !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No profile found</Text>
        <Text style={styles.emptySub}>Please login again to continue.</Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace(ROUTES.auth.login)}
        >
          <Text style={styles.primaryBtnText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={22} color="#0A6E8A" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{loading ? " " : displayName}</Text>
            <Text style={styles.sub}>
              {loading
                ? " "
                : `${displayPhone} • ${isAdmin ? "Admin" : "Member"} • ${status}`}
            </Text>

            {!loading ? (
              <View style={styles.idBadge}>
                <Ionicons
                  name="card-outline"
                  size={14}
                  color="#DFFBFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.idBadgeText}>
                  ID: {String(displayIdNumber)}
                </Text>
              </View>
            ) : (
              <View style={styles.idBadgePlaceholder} />
            )}
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <StatPill label="Role" value={loading ? " " : String(role)} />
          <StatPill label="Status" value={loading ? " " : String(status)} />
        </View>
      </View>

      {!loading && user ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Access</Text>

          <Row label="Can request support" value={loanAllowed ? "Yes" : "No"} />
          <Row label="Can join group" value={groupAllowed ? "Yes" : "No"} />
          <Row label="Can join merry-go-round" value={merryAllowed ? "Yes" : "No"} />
          <Row label="Can withdraw" value={withdrawAllowed ? "Yes" : "No"} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Access</Text>
          <Row label="Can request support" value=" " />
          <Row label="Can join group" value=" " />
          <Row label="Can join merry-go-round" value=" " />
          <Row label="Can withdraw" value=" " />
        </View>
      )}

      {!loading && error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>

        <Row label="Username" value={loading ? " " : displayName} />
        <Row label="Phone" value={loading ? " " : displayPhone} />
        <Row label="ID Number" value={loading ? " " : String(displayIdNumber)} />
        <Row label="Email" value={loading ? " " : String(displayEmail)} />
        <Row label="Role" value={loading ? " " : String(role)} />
        <Row label="Status" value={loading ? " " : String(status)} />
        <Row label="Approved" value={loading ? " " : approved ? "Yes" : "No"} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>

        {!loading && (
          <>
            <ActionRow
              icon="create-outline"
              text="Edit profile"
              onPress={() => router.push(ROUTES.tabs.profileEdit)}
            />

            <ActionRow
              icon="log-out-outline"
              text="Logout"
              danger
              onPress={handleLogout}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

function StatPill({ label, value }: any) {
  return (
    <View style={styles.heroStatPill}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

function Row({ label, value }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ActionRow({ icon, text, onPress, danger }: any) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <Ionicons name={icon} size={18} color={danger ? "#FF6B6B" : "#0A6E8A"} />
      <Text style={styles.actionText}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#062C49",
  },

  contentContainer: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl ?? 24,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#062C49",
    padding: SPACING.md,
  },

  heroCard: {
    backgroundColor: "rgba(49,180,217,0.22)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },

  header: {
    flexDirection: "row",
    gap: 10,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#EFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },

  sub: {
    color: "#CCC",
    marginTop: 2,
  },

  idBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  idBadgeText: {
    color: "#DFFBFF",
    fontWeight: "700",
    fontSize: 12,
  },

  idBadgePlaceholder: {
    marginTop: 10,
    width: 110,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroStatsRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },

  heroStatPill: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 8,
    borderRadius: 10,
  },

  heroStatLabel: {
    color: "#CCC",
    fontSize: 10,
  },

  heroStatValue: {
    color: "#FFF",
    fontWeight: "bold",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 12,
    borderRadius: 16,
    marginTop: 10,
  },

  cardTitle: {
    color: "#FFF",
    fontWeight: "bold",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 12,
  },

  label: {
    color: "#AAA",
    flex: 1,
  },

  value: {
    color: "#FFF",
    fontWeight: "bold",
    flex: 1,
    textAlign: "right",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    alignItems: "center",
  },

  actionText: {
    color: "#FFF",
    fontWeight: "bold",
  },

  errorCard: {
    backgroundColor: "rgba(255,0,0,0.2)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },

  errorText: {
    color: "#FFF",
    flex: 1,
  },

  emptyTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },

  emptySub: {
    color: "#AAA",
    textAlign: "center",
  },

  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#FFF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },

  primaryBtnText: {
    color: "#0C6A80",
    fontWeight: "bold",
  },
});