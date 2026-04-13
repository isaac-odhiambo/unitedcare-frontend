import { FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { loginUser } from "@/services/auth";
import { saveSessionUser } from "@/services/session";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type FieldErrors = {
  phone?: string;
  password?: string;
  general?: string;
};

function normalizePhone(input: string) {
  return String(input || "").replace(/\s+/g, "").trim();
}

function isValidKenyanPhone(phone: string) {
  return /^(07|01)\d{8}$/.test(phone);
}

function mapMessageToField(msg: string): FieldErrors {
  const lower = String(msg || "").toLowerCase();

  if (lower.includes("phone")) return { phone: msg };
  if (lower.includes("password")) return { password: msg };
  if (lower.includes("locked")) return { general: msg };
  if (lower.includes("blocked")) return { general: msg };
  if (lower.includes("disabled")) return { general: msg };
  if (lower.includes("invalid")) return { general: msg };

  return { general: msg };
}

function parseBackendError(e: any): FieldErrors {
  const pretty = getErrorMessage(e);
  const data = e?.response?.data;

  if (typeof data?.detail === "string") {
    return mapMessageToField(data.detail);
  }

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return mapMessageToField(String(data.non_field_errors[0]));
  }

  const errors: FieldErrors = {};

  if (Array.isArray(data?.phone) && data.phone.length) {
    errors.phone = String(data.phone[0]);
  } else if (typeof data?.phone === "string") {
    errors.phone = data.phone;
  }

  if (Array.isArray(data?.password) && data.password.length) {
    errors.password = String(data.password[0]);
  } else if (typeof data?.password === "string") {
    errors.password = data.password;
  }

  if (Object.keys(errors).length) return errors;

  return { general: pretty || "Login failed. Please try again." };
}

function pickUserFromLoginResponse(data: any) {
  const src = data?.user ?? data ?? {};

  return {
    id: src?.id,
    username: src?.username,
    phone: src?.phone,
    email: src?.email ?? null,
    id_number: src?.id_number ?? null,
    role: src?.role,
    status: src?.status,
    is_active: typeof src?.is_active === "boolean" ? src.is_active : undefined,
    is_phone_verified:
      typeof src?.is_phone_verified === "boolean"
        ? src.is_phone_verified
        : undefined,
    is_admin:
      typeof src?.is_admin === "boolean"
        ? src.is_admin
        : !!(src?.role === "admin"),
    has_limited_access:
      typeof src?.has_limited_access === "boolean"
        ? src.has_limited_access
        : undefined,
    has_full_access:
      typeof src?.has_full_access === "boolean"
        ? src.has_full_access
        : undefined,
    requires_phone_verification:
      typeof src?.requires_phone_verification === "boolean"
        ? src.requires_phone_verification
        : undefined,
  };
}

const UI = {
  page: "#062C49",
  pageDeep: "#041D31",
  pageSoft: "#0C6A80",

  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.88)",
  textMuted: "rgba(255,255,255,0.66)",

  care: "#8CF0C7",
  careDeep: "#197D71",

  card: "rgba(255,255,255,0.10)",
  cardBorder: "rgba(255,255,255,0.12)",

  inputBg: "rgba(4,22,38,0.94)",
  inputBorder: "rgba(140,240,199,0.18)",

  eyeBg: "rgba(255,255,255,0.08)",
  dangerBg: "rgba(220,53,69,0.14)",
  dangerBorder: "rgba(220,53,69,0.28)",
  dangerText: "#FF8C96",
};

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const phoneHint = useMemo(() => {
    const clean = normalizePhone(phone);
    if (!clean) return "Use 07XXXXXXXX or 01XXXXXXXX";
    if (isValidKenyanPhone(clean)) return "Phone number looks good";
    return "Use a valid Kenyan phone number";
  }, [phone]);

  const validate = (): boolean => {
    const next: FieldErrors = {};
    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone) {
      next.phone = "Phone number is required.";
    } else if (!isValidKenyanPhone(cleanPhone)) {
      next.phone = "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.";
    }

    if (!password) {
      next.password = "Password is required.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    setErrors({});
    if (!validate()) return;

    try {
      setLoading(true);

      const cleanPhone = normalizePhone(phone);
      const data = await loginUser({ phone: cleanPhone, password });
      const account = pickUserFromLoginResponse(data);

      if (account?.status === "blocked") {
        setErrors({
          general: "Your account has been blocked. Contact support.",
        });
        return;
      }

      if (account?.is_active === false) {
        setErrors({
          general: "Your account is disabled. Contact support.",
        });
        return;
      }

      await saveSessionUser(account);
      router.replace("/(tabs)/dashboard" as any);
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
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.waveOne} />
        <View style={styles.waveTwo} />
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />

        <View style={styles.container}>
          <View style={styles.heroArea}>
            <View style={styles.logoWrap}>
              <Image
                source={require("../../assets/images/transparenticon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.brandTextWrap}>
              <Text style={styles.brandUnited}>UNITED</Text>
              <Text style={styles.brandCare}>CARE</Text>
            </View>

            <View style={styles.welcomeWrap}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>
                Sign in to continue with your community space.
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            {errors.general ? (
              <Text style={styles.generalError}>{errors.general}</Text>
            ) : null}

            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={[styles.input, errors.phone ? styles.inputError : null]}
              placeholder="07XXXXXXXX"
              placeholderTextColor={UI.textMuted}
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
            <Text
              style={[
                styles.helperText,
                phone && isValidKenyanPhone(normalizePhone(phone))
                  ? styles.helperTextOk
                  : null,
              ]}
            >
              {phoneHint}
            </Text>
            {errors.phone ? (
              <Text style={styles.fieldError}>{errors.phone}</Text>
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
                placeholder="Enter your password"
                placeholderTextColor={UI.textMuted}
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
              Use the password you created during registration.
            </Text>
            {errors.password ? (
              <Text style={styles.fieldError}>{errors.password}</Text>
            ) : null}

            <View style={styles.optionsRow}>
              <Pressable
                style={styles.rememberWrap}
                onPress={() => setRememberMe((prev) => !prev)}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe ? styles.checkboxChecked : null,
                  ]}
                >
                  {rememberMe ? <View style={styles.checkboxInner} /> : null}
                </View>
                <Text style={styles.rememberText}>Keep me signed in</Text>
              </Pressable>

              <TouchableOpacity
                onPress={() => router.push("/(auth)/forgot-password")}
                disabled={loading}
              >
                <Text style={styles.linkInline}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading ? styles.buttonDisabled : null]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={UI.careDeep} />
                  <Text style={styles.buttonText}>Signing in...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footerHint}>
              {rememberMe
                ? "You should not need to sign in every time on this device."
                : "You may need to sign in again after leaving the app."}
            </Text>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/register")}
              disabled={loading}
            >
              <Text style={styles.link}>Create account</Text>
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
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    justifyContent: "center",
    position: "relative",
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(54, 190, 176, 0.10)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -100,
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(126, 217, 87, 0.08)",
  },

  waveOne: {
    position: "absolute",
    left: -30,
    right: -30,
    bottom: 120,
    height: 110,
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
    height: 95,
    borderTopLeftRadius: 150,
    borderTopRightRadius: 150,
    backgroundColor: "rgba(87, 205, 185, 0.10)",
    transform: [{ rotate: "4deg" }],
  },

  glowOne: {
    position: "absolute",
    top: 120,
    right: 18,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  glowTwo: {
    position: "absolute",
    bottom: 180,
    left: 14,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(140,240,199,0.06)",
  },

  heroArea: {
    marginBottom: SPACING.lg,
    alignItems: "center",
  },

  logoWrap: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  logo: {
    width: 138,
    height: 138,
  },

  brandTextWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },

  brandUnited: {
    color: UI.text,
    fontFamily: FONT.bold,
    fontSize: 22,
    letterSpacing: 1.2,
    lineHeight: 28,
    textAlign: "center",
  },

  brandCare: {
    color: UI.care,
    fontFamily: FONT.bold,
    fontSize: 34,
    letterSpacing: 1.4,
    lineHeight: 40,
    textAlign: "center",
    marginTop: 2,
  },

  welcomeWrap: {
    width: "100%",
    backgroundColor: "rgba(12,106,128,0.26)",
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    ...SHADOW.card,
  },

  title: {
    fontSize: 26,
    color: UI.text,
    textAlign: "center",
    fontFamily: FONT.bold,
  },

  subtitle: {
    marginTop: SPACING.xs,
    color: UI.textSoft,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontFamily: FONT.medium,
  },

  formCard: {
    backgroundColor: UI.card,
    borderRadius: 28,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    ...SHADOW.card,
  },

  label: {
    color: UI.text,
    fontFamily: FONT.bold,
    marginBottom: 8,
    marginTop: 4,
    fontSize: 14,
  },

  generalError: {
    backgroundColor: UI.dangerBg,
    borderColor: UI.dangerBorder,
    borderWidth: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    color: UI.dangerText,
    fontFamily: FONT.bold,
    fontSize: 12,
    lineHeight: 18,
  },

  input: {
    borderWidth: 1,
    borderColor: UI.inputBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: 16,
    marginBottom: 4,
    color: UI.text,
    backgroundColor: UI.inputBg,
    fontSize: 15,
    fontFamily: FONT.medium,
  },

  passwordWrap: {
    borderWidth: 1,
    borderColor: UI.inputBorder,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI.inputBg,
    paddingLeft: SPACING.md,
    marginBottom: 4,
    overflow: "hidden",
  },

  passwordInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    color: UI.text,
    fontSize: 15,
    fontFamily: FONT.medium,
  },

  showBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: UI.eyeBg,
    borderLeftWidth: 1,
    borderLeftColor: UI.inputBorder,
  },

  showBtnText: {
    color: UI.care,
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  helperText: {
    color: UI.textMuted,
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 17,
    fontFamily: FONT.regular,
  },

  helperTextOk: {
    color: UI.care,
  },

  inputError: {
    borderColor: UI.dangerText,
  },

  fieldError: {
    color: UI.dangerText,
    marginBottom: SPACING.sm,
    fontFamily: FONT.medium,
    fontSize: 12,
    lineHeight: 18,
  },

  optionsRow: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  rememberWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: UI.inputBorder,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxChecked: {
    backgroundColor: UI.pageSoft,
    borderColor: UI.pageSoft,
  },

  checkboxInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: UI.text,
  },

  rememberText: {
    color: UI.textSoft,
    fontSize: 12,
    fontFamily: FONT.medium,
  },

  linkInline: {
    color: UI.care,
    fontFamily: FONT.bold,
    fontSize: 12,
  },

  button: {
    backgroundColor: "#FFFFFF",
    padding: SPACING.md,
    borderRadius: 16,
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
    color: UI.careDeep,
    fontFamily: FONT.bold,
    fontSize: 15,
  },

  footerHint: {
    marginTop: SPACING.sm,
    textAlign: "center",
    color: UI.textMuted,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: FONT.regular,
  },

  link: {
    marginTop: SPACING.md,
    textAlign: "center",
    color: UI.textSoft,
    fontFamily: FONT.bold,
    fontSize: 13,
  },
});