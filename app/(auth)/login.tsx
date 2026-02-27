import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { loginUser } from "@/services/auth";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type FieldErrors = {
  phone?: string;
  password?: string;
  general?: string;
};

function parseBackendError(e: any): FieldErrors {
  const data = e?.response?.data;

  // DRF sometimes returns:
  // { detail: "..." }
  if (typeof data?.detail === "string") {
    const msg = data.detail;

    // Map common backend messages to fields
    if (msg.toLowerCase().includes("phone")) return { phone: msg };
    if (msg.toLowerCase().includes("password")) return { password: msg };
    return { general: msg };
  }

  // Sometimes:
  // { non_field_errors: ["..."] }
  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return { general: data.non_field_errors[0] };
  }

  // Sometimes field errors:
  // { phone: ["..."], password: ["..."] }
  const errors: FieldErrors = {};
  if (Array.isArray(data?.phone) && data.phone.length) errors.phone = data.phone[0];
  if (Array.isArray(data?.password) && data.password.length) errors.password = data.password[0];

  if (Object.keys(errors).length) return errors;

  return { general: "Login failed. Please try again." };
}

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const next: FieldErrors = {};

    if (!phone.trim()) next.phone = "Phone number is required.";
    else if (!/^(07|01)\d{8}$/.test(phone.trim()))
      next.phone = "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.";

    if (!password) next.password = "Password is required.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    setErrors({});
    if (!validate()) return;

    try {
      setLoading(true);
      await loginUser({ phone: phone.trim(), password });

      // ✅ After successful login, go to tabs root
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      const parsed = parseBackendError(e);
      setErrors(parsed);
    } finally {
      setLoading(false);
    }
  };

  return (
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
        }}
        keyboardType="phone-pad"
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
        }}
        secureTextEntry
      />
      {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? "Logging in..." : "Login"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")}>
        <Text style={styles.link}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
        <Text style={styles.link}>Create account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    justifyContent: "center",
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