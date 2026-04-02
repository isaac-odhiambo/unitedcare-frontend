// app/(tabs)/profile/index.tsx
import { ROUTES } from "@/constants/routes";
import { FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
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
        <ActivityIndicator color="#8CF0C7" />
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobMiddle} />
      <View style={styles.backgroundBlobBottom} />
      <View style={styles.backgroundGlowOne} />
      <View style={styles.backgroundGlowTwo} />

      <View style={styles.heroCard}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <View style={styles.heroGlowThree} />

        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={22} color="#0A6E8A" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{displayName}</Text>
            <Text style={styles.sub}>
              {displayPhone} • {isAdmin ? "Admin" : "Member"} • {status}
            </Text>
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <StatPill label="Role" value={String(role)} />
          <StatPill label="Status" value={String(status)} />
          <StatPill label="KYC" value={kycComplete ? "Complete" : "Pending"} />
        </View>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!kycComplete ? (
        <View style={styles.banner}>
          <View style={styles.bannerTop}>
            <View style={styles.bannerIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color="#0C6A80"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Complete profile</Text>
              <Text style={styles.bannerText}>
                You can already use savings and merry features, but support
                requests, group joining and withdrawals require completed KYC.
              </Text>
            </View>
          </View>

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
          <View style={styles.bannerTop}>
            <View style={styles.bannerIconWrapSuccess}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#0C6A80"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, styles.bannerSuccessTitle]}>
                Profile complete
              </Text>
              <Text style={[styles.bannerText, styles.bannerSuccessText]}>
                Support requests, group joining and withdrawals are available
                according to your account status.
              </Text>
            </View>
          </View>
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
        <Text style={styles.cardTitle}>Feature access</Text>

        <Row label="Can join merry" value={merryAllowed ? "Yes" : "No"} />
        <Row label="Can request support" value={loanAllowed ? "Yes" : "No"} />
        <Row label="Can join group" value={groupAllowed ? "Yes" : "No"} />
        <Row label="Can withdraw" value={withdrawAllowed ? "Yes" : "No"} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>

        <ActionRow
          icon="create-outline"
          text="Edit profile"
          onPress={() => router.push(ROUTES.tabs.profileEdit)}
        />

        <ActionRow
          icon="shield-checkmark-outline"
          text={kycComplete ? "View KYC" : "Submit KYC"}
          onPress={() => router.push(ROUTES.tabs.profileKyc)}
        />

        <ActionRow
          icon="wallet-outline"
          text="Open savings"
          onPress={() => router.push(ROUTES.tabs.savings)}
        />

        <ActionRow
          icon="repeat-outline"
          text="Open merry-go-round"
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

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStatPill}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
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
    <TouchableOpacity
      style={styles.actionRow}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View
        style={[
          styles.actionIcon,
          danger && { backgroundColor: "rgba(220,53,69,0.18)" },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={danger ? "#FFFFFF" : "#0A6E8A"}
        />
      </View>
      <Text style={[styles.actionText, danger && { color: "#FFFFFF" }]}>
        {text}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={18}
        color="rgba(255,255,255,0.72)"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C6A80",
    padding: SPACING.md,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    backgroundColor: "#0C6A80",
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
    top: 240,
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

  loadingText: {
    marginTop: 8,
    color: "rgba(255,255,255,0.78)",
  },

  emptyTitle: {
    fontSize: FONT.section,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  emptySub: {
    marginTop: 6,
    color: "rgba(255,255,255,0.78)",
    textAlign: "center",
  },

  primaryBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },

  primaryBtnText: {
    color: "#0C6A80",
    fontWeight: "900",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  heroGlowOne: {
    position: "absolute",
    right: -28,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.09)",
  },

  heroGlowTwo: {
    position: "absolute",
    left: -20,
    bottom: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  heroGlowThree: {
    position: "absolute",
    right: 30,
    bottom: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(236,251,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: FONT.section,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  sub: {
    marginTop: 2,
    color: "rgba(255,255,255,0.78)",
  },

  heroStatsRow: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginTop: SPACING.lg,
  },

  heroStatPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },

  heroStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    fontFamily: FONT.regular,
  },

  heroStatValue: {
    marginTop: 4,
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  errorCard: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(220,53,69,0.18)",
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    lineHeight: 18,
  },

  banner: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.10)",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: 8,
  },

  bannerSuccess: {
    backgroundColor: "rgba(140,240,199,0.12)",
  },

  bannerTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },

  bannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(236,251,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  bannerIconWrapSuccess: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(236,251,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  bannerTitle: {
    fontWeight: "900",
    color: "#FFFFFF",
  },

  bannerText: {
    color: "rgba(255,255,255,0.84)",
    lineHeight: 18,
    marginTop: 4,
  },

  bannerSuccessTitle: {
    color: "#FFFFFF",
  },

  bannerSuccessText: {
    color: "rgba(255,255,255,0.84)",
  },

  bannerBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },

  bannerBtnText: {
    color: "#0C6A80",
    fontWeight: "900",
  },

  card: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.10)",
    ...SHADOW.card,
  },

  cardTitle: {
    fontSize: FONT.body,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: 10,
  },

  label: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "700",
    flex: 1,
  },

  value: {
    color: "#FFFFFF",
    fontWeight: "800",
    flex: 1,
    textAlign: "right",
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
    backgroundColor: "rgba(236,251,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  actionText: {
    flex: 1,
    color: "#FFFFFF",
    fontWeight: "900",
  },
});