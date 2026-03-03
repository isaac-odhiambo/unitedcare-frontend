// app/(tabs)/profile/edit.tsx
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getMe, updateMe } from "@/services/profile";
import { mergeSessionUser } from "@/services/session";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
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
      const res = await updateMe({ username: username.trim(), email: email.trim() || null });

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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: COLORS.gray }}>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.white }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Edit Profile</Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Your username"
          style={styles.input}
          editable={!saving}
        />

        <Text style={styles.label}>Email (optional)</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
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
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.md, gap: 10 },
  title: { fontSize: FONT.section, fontWeight: "900", color: COLORS.dark, marginBottom: 10 },
  label: { fontWeight: "800", color: COLORS.gray, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    color: COLORS.dark,
  },
  btn: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  btnText: { color: COLORS.white, fontWeight: "900" },
});