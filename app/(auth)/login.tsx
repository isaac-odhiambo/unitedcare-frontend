import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { loginUser } from "@/services/auth";
import { saveSessionUser } from "@/services/session";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
  return input.replace(/\s+/g, "").trim();
}

function mapMessageToField(msg: string): FieldErrors {
  const lower = msg.toLowerCase();
  if (lower.includes("phone")) return { phone: msg };
  if (lower.includes("password")) return { password: msg };
  if (lower.includes("otp")) return { general: msg };
  if (lower.includes("locked")) return { general: msg };
  if (lower.includes("blocked")) return { general: msg };
  if (lower.includes("activated")) return { general: msg };
  return { general: msg };
}

function parseBackendError(e: any): FieldErrors {
  const pretty = getErrorMessage(e);
  const data = e?.response?.data;

  if (typeof data?.detail === "string") return mapMessageToField(data.detail);

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return mapMessageToField(data.non_field_errors[0]);
  }

  const errors: FieldErrors = {};
  if (Array.isArray(data?.phone) && data.phone.length) errors.phone = data.phone[0];
  if (Array.isArray(data?.password) && data.password.length) errors.password = data.password[0];

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
    is_admin:
      typeof src?.is_admin === "boolean"
        ? src.is_admin
        : !!(src?.role === "admin"),

    kyc_status: src?.kyc_status,
    is_kyc_approved:
      typeof src?.is_kyc_approved === "boolean"
        ? src.is_kyc_approved
        : undefined,

    has_limited_access:
      typeof src?.has_limited_access === "boolean"
        ? src.has_limited_access
        : undefined,

    has_full_access:
      typeof src?.has_full_access === "boolean"
        ? src.has_full_access
        : undefined,
  };
}

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const next: FieldErrors = {};
    const p = normalizePhone(phone);

    if (!p) next.phone = "Phone number is required.";
    else if (!/^(07|01)\d{8}$/.test(p)) {
      next.phone = "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.";
    }

    if (!password) next.password = "Password is required.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    setErrors({});
    if (!validate()) return;

    try {
      setLoading(true);

      const p = normalizePhone(phone);
      const data = await loginUser({ phone: p, password });

      const account = pickUserFromLoginResponse(data);

      if (account?.status === "blocked") {
        setErrors({ general: "Your account has been blocked. Contact support." });
        return;
      }

      await saveSessionUser(account);

      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      const parsed = parseBackendError(e);
      setErrors(parsed);

      console.log("LOGIN ERROR:", {
        message: getErrorMessage(e),
        status: e?.response?.status,
        data: e?.response?.data,
        baseURL: e?.config?.baseURL,
        url: e?.config?.url,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.white }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>Welcome back</Text>

        {errors.general ? <Text style={styles.generalError}>{errors.general}</Text> : null}

        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          placeholder="Phone (07XXXXXXXX)"
          placeholderTextColor={COLORS.gray}
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            if (errors.phone) setErrors((p) => ({ ...p, phone: undefined }));
            if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
          }}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}

        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Password"
          placeholderTextColor={COLORS.gray}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
            if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={COLORS.white} />
              <Text style={styles.buttonText}>Logging in...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} disabled={loading}>
          <Text style={styles.link}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/register")} disabled={loading}>
          <Text style={styles.link}>Create account</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: FONT.title,
    fontWeight: "800",
    color: COLORS.primary,
  },
  subtitle: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
    color: COLORS.gray,
    fontSize: FONT.subtitle,
  },
  generalError: {
    backgroundColor: "#ffecec",
    borderColor: "#ffb3b3",
    borderWidth: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    color: "#990000",
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 6,
    color: COLORS.dark,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  fieldError: {
    color: COLORS.danger,
    marginBottom: SPACING.sm,
    fontWeight: "600",
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
  buttonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: FONT.body,
  },
  link: {
    marginTop: SPACING.md,
    textAlign: "center",
    color: COLORS.primary,
    fontWeight: "600",
  },
});