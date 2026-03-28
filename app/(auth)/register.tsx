// app/(auth)/register.tsx

import { COLORS, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { registerUser } from "@/services/auth";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
    return { label: "", color: COLORS.gray };
  }

  if (password.length < 8) {
    return { label: "Too short", color: COLORS.danger };
  }

  if (/^\d+$/.test(password)) {
    return { label: "Too simple", color: COLORS.danger };
  }

  if (password.length >= 10) {
    return { label: "Strong", color: COLORS.success };
  }

  return { label: "Good", color: COLORS.primary };
}

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
      keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.heroCard}>
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />

            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Join your community space and continue with confidence.
            </Text>
          </View>

          <View style={styles.formCard}>
            {errors.general ? (
              <Text style={styles.generalError}>{errors.general}</Text>
            ) : null}

            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={[styles.input, errors.username ? styles.inputError : null]}
              placeholder="Your full name"
              placeholderTextColor={COLORS.gray}
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
              placeholderTextColor={COLORS.gray}
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
            />
            <Text style={styles.helperText}>
              Use 07XXXXXXXX or 01XXXXXXXX.
            </Text>
            {errors.phone ? (
              <Text style={styles.fieldError}>{errors.phone}</Text>
            ) : null}

            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.gray}
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
            />
            {errors.email ? (
              <Text style={styles.fieldError}>{errors.email}</Text>
            ) : null}

            <Text style={styles.label}>ID number (optional)</Text>
            <TextInput
              style={[styles.input, errors.id_number ? styles.inputError : null]}
              placeholder="Numbers only"
              placeholderTextColor={COLORS.gray}
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
                placeholderTextColor={COLORS.gray}
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
              />

              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.showBtn}
                disabled={loading}
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
              placeholderTextColor={COLORS.gray}
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
                  <ActivityIndicator color={COLORS.white} />
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
              <Text style={styles.link}>Already have an account? Sign in</Text>
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
    backgroundColor: COLORS.white,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flex: 1,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    justifyContent: "center",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl || RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },

  heroGlowOne: {
    position: "absolute",
    right: -28,
    top: -18,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.09)",
  },

  heroGlowTwo: {
    position: "absolute",
    left: -18,
    bottom: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(242,140,40,0.18)",
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.white,
  },

  subtitle: {
    marginTop: SPACING.xs,
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    lineHeight: 19,
  },

  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl || RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  label: {
    color: COLORS.dark,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 4,
    fontSize: 13,
  },

  generalError: {
    backgroundColor: "rgba(220,53,69,0.08)",
    borderColor: "rgba(220,53,69,0.18)",
    borderWidth: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    color: COLORS.danger,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 4,
    color: COLORS.dark,
    backgroundColor: COLORS.white,
  },

  passwordWrap: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingLeft: SPACING.md,
    marginBottom: 4,
  },

  passwordInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    color: COLORS.dark,
    fontSize: 14,
  },

  showBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  showBtnText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 12,
  },

  helperText: {
    color: COLORS.gray,
    fontSize: 11,
    marginBottom: 8,
    lineHeight: 16,
  },

  passwordStrength: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },

  inputError: {
    borderColor: COLORS.danger,
  },

  fieldError: {
    color: COLORS.danger,
    marginBottom: SPACING.sm,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 18,
  },

  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: SPACING.sm,
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
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14,
  },

  footerHint: {
    marginTop: SPACING.sm,
    textAlign: "center",
    color: COLORS.gray,
    fontSize: 11,
    lineHeight: 17,
  },

  link: {
    marginTop: SPACING.md,
    textAlign: "center",
    color: COLORS.primary,
    fontWeight: "600",
    fontSize: 13,
  },
});