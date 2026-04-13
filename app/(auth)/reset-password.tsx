import { FONT } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { forgotPassword, resetPassword } from "@/services/auth";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

function normalizeCode(input: string) {
  return (input || "").replace(/\D/g, "").slice(0, 6);
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
  inputBg: "rgba(4, 22, 38, 0.94)",
  inputBorder: "rgba(140,240,199,0.18)",
  inputText: "#FFFFFF",
  eyeBg: "rgba(255,255,255,0.08)",
  subtleButton: "rgba(255,255,255,0.08)",
  subtleButtonBorder: "rgba(255,255,255,0.14)",
};

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();

  const email = useMemo(
    () => normalizeEmail(String(params.email || "")),
    [params.email]
  );

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);

  const handleResendCode = async () => {
    if (!email) {
      Alert.alert("Missing email", "We could not find your email address.");
      return;
    }

    try {
      setResendingCode(true);

      const res = await forgotPassword({ email });

      Alert.alert(
        "Code Sent",
        res?.detail || "A new reset code has been sent to your email."
      );
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
    } finally {
      setResendingCode(false);
    }
  };

  const handleReset = async () => {
    const cleanCode = normalizeCode(code);
    const cleanPassword = newPassword.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    if (!email) {
      Alert.alert("Missing email", "Email is required.");
      return;
    }

    if (!cleanCode) {
      Alert.alert("Missing code", "Enter the reset code sent to your email.");
      return;
    }

    if (!/^\d{6}$/.test(cleanCode)) {
      Alert.alert("Invalid code", "Code must be exactly 6 digits.");
      return;
    }

    if (!cleanPassword) {
      Alert.alert("Missing password", "Enter a new password.");
      return;
    }

    if (cleanPassword.length < 6) {
      Alert.alert(
        "Weak password",
        "Password must be at least 6 characters."
      );
      return;
    }

    if (!cleanConfirmPassword) {
      Alert.alert("Missing confirmation", "Confirm your new password.");
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const res = await resetPassword({
        email,
        code: cleanCode,
        new_password: cleanPassword,
      });

      Alert.alert(
        "Success",
        res?.detail || "Password reset successful. Please log in."
      );

      router.replace("/(auth)/login");
    } catch (e: any) {
      const data = e?.response?.data;

      const msg =
        data?.detail ||
        data?.non_field_errors?.[0] ||
        data?.code?.[0] ||
        data?.new_password?.[0] ||
        getErrorMessage(e) ||
        "Password reset failed.";

      const normalizedMsg = String(msg).toLowerCase();

      if (
        normalizedMsg.includes("expired") ||
        normalizedMsg.includes("invalid code") ||
        normalizedMsg.includes("invalid or expired")
      ) {
        Alert.alert(
          "Code expired",
          "Your reset code is no longer valid. You can request a new one below."
        );
      } else {
        Alert.alert("Error", String(msg));
      }
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
                <Text style={styles.brandName}>Create new password</Text>
                <Text style={styles.brandTagline}>
                  Enter the code sent to your email and set a new password to
                  continue securely.
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>
                    {email || "No email provided"}
                  </Text>
                </View>

                <Text style={styles.label}>Reset code</Text>
                <TextInput
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={UI.textMuted}
                  value={code}
                  onChangeText={(text) => setCode(normalizeCode(text))}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading && !resendingCode}
                  style={styles.input}
                  returnKeyType="next"
                  selectionColor={UI.primary}
                />

                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={loading || resendingCode}
                  activeOpacity={0.9}
                  style={[
                    styles.resendButton,
                    (loading || resendingCode) && styles.buttonDisabled,
                  ]}
                >
                  {resendingCode ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color={UI.primary} />
                      <Text style={styles.resendButtonText}>Sending new code...</Text>
                    </View>
                  ) : (
                    <Text style={styles.resendButtonText}>Resend Code</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.label}>New password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    placeholder="Enter new password"
                    placeholderTextColor={UI.textMuted}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading && !resendingCode}
                    style={styles.passwordInput}
                    returnKeyType="next"
                    selectionColor={UI.primary}
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={loading || resendingCode}
                    onPress={() => setShowNewPassword((prev) => !prev)}
                    style={styles.eyeButton}
                  >
                    <Text style={styles.eyeText}>
                      {showNewPassword ? "Hide" : "Show"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirm password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    placeholder="Confirm new password"
                    placeholderTextColor={UI.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading && !resendingCode}
                    style={styles.passwordInput}
                    returnKeyType="done"
                    onSubmitEditing={handleReset}
                    selectionColor={UI.primary}
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={loading || resendingCode}
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                    style={styles.eyeButton}
                  >
                    <Text style={styles.eyeText}>
                      {showConfirmPassword ? "Hide" : "Show"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleReset}
                  disabled={loading || resendingCode}
                  activeOpacity={0.9}
                  style={[styles.button, (loading || resendingCode) && styles.buttonDisabled]}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color={UI.primaryDeep} />
                      <Text style={styles.buttonText}>Resetting...</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.replace("/(auth)/login")}
                  disabled={loading || resendingCode}
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
    paddingTop: 24,
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
    marginTop: 10,
    marginBottom: 24,
  },

  brandName: {
    fontSize: 32,
    lineHeight: 38,
    color: UI.text,
    fontFamily: FONT.bold,
    marginBottom: 8,
    textAlign: "center",
  },

  brandTagline: {
    fontSize: 15,
    lineHeight: 23,
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

  infoBlock: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: UI.borderStrong,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
  },

  infoLabel: {
    fontSize: 12,
    color: UI.textMuted,
    fontFamily: FONT.medium,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  infoValue: {
    fontSize: 15,
    color: UI.text,
    fontFamily: FONT.bold,
  },

  label: {
    fontSize: 16,
    color: UI.text,
    fontFamily: FONT.bold,
    marginBottom: 10,
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
    marginBottom: 14,
  },

  resendButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: UI.subtleButton,
    borderWidth: 1,
    borderColor: UI.subtleButtonBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 18,
  },

  resendButtonText: {
    color: UI.primary,
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  passwordWrap: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: UI.inputBorder,
    backgroundColor: UI.inputBg,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
  },

  passwordInput: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 16,
    color: UI.inputText,
    fontSize: 17,
    fontFamily: FONT.medium,
  },

  eyeButton: {
    height: 58,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.eyeBg,
    borderLeftWidth: 1,
    borderLeftColor: UI.inputBorder,
  },

  eyeText: {
    color: UI.primary,
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  button: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4,
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