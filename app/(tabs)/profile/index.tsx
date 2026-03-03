// app/(tabs)/profile/index.tsx
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { clearAuthTokens, getErrorMessage } from "@/services/api";
import { getMe } from "@/services/profile";
import { clearSessionUser, getSessionUser, mergeSessionUser, SessionUser } from "@/services/session";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type MeLike = {
  username?: string;
  phone?: string;
  email?: string | null;
  role?: string;
  status?: string;
  is_admin?: boolean;
};

export default function ProfileHome() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeLike | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      // ✅ read current session first (fast UI)
      const s = await getSessionUser();
      setSession(s);

      // ✅ fetch real profile from backend
      const data = await getMe();
      setMe(data);

      // ✅ keep session in sync (MERGE so we don't wipe other fields)
      const next = await mergeSessionUser({
        username: data?.username,
        phone: data?.phone,
        email: data?.email ?? null,
        role: data?.role,
        status: data?.status,
        is_admin: !!(data?.is_admin || data?.role === "admin"),
      });
      setSession(next);
    } catch (e: any) {
      // If token invalid/expired -> force logout
      const msg = (getErrorMessage(e) || "").toLowerCase();
      if (msg.includes("token") || e?.response?.status === 401) {
        await clearAuthTokens();
        await clearSessionUser();
        router.replace("/(auth)/login");
        return;
      }
      Alert.alert("Profile Error", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const role = me?.role || session?.role || "member";
  const status = me?.status || session?.status || "pending";
  const isAdmin = useMemo(
    () => !!(me?.is_admin || role === "admin" || session?.is_admin),
    [me, role, session]
  );
  const isApproved = useMemo(() => status === "approved", [status]);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await clearAuthTokens();
          await clearSessionUser();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: COLORS.gray }}>Loading profile…</Text>
      </View>
    );
  }

  const displayName = me?.username || session?.username || "User";
  const displayPhone = me?.phone || session?.phone || "—";
  const displayEmail = me?.email ?? session?.email ?? "—";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* Header */}
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

      {/* KYC Banner */}
      {!isApproved ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>KYC Required</Text>
          <Text style={styles.bannerText}>
            You can save and view your dashboard, but loans, merry-go-round and withdrawals unlock after KYC approval.
          </Text>

          <TouchableOpacity
            style={styles.bannerBtn}
            onPress={() => router.push("/(tabs)/profile/kyc")}
            activeOpacity={0.9}
          >
            <Text style={styles.bannerBtnText}>Submit KYC</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.banner, { borderColor: "#B7F0C4", backgroundColor: "#ECFDF3" }]}>
          <Text style={[styles.bannerTitle, { color: "#0F7A2A" }]}>KYC Approved</Text>
          <Text style={[styles.bannerText, { color: "#0F7A2A" }]}>All features are unlocked.</Text>
        </View>
      )}

      {/* Account Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>

        <Row label="Username" value={displayName} />
        <Row label="Phone" value={displayPhone} />
        <Row label="Email" value={String(displayEmail || "—")} />
        <Row label="Role" value={String(role)} />
        <Row label="Status" value={String(status)} />
      </View>

      {/* Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>

        <ActionRow
          icon="create-outline"
          text="Edit Profile"
          onPress={() => router.push("/(tabs)/profile/edit")}
        />

        <ActionRow
          icon="shield-checkmark-outline"
          text="Submit KYC"
          onPress={() => router.push("/(tabs)/profile/kyc")}
        />

        <ActionRow icon="log-out-outline" text="Logout" danger onPress={handleLogout} />
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
  container: { flex: 1, backgroundColor: COLORS.white, padding: SPACING.md },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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
  title: { fontSize: FONT.section, fontWeight: "900", color: COLORS.dark },
  sub: { marginTop: 2, color: COLORS.gray },

  banner: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: "#FFE08A",
    backgroundColor: "#FFF8E1",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  bannerTitle: { fontWeight: "900", color: "#7A5B00" },
  bannerText: { color: "#7A5B00", lineHeight: 18 },
  bannerBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#7A5B00",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  bannerBtnText: { color: "white", fontWeight: "900" },

  card: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  cardTitle: { fontSize: FONT.body, fontWeight: "900", color: COLORS.dark, marginBottom: 10 },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  label: { color: COLORS.gray, fontWeight: "700" },
  value: { color: COLORS.dark, fontWeight: "800" },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
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
  actionText: { flex: 1, color: COLORS.dark, fontWeight: "900" },
});