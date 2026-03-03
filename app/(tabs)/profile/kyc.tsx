// app/(tabs)/profile/kyc.tsx
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getMe, submitKyc } from "@/services/profile";
import { mergeSessionUser } from "@/services/session";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

type Picked = { uri: string; name?: string; type?: string } | null;

async function pickImage(): Promise<Picked> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permission needed", "Please allow photo permissions.");
    return null;
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });

  if (res.canceled) return null;

  const asset = res.assets[0];
  const uri = asset.uri;

  // Basic best-guess type
  const type = uri.endsWith(".png") ? "image/png" : "image/jpeg";
  const name = uri.split("/").pop() || "image.jpg";

  return { uri, name, type };
}

export default function KycScreen() {
  const [passport, setPassport] = useState<Picked>(null);
  const [idFront, setIdFront] = useState<Picked>(null);
  const [idBack, setIdBack] = useState<Picked>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!passport && !!idFront && !!idBack;

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert("Missing documents", "Please select all 3 images (passport, ID front, ID back).");
      return;
    }

    try {
      setSubmitting(true);

      await submitKyc({
        passport_photo: passport!,
        id_front: idFront!,
        id_back: idBack!,
      });

      // ✅ refresh profile + session so dashboard unlock logic updates when approved
      const me = await getMe();
      await mergeSessionUser({
        username: me.username,
        phone: me.phone,
        email: me.email ?? null,
        role: me.role,
        status: me.status,
        is_admin: !!(me.is_admin || me.role === "admin"),
      });

      Alert.alert("Submitted", "KYC submitted successfully. Wait for approval.");
      router.replace("/(tabs)/profile");
    } catch (e: any) {
      Alert.alert("KYC failed", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>Submit KYC</Text>
      <Text style={styles.sub}>
        Upload your passport photo and both sides of your ID. After approval, loans and merry-go-round unlock.
      </Text>

      <DocPicker
        label="Passport Photo"
        value={passport}
        onPick={async () => setPassport(await pickImage())}
        onClear={() => setPassport(null)}
      />
      <DocPicker
        label="ID Front"
        value={idFront}
        onPick={async () => setIdFront(await pickImage())}
        onClear={() => setIdFront(null)}
      />
      <DocPicker
        label="ID Back"
        value={idBack}
        onPick={async () => setIdBack(await pickImage())}
        onClear={() => setIdBack(null)}
      />

      <TouchableOpacity
        style={[styles.btn, (!canSubmit || submitting) && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={!canSubmit || submitting}
        activeOpacity={0.9}
      >
        {submitting ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ActivityIndicator color={COLORS.white} />
            <Text style={styles.btnText}>Submitting…</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>Submit KYC</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.9}>
        <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function DocPicker({
  label,
  value,
  onPick,
  onClear,
}: {
  label: string;
  value: Picked;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{label}</Text>

      {value?.uri ? (
        <View style={{ gap: 10 }}>
          <Image source={{ uri: value.uri }} style={styles.preview} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={styles.smallBtn} onPress={onPick} activeOpacity={0.9}>
              <Text style={styles.smallBtnText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: "#FEE2E2" }]}
              onPress={onClear}
              activeOpacity={0.9}
            >
              <Text style={[styles.smallBtnText, { color: "#B91C1C" }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.pickBtn} onPress={onPick} activeOpacity={0.9}>
          <Ionicons name="cloud-upload-outline" size={18} color={COLORS.primary} />
          <Text style={styles.pickBtnText}>Select Image</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white, padding: SPACING.md },
  title: { fontSize: FONT.section, fontWeight: "900", color: COLORS.dark },
  sub: { marginTop: 6, marginBottom: 14, color: COLORS.gray, lineHeight: 18 },

  card: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: 10,
  },
  cardTitle: { fontWeight: "900", color: COLORS.dark },

  pickBtn: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: "#EEF2FF",
    alignSelf: "flex-start",
  },
  pickBtnText: { fontWeight: "900", color: COLORS.primary },

  preview: { width: "100%", height: 180, borderRadius: 12, backgroundColor: "#F3F4F6" },

  smallBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  smallBtnText: { fontWeight: "900", color: COLORS.primary },

  btn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: 6,
  },
  btnText: { color: COLORS.white, fontWeight: "900" },

  backBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  backText: { color: COLORS.primary, fontWeight: "900" },
});