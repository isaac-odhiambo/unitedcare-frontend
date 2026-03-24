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
  id_number?: string;
  password?: string;
  general?: string;
};

function normalizePhone(input: string) {
  return input.replace(/\s+/g, "").trim();
}

function normalizeName(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function normalizeIdNumber(input: string) {
  return input.replace(/\D/g, "").trim();
}

function parseBackendError(e: any): FieldErrors {
  const pretty = getErrorMessage(e);
  const data = e?.response?.data;

  if (typeof data?.detail === "string") {
    return { general: data.detail };
  }

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return { general: String(data.non_field_errors[0]) };
  }

  const errors: FieldErrors = {};

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

  if (Object.keys(errors).length > 0) return errors;

  return { general: pretty || "Registration failed. Please try again." };
}

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const next: FieldErrors = {};

    const cleanName = normalizeName(username);
    const cleanPhone = normalizePhone(phone);
    const cleanIdNumber = normalizeIdNumber(idNumber);

    if (!cleanName) {
      next.username = "Name is required.";
    } else if (!/^[A-Za-z\s'-]+$/.test(cleanName)) {
      next.username =
        "Name can contain letters, spaces, hyphens, and apostrophes only.";
    }

    if (!cleanPhone) {
      next.phone = "Phone number is required.";
    } else if (!/^(07|01)\d{8}$/.test(cleanPhone)) {
      next.phone = "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.";
    }

    if (cleanIdNumber && !/^\d{1,9}$/.test(cleanIdNumber)) {
      next.id_number = "ID number must be numeric and not exceed 9 digits.";
    }

    if (!password.trim()) {
      next.password = "Password is required.";
    } else if (password.length < 6) {
      next.password = "Password must be at least 6 characters.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    setErrors({});

    if (!validate()) return;

    const cleanName = normalizeName(username);
    const cleanPhone = normalizePhone(phone);
    const cleanIdNumber = normalizeIdNumber(idNumber);

    try {
      setLoading(true);

      await registerUser({
        username: cleanName,
        phone: cleanPhone,
        id_number: cleanIdNumber || undefined,
        password,
      });

      router.push({
        pathname: "/(auth)/verify-otp",
        params: { phone: cleanPhone },
      });
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
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Register to continue</Text>

        {errors.general ? (
          <Text style={styles.generalError}>{errors.general}</Text>
        ) : null}

        <TextInput
          style={[styles.input, errors.username ? styles.inputError : null]}
          placeholder="Full Name"
          placeholderTextColor={COLORS.gray}
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (errors.username || errors.general) {
              setErrors((prev) => ({
                ...prev,
                username: undefined,
                general: undefined,
              }));
            }
          }}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!loading}
        />
        {errors.username ? (
          <Text style={styles.fieldError}>{errors.username}</Text>
        ) : null}

        <TextInput
          style={[styles.input, errors.phone ? styles.inputError : null]}
          placeholder="Phone (07XXXXXXXX)"
          placeholderTextColor={COLORS.gray}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            if (errors.phone || errors.general) {
              setErrors((prev) => ({
                ...prev,
                phone: undefined,
                general: undefined,
              }));
            }
          }}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {errors.phone ? (
          <Text style={styles.fieldError}>{errors.phone}</Text>
        ) : null}

        <TextInput
          style={[styles.input, errors.id_number ? styles.inputError : null]}
          placeholder="ID Number (optional)"
          placeholderTextColor={COLORS.gray}
          value={idNumber}
          onChangeText={(text) => {
            setIdNumber(normalizeIdNumber(text));
            if (errors.id_number || errors.general) {
              setErrors((prev) => ({
                ...prev,
                id_number: undefined,
                general: undefined,
              }));
            }
          }}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          maxLength={9}
        />
        {errors.id_number ? (
          <Text style={styles.fieldError}>{errors.id_number}</Text>
        ) : null}

        <TextInput
          style={[styles.input, errors.password ? styles.inputError : null]}
          placeholder="Password"
          placeholderTextColor={COLORS.gray}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password || errors.general) {
              setErrors((prev) => ({
                ...prev,
                password: undefined,
                general: undefined,
              }));
            }
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {errors.password ? (
          <Text style={styles.fieldError}>{errors.password}</Text>
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
              <Text style={styles.buttonText}>Creating...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Register</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace("/(auth)/login")}
          disabled={loading}
        >
          <Text style={styles.link}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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