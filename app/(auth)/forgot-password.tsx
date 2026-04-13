import { FONT } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { forgotPassword } from "@/services/auth";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function normalizeEmail(input: string) {
  return String(input || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const UI = {
  page: "#062C49",
  card: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.12)",
  borderStrong: "rgba(255,255,255,0.18)",
  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.88)",
  textMuted: "rgba(255,255,255,0.62)",
  primary: "#8CF0C7",
  primaryDeep: "#197D71",
  inputBg: "rgba(4, 22, 38, 0.92)",
  inputBorder: "rgba(140,240,199,0.18)",
  inputText: "#FFFFFF",
};

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      Alert.alert("Missing email", "Enter your email address.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      const res = await forgotPassword({ email: cleanEmail });

      Alert.alert(
        "Code Sent",
        res?.detail || "Password reset code sent to your email."
      );

      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: cleanEmail },
      });
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.bgOrbTop} />
            <View style={styles.bgOrbBottom} />
            <View style={styles.bgGlowOne} />
            <View style={styles.bgGlowTwo} />

            <View style={styles.container}>
              <View style={styles.brandWrap}>
                <View style={styles.logoFrame}>
                  <Image
                    source={require("@/assets/images/transparenticon.png")}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>

                <Text style={styles.brandName}>United Care</Text>
                <Text style={styles.brandTagline}>
                  Enter your email to receive a reset code and continue
                  securely.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>Email address</Text>

                <TextInput
                  placeholder="Enter your email address"
                  placeholderTextColor={UI.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  style={styles.input}
                  returnKeyType="send"
                  onSubmitEditing={handleRequestCode}
                  selectionColor={UI.primary}
                />

                <TouchableOpacity
                  onPress={handleRequestCode}
                  disabled={loading}
                  activeOpacity={0.9}
                  style={[styles.button, loading && styles.buttonDisabled]}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color={UI.primaryDeep} />
                      <Text style={styles.buttonText}>Sending...</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Send Reset Code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.replace("/(auth)/login")}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.link}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.page,
  },

  screen: {
    flex: 1,
    backgroundColor: UI.page,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },

  container: {
    flex: 1,
    justifyContent: "flex-start",
    minHeight: "100%",
  },

  bgOrbTop: {
    position: "absolute",
    top: -90,
    right: -50,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  bgOrbBottom: {
    position: "absolute",
    bottom: -80,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  bgGlowOne: {
    position: "absolute",
    top: 140,
    right: 20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  bgGlowTwo: {
    position: "absolute",
    bottom: 140,
    left: 18,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  brandWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 24,
  },

  logoFrame: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 6,
  },

  logo: {
    width: 220,
    height: 220,
  },

  brandName: {
    fontSize: 36,
    lineHeight: 42,
    color: UI.text,
    fontFamily: FONT.bold,
    marginBottom: 8,
    textAlign: "center",
  },

  brandTagline: {
    fontSize: 16,
    lineHeight: 24,
    color: UI.textSoft,
    textAlign: "center",
    fontFamily: FONT.medium,
    maxWidth: 330,
  },

  card: {
    backgroundColor: UI.card,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 24,
    padding: 20,
    marginTop: 8,
  },

  label: {
    fontSize: 16,
    color: UI.text,
    fontFamily: FONT.bold,
    marginBottom: 12,
  },

  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: UI.inputBorder,
    backgroundColor: UI.inputBg,
    paddingHorizontal: 16,
    borderRadius: 16,
    color: UI.inputText,
    fontSize: 17,
    fontFamily: FONT.medium,
    marginBottom: 16,
  },

  button: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  buttonDisabled: {
    opacity: 0.72,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  buttonText: {
    color: UI.primaryDeep,
    fontSize: 16,
    fontFamily: FONT.bold,
  },

  secondaryAction: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  link: {
    textAlign: "center",
    color: UI.textSoft,
    fontSize: 15,
    fontFamily: FONT.bold,
  },
});