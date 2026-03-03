// app/(auth)/register.tsx
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { registerUser } from "@/services/auth";
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
  username?: string;
  phone?: string;
  password?: string;
  general?: string;
};

function normalizePhone(input: string) {
  return input.replace(/\s+/g, "").trim();
}

function parseBackendError(e: any): FieldErrors {
  const pretty = getErrorMessage(e);
  const data = e?.response?.data;

  if (typeof data?.detail === "string") return { general: data.detail };

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return { general: data.non_field_errors[0] };
  }

  const errors: FieldErrors = {};
  if (Array.isArray(data?.username) && data.username.length) errors.username = data.username[0];
  if (Array.isArray(data?.phone) && data.phone.length) errors.phone = data.phone[0];
  if (Array.isArray(data?.password) && data.password.length) errors.password = data.password[0];

  if (Object.keys(errors).length) return errors;

  return { general: pretty || "Registration failed. Please try again." };
}

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const next: FieldErrors = {};
    const p = normalizePhone(phone);

    if (!username) next.username = "Name is required.";
    else if (!/^[A-Za-z\s'-]+$/.test(username.trim()))
     next.username = "Name can contain letters, spaces, hyphens, and apostrophes only.";

    if (!p) next.phone = "Phone number is required.";
    else if (!/^(07|01)\d{8}$/.test(p)) next.phone = "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.";

    if (!password) next.password = "Password is required.";
    else if (password.length < 6) next.password = "Password must be at least 6 characters.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
  setErrors({});
  if (!validate()) return;

  try {
    setLoading(true);

    const p = normalizePhone(phone);
    const cleanName = username.trim().replace(/\s+/g, " ");

    const data = await registerUser({ username: cleanName, phone: p, password });

    // ✅ best flow: go to verify-otp with phone
    if (data?.detail) {
      // optional: show success message
    }

    router.push({ pathname: "/(auth)/verify-otp", params: { phone: p } });
  } catch (e: any) {
    setErrors(parseBackendError(e));

    console.log("REGISTER ERROR:", {
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
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Register to continue</Text>

        {errors.general ? <Text style={styles.generalError}>{errors.general}</Text> : null}

        <TextInput
          style={[styles.input, errors.username && styles.inputError]}
          placeholder="Full Name"
          placeholderTextColor={COLORS.gray}
          value={username}
          onChangeText={(t) => {
            setUsername(t);
            if (errors.username) setErrors((p) => ({ ...p, username: undefined }));
            if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
          }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {errors.username ? <Text style={styles.fieldError}>{errors.username}</Text> : null}

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
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={COLORS.white} />
              <Text style={styles.buttonText}>Creating...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Register</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(auth)/login")} disabled={loading}>
          <Text style={styles.link}>Already have an account? Login</Text>
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
  title: { fontSize: FONT.title, fontWeight: "800", color: COLORS.primary },
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
  inputError: { borderColor: COLORS.danger },
  fieldError: { color: COLORS.danger, marginBottom: SPACING.sm, fontWeight: "600" },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: COLORS.white, fontWeight: "700", fontSize: FONT.body },
  link: { marginTop: SPACING.md, textAlign: "center", color: COLORS.primary, fontWeight: "600" },
});
