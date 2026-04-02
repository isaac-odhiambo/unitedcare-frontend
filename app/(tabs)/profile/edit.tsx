// app/(tabs)/profile/edit.tsx
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getMe, updateMe } from "@/services/profile";
import { mergeSessionUser } from "@/services/session";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const me = await getMe();
      setUsername(me?.username || "");
      setEmail(me?.email || "");
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
      router.back();
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert("Missing username", "Username is required.");
      return;
    }

    try {
      setSaving(true);
      const res = await updateMe({
        username: username.trim(),
        email: email.trim() || null,
      });

      await mergeSessionUser({
        username: res.username,
        email: res.email ?? null,
      });

      Alert.alert("Saved", "Profile updated successfully.");
      router.back();
    } catch (e: any) {
      Alert.alert("Update failed", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#8CF0C7" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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

          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.heroTag}>PROFILE UPDATE</Text>
              <Text style={styles.title}>Edit profile</Text>
              <Text style={styles.subtitle}>
                Update your name and contact details to keep your community
                profile current.
              </Text>
            </View>

            <View style={styles.heroIconWrap}>
              <Ionicons name="create-outline" size={22} color={COLORS.white} />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardGlowPrimary} />
          <View style={styles.cardGlowAccent} />

          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Your username"
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.input}
            editable={!saving}
          />

          <Text style={styles.label}>Email (optional)</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!saving}
          />

          <TouchableOpacity
            style={[styles.btn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator color="#0C6A80" />
            ) : (
              <Text style={styles.btnText}>Save changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            disabled={saving}
            activeOpacity={0.9}
          >
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  page: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  content: {
    padding: SPACING.md,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C6A80",
    padding: SPACING.lg,
  },

  loadingText: {
    marginTop: 8,
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.regular,
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

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#DFFFE8",
    fontSize: 11,
    fontFamily: FONT.bold,
    marginBottom: 12,
  },

  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  title: {
    fontSize: FONT.section,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  subtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  card: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.10)",
    ...SHADOW.card,
  },

  cardGlowPrimary: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  cardGlowAccent: {
    position: "absolute",
    bottom: -25,
    left: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(236,251,255,0.06)",
  },

  label: {
    fontWeight: "800",
    color: "rgba(255,255,255,0.82)",
    marginTop: 6,
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    color: "#FFFFFF",
    marginBottom: 8,
  },

  btn: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },

  btnText: {
    color: "#0C6A80",
    fontWeight: "900",
  },

  secondaryBtn: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  secondaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});