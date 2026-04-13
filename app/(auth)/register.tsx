// app/(auth)/register.tsx

import { FONT, RADIUS, SHADOW } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { registerUser } from "@/services/auth";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type FieldErrors = {
  username?: string;
  phone?: string;
  email?: string;
  id_number?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
};

function normalizePhone(input: string) {
  return String(input || "").replace(/\s+/g, "").trim();
}

function normalizeName(input: string) {
  return String(input || "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(input: string) {
  return String(input || "").trim().toLowerCase();
}

function normalizeIdNumber(input: string) {
  return String(input || "").replace(/\D/g, "").trim();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidName(name: string) {
  return /^[A-Za-z\s'-]+$/.test(name);
}

function parseBackendError(e: any): FieldErrors {
  const data = e?.response?.data;
  const pretty = getErrorMessage(e);

  const errors: FieldErrors = {};

  if (typeof data?.detail === "string") {
    errors.general = data.detail;
  }

  if (Array.isArray(data?.username) && data.username.length) {
    errors.username = String(data.username[0]);
  } else if (typeof data?.username === "string") {
    errors.username = data.username;
  }

  if (Array.isArray(data?.phone) && data.phone.length) {
    errors.phone = String(data.phone[0]);
  } else if (typeof data?.phone === "string") {
    errors.phone = data.phone;
  }

  if (Array.isArray(data?.email) && data.email.length) {
    errors.email = String(data.email[0]);
  } else if (typeof data?.email === "string") {
    errors.email = data.email;
  }

  if (Array.isArray(data?.id_number) && data.id_number.length) {
    errors.id_number = String(data.id_number[0]);
  } else if (typeof data?.id_number === "string") {
    errors.id_number = data.id_number;
  }

  if (Array.isArray(data?.password) && data.password.length) {
    errors.password = String(data.password[0]);
  } else if (typeof data?.password === "string") {
    errors.password = data.password;
  }

  return Object.keys(errors).length ? errors : { general: pretty };
}

function getPasswordStrength(password: string) {
  if (!password) {
    return { label: "", color: "rgba(255,255,255,0.60)" };
  }

  if (password.length < 8) {
    return { label: "Too short", color: "#FF8C96" };
  }

  if (/^\d+$/.test(password)) {
    return { label: "Too simple", color: "#FF8C96" };
  }

  if (password.length >= 10) {
    return { label: "Strong", color: "#8CF0C7" };
  }

  return { label: "Good", color: "#8CF0C7" };
}

const UI = {
  page: "#062C49",
  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.88)",
  textMuted: "rgba(255,255,255,0.64)",
  care: "#8CF0C7",
  careDeep: "#197D71",
  card: "rgba(255,255,255,0.10)",
  cardBorder: "rgba(255,255,255,0.12)",
  whiteInput: "#FFFFFF",
  whiteInputBorder: "rgba(255,255,255,0.95)",
  inputText: "#10324A",
  inputPlaceholder: "rgba(16,50,74,0.50)",
  eyeBg: "rgba(12,106,128,0.08)",
  dangerBg: "rgba(220,53,69,0.14)",
  dangerBorder: "rgba(220,53,69,0.28)",
  dangerText: "#FF8C96",
};

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const passwordStrength = useMemo(
    () => getPasswordStrength(password),
    [password]
  );

  const validate = (): boolean => {
    const next: FieldErrors = {};

    const cleanName = normalizeName(username);
    const cleanPhone = normalizePhone(phone);
    const cleanEmail = normalizeEmail(email);
    const cleanId = normalizeIdNumber(idNumber);

    if (!cleanName) {
      next.username = "Full name is required.";
    } else if (!isValidName(cleanName)) {
      next.username =
        "Name can contain letters, spaces, hyphens, and apostrophes only.";
    }

    if (!cleanPhone) {
      next.phone = "Phone number is required.";
    } else if (!/^(07|01)\d{8}$/.test(cleanPhone)) {
      next.phone = "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.";
    }

    if (!cleanEmail) {
      next.email = "Email is required.";
    } else if (!isValidEmail(cleanEmail)) {
      next.email = "Enter a valid email address.";
    }

    if (cleanId && !/^\d{1,9}$/.test(cleanId)) {
      next.id_number = "ID number must be numeric and not exceed 9 digits.";
    }

    if (!password) {
      next.password = "Password is required.";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    } else if (/^\d+$/.test(password)) {
      next.password = "Password cannot be only numbers.";
    }

    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    setErrors({});
    if (!validate()) return;

    try {
      setLoading(true);

      await registerUser({
        username: normalizeName(username),
        phone: normalizePhone(phone),
        email: normalizeEmail(email),
        id_number: normalizeIdNumber(idNumber) || undefined,
        password,
      });

      router.replace("/(auth)/login");
    } catch (e: any) {
      setErrors(parseBackendError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.waveOne} />
        <View style={styles.waveTwo} />
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />

        <View style={styles.container}>
          <View style={styles.heroArea}>
            <View style={styles.brandRow}>
              <Image
                source={require("../../assets/images/transparenticon.png")}
                style={styles.logo}
                resizeMode="contain"
              />

              <View style={styles.brandTextWrap}>
                <Text style={styles.brandLine}>
                  <Text style={styles.brandUnited}>UNITED </Text>
                  <Text style={styles.brandCare}>CARE</Text>
                </Text>
              </View>
            </View>

            <View style={styles.welcomeWrap}>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>
                Join your community space and continue with confidence.
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            {errors.general ? (
              <Text style={styles.generalError}>{errors.general}</Text>
            ) : null}

            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={[styles.input, errors.username ? styles.inputError : null]}
              placeholder="Your full name"
              placeholderTextColor={UI.inputPlaceholder}
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setErrors((prev) => ({
                  ...prev,
                  username: undefined,
                  general: undefined,
                }));
              }}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
              selectionColor={UI.care}
            />
            <Text style={styles.helperText}>
              Use letters only. Spaces, hyphens, and apostrophes are allowed.
            </Text>
            {errors.username ? (
              <Text style={styles.fieldError}>{errors.username}</Text>
            ) : null}

            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={[styles.input, errors.phone ? styles.inputError : null]}
              placeholder="07XXXXXXXX"
              placeholderTextColor={UI.inputPlaceholder}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setErrors((prev) => ({
                  ...prev,
                  phone: undefined,
                  general: undefined,
                }));
              }}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              selectionColor={UI.care}
            />
            <Text style={styles.helperText}>Use 07XXXXXXXX or 01XXXXXXXX.</Text>
            {errors.phone ? (
              <Text style={styles.fieldError}>{errors.phone}</Text>
            ) : null}

            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="you@example.com"
              placeholderTextColor={UI.inputPlaceholder}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors((prev) => ({
                  ...prev,
                  email: undefined,
                  general: undefined,
                }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              selectionColor={UI.care}
            />
            {errors.email ? (
              <Text style={styles.fieldError}>{errors.email}</Text>
            ) : null}

            <Text style={styles.label}>ID number (optional)</Text>
            <TextInput
              style={[styles.input, errors.id_number ? styles.inputError : null]}
              placeholder="Numbers only"
              placeholderTextColor={UI.inputPlaceholder}
              value={idNumber}
              onChangeText={(text) => {
                setIdNumber(text);
                setErrors((prev) => ({
                  ...prev,
                  id_number: undefined,
                  general: undefined,
                }));
              }}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              selectionColor={UI.care}
            />
            <Text style={styles.helperText}>
              Numbers only, maximum 9 digits.
            </Text>
            {errors.id_number ? (
              <Text style={styles.fieldError}>{errors.id_number}</Text>
            ) : null}

            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.passwordWrap,
                errors.password ? styles.inputError : null,
              ]}
            >
              <TextInput
                style={styles.passwordInput}
                placeholder="Create a password"
                placeholderTextColor={UI.inputPlaceholder}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrors((prev) => ({
                    ...prev,
                    password: undefined,
                    general: undefined,
                  }));
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                selectionColor={UI.care}
              />

              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.showBtn}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.showBtnText}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              Use at least 8 characters. Choose something easy to remember, like
              words plus numbers.
            </Text>
            {!!password && (
              <Text
                style={[
                  styles.passwordStrength,
                  { color: passwordStrength.color },
                ]}
              >
                {passwordStrength.label}
              </Text>
            )}
            {errors.password ? (
              <Text style={styles.fieldError}>{errors.password}</Text>
            ) : null}

            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={[
                styles.input,
                errors.confirmPassword ? styles.inputError : null,
              ]}
              placeholder="Repeat your password"
              placeholderTextColor={UI.inputPlaceholder}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setErrors((prev) => ({
                  ...prev,
                  confirmPassword: undefined,
                  general: undefined,
                }));
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              selectionColor={UI.care}
            />
            {errors.confirmPassword ? (
              <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.button, loading ? styles.buttonDisabled : null]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={UI.careDeep} />
                  <Text style={styles.buttonText}>Creating account...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footerHint}>
              After creating your account, you can sign in and stay signed in on
              this device.
            </Text>

            <TouchableOpacity
              onPress={() => router.replace("/(auth)/login")}
              disabled={loading}
            >
              <Text style={styles.link}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: UI.page,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    justifyContent: "center",
    position: "relative",
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(54, 190, 176, 0.10)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -100,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(126, 217, 87, 0.08)",
  },

  waveOne: {
    position: "absolute",
    left: -30,
    right: -30,
    bottom: 110,
    height: 100,
    borderTopLeftRadius: 150,
    borderTopRightRadius: 150,
    backgroundColor: "rgba(125, 220, 185, 0.08)",
    transform: [{ rotate: "-5deg" }],
  },

  waveTwo: {
    position: "absolute",
    left: -20,
    right: -20,
    bottom: 55,
    height: 84,
    borderTopLeftRadius: 150,
    borderTopRightRadius: 150,
    backgroundColor: "rgba(87, 205, 185, 0.10)",
    transform: [{ rotate: "4deg" }],
  },

  glowOne: {
    position: "absolute",
    top: 120,
    right: 18,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  glowTwo: {
    position: "absolute",
    bottom: 180,
    left: 14,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(140,240,199,0.06)",
  },

  heroArea: {
    marginBottom: 12,
    alignItems: "center",
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 4,
  },

  logo: {
    width: 92,
    height: 92,
  },

  brandTextWrap: {
    alignItems: "flex-start",
    justifyContent: "center",
    marginLeft: -2,
  },

  brandLine: {
    includeFontPadding: false,
    textAlignVertical: "center",
  },

  brandUnited: {
    color: UI.text,
    fontFamily: FONT.bold,
    fontSize: 21,
    letterSpacing: 0.5,
    lineHeight: 24,
    textAlign: "left",
  },

  brandCare: {
    color: UI.care,
    fontFamily: FONT.bold,
    fontSize: 28,
    letterSpacing: 0.5,
    lineHeight: 32,
    textAlign: "left",
  },

  welcomeWrap: {
    width: "100%",
    backgroundColor: "rgba(12,106,128,0.24)",
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    ...SHADOW.card,
  },

  title: {
    fontSize: 22,
    color: UI.text,
    textAlign: "center",
    fontFamily: FONT.bold,
  },

  subtitle: {
    marginTop: 4,
    color: UI.textSoft,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontFamily: FONT.medium,
  },

  formCard: {
    backgroundColor: UI.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    ...SHADOW.card,
  },

  label: {
    color: UI.text,
    fontFamily: FONT.bold,
    marginBottom: 6,
    marginTop: 2,
    fontSize: 13,
  },

  generalError: {
    backgroundColor: UI.dangerBg,
    borderColor: UI.dangerBorder,
    borderWidth: 1,
    padding: 10,
    borderRadius: RADIUS.md,
    marginBottom: 10,
    color: UI.dangerText,
    fontFamily: FONT.bold,
    fontSize: 12,
    lineHeight: 17,
  },

  input: {
    borderWidth: 1,
    borderColor: UI.whiteInputBorder,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    marginBottom: 3,
    color: UI.inputText,
    backgroundColor: UI.whiteInput,
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  passwordWrap: {
    borderWidth: 1,
    borderColor: UI.whiteInputBorder,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI.whiteInput,
    paddingLeft: 14,
    marginBottom: 3,
    overflow: "hidden",
  },

  passwordInput: {
    flex: 1,
    paddingVertical: 11,
    color: UI.inputText,
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  showBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: UI.eyeBg,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(12,106,128,0.10)",
  },

  showBtnText: {
    color: UI.careDeep,
    fontFamily: FONT.bold,
    fontSize: 12,
  },

  helperText: {
    color: UI.textMuted,
    fontSize: 10,
    marginBottom: 5,
    lineHeight: 14,
    fontFamily: FONT.regular,
  },

  passwordStrength: {
    fontSize: 11,
    fontFamily: FONT.bold,
    marginBottom: 5,
  },

  inputError: {
    borderColor: UI.dangerText,
  },

  fieldError: {
    color: UI.dangerText,
    marginBottom: 7,
    fontFamily: FONT.medium,
    fontSize: 11,
    lineHeight: 16,
  },

  button: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  buttonText: {
    color: UI.careDeep,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  footerHint: {
    marginTop: 7,
    textAlign: "center",
    color: UI.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontFamily: FONT.regular,
  },

  link: {
    marginTop: 10,
    textAlign: "center",
    color: UI.text,
    fontFamily: FONT.bold,
    fontSize: 17,
    lineHeight: 22,
  },
});