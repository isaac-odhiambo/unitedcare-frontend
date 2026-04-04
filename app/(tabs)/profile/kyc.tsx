// app/(tabs)/profile/kyc.tsx
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getMe, submitKyc } from "@/services/profile";
import { mergeSessionUser } from "@/services/session";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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
import { SafeAreaView } from "react-native-safe-area-context";

type Picked =
  | {
      uri: string;
      name?: string;
      type?: string;
    }
  | null;

function normalizePickedAsset(asset: ImagePicker.ImagePickerAsset): Picked {
  const uri = asset.uri;
  const name =
    asset.fileName || uri.split("/").pop() || `image_${Date.now()}.jpg`;
  const type =
    asset.mimeType ||
    (uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

  return {
    uri,
    name,
    type,
  };
}

async function pickFromGallery(): Promise<Picked> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log("MEDIA LIB PERMISSION:", perm);

    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library permission.");
      return null;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    console.log("GALLERY RESULT:", JSON.stringify(res));

    if (res.canceled || !res.assets?.length) return null;
    return normalizePickedAsset(res.assets[0]);
  } catch (e) {
    console.log("GALLERY PICK ERROR:", e);
    Alert.alert("Picker error", "Failed to open gallery.");
    return null;
  }
}

async function pickFromCamera(): Promise<Picked> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    console.log("CAMERA PERMISSION:", perm);

    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow camera permission.");
      return null;
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });

    console.log("CAMERA RESULT:", JSON.stringify(res));

    if (res.canceled || !res.assets?.length) return null;
    return normalizePickedAsset(res.assets[0]);
  } catch (e) {
    console.log("CAMERA PICK ERROR:", e);
    Alert.alert("Camera error", "Failed to open camera.");
    return null;
  }
}

export default function KycScreen() {
  const [passport, setPassport] = useState<Picked>(null);
  const [idFront, setIdFront] = useState<Picked>(null);
  const [idBack, setIdBack] = useState<Picked>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!passport && !!idFront && !!idBack;

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert(
        "Missing documents",
        "Please select all 3 images: passport photo, ID front and ID back."
      );
      return;
    }

    try {
      setSubmitting(true);

      console.log("🪪 PASSPORT:", passport);
      console.log("🆔 FRONT:", idFront);
      console.log("🆔 BACK:", idBack);

      await submitKyc({
        passport_photo: passport!,
        id_front: idFront!,
        id_back: idBack!,
      });

      const me = await getMe();

      await mergeSessionUser({
        username: me.username,
        phone: me.phone,
        email: me.email ?? null,
        role: me.role,
        status: me.status,
        is_admin: !!(me.is_admin || me.role === "admin"),
        kyc_completed: !!me.kyc_completed,
        kyc_status: me.kyc_status ?? null,
      });

      Alert.alert(
        "Submitted",
        "Your KYC has been submitted successfully. Please wait for approval."
      );
      router.replace("/(tabs)/profile");
    } catch (e: any) {
      console.log("KYC SUBMIT ERROR STATUS:", e?.response?.status);
      console.log("KYC SUBMIT ERROR DATA:", e?.response?.data);
      console.log("KYC SUBMIT ERROR FULL:", e);
      Alert.alert("KYC failed", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
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
              <Text style={styles.heroTag}>PROFILE VERIFICATION</Text>
              <Text style={styles.title}>Submit KYC</Text>
              <Text style={styles.subtitle}>
                Add your passport photo and national ID images so your community
                profile can be reviewed for support, group joining and
                withdrawals.
              </Text>
            </View>

            <View style={styles.heroIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color={COLORS.white}
              />
            </View>
          </View>
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color="#0C6A80"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>Before you upload</Text>
            <Text style={styles.tipText}>
              Use clear images. Make sure names and ID details are readable, and
              avoid dark or cropped photos.
            </Text>
          </View>
        </View>

        <DocPicker
          label="Passport Photo"
          description="A clear portrait photo for identity review."
          value={passport}
          onPickCamera={async () => setPassport(await pickFromCamera())}
          onPickGallery={async () => setPassport(await pickFromGallery())}
          onClear={() => setPassport(null)}
          icon="person-outline"
        />

        <DocPicker
          label="ID Front"
          description="Front side of your national ID."
          value={idFront}
          onPickCamera={async () => setIdFront(await pickFromCamera())}
          onPickGallery={async () => setIdFront(await pickFromGallery())}
          onClear={() => setIdFront(null)}
          icon="card-outline"
        />

        <DocPicker
          label="ID Back"
          description="Back side of your national ID."
          value={idBack}
          onPickCamera={async () => setIdBack(await pickFromCamera())}
          onPickGallery={async () => setIdBack(await pickFromGallery())}
          onClear={() => setIdBack(null)}
          icon="document-text-outline"
        />

        <TouchableOpacity
          style={[styles.btn, (!canSubmit || submitting) && { opacity: 0.65 }]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <View style={styles.btnRow}>
              <ActivityIndicator color="#0C6A80" />
              <Text style={styles.btnText}>Submitting…</Text>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="cloud-upload-outline" size={18} color="#0C6A80" />
              <Text style={styles.btnText}>Submit KYC</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.secondaryBtn}
          activeOpacity={0.9}
          disabled={submitting}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.white} />
          <Text style={styles.secondaryBtnText}>Back to profile</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DocPicker({
  label,
  description,
  value,
  onPickCamera,
  onPickGallery,
  onClear,
  icon,
}: {
  label: string;
  description: string;
  value: Picked;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onClear: () => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardGlowPrimary} />
      <View style={styles.cardGlowAccent} />

      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Ionicons name={icon} size={18} color="#0C6A80" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{label}</Text>
          <Text style={styles.cardSub}>{description}</Text>
        </View>
      </View>

      {value?.uri ? (
        <View style={{ gap: 12 }}>
          <Image source={{ uri: value.uri }} style={styles.preview} />

          <View style={styles.rowWrap}>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={onPickCamera}
              activeOpacity={0.9}
            >
              <Text style={styles.smallBtnText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smallBtn}
              onPress={onPickGallery}
              activeOpacity={0.9}
            >
              <Text style={styles.smallBtnText}>Choose Other</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallBtn, styles.removeBtn]}
              onPress={onClear}
              activeOpacity={0.9}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.rowWrap}>
          <TouchableOpacity
            style={styles.pickBtn}
            onPress={onPickCamera}
            activeOpacity={0.9}
          >
            <Ionicons name="camera-outline" size={18} color="#0C6A80" />
            <Text style={styles.pickBtnText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pickBtn}
            onPress={onPickGallery}
            activeOpacity={0.9}
          >
            <Ionicons name="images-outline" size={18} color="#0C6A80" />
            <Text style={styles.pickBtnText}>Choose Image</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "#E8FCFF",
    fontSize: 11,
    fontFamily: FONT.medium,
    letterSpacing: 0.8,
  },

  title: {
    fontSize: 26,
    lineHeight: 30,
    color: COLORS.white,
    fontFamily: FONT.bold,
  },

  subtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONT.regular,
  },

  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.08)",
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  tipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(12,106,128,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  tipTitle: {
    color: "#0C6A80",
    fontFamily: FONT.bold,
    fontSize: 14,
    marginBottom: 4,
  },

  tipText: {
    color: "#5B6B73",
    fontFamily: FONT.regular,
    lineHeight: 20,
    fontSize: 13,
  },

  card: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  cardGlowPrimary: {
    position: "absolute",
    top: -22,
    right: -18,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  cardGlowAccent: {
    position: "absolute",
    bottom: -22,
    left: -18,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },

  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 16,
  },

  cardSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.76)",
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },

  preview: {
    width: "100%",
    height: 190,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.08)",
  },

  pickBtnText: {
    color: "#0C6A80",
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  smallBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.08)",
  },

  smallBtnText: {
    color: "#0C6A80",
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  removeBtn: {
    backgroundColor: "rgba(255,235,238,0.95)",
    borderColor: "rgba(185,28,28,0.08)",
  },

  removeBtnText: {
    color: "#B91C1C",
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  btn: {
    marginTop: 6,
    backgroundColor: "#8CF0C7",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.card,
  },

  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  btnText: {
    color: "#0C6A80",
    fontFamily: FONT.bold,
    fontSize: 15,
  },

  secondaryBtn: {
    marginTop: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  secondaryBtnText: {
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
});