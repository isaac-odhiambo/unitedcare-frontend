import { COLORS, RADIUS, SHADOW, SPACING } from "@/constants/theme";
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
    requires_phone_verification:
      typeof src?.requires_phone_verification === "boolean"
        ? src.requires_phone_verification
        : undefined,
  };
}

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

        <View style={styles.container}>
          <View style={styles.heroArea}>
            <View style={styles.brandRow}>
              <Image
                source={require("../../assets/images/transparenticon.png")}
                style={styles.logo}
                resizeMode="contain"
              />

              <View style={styles.brandTextWrap}>
                <Text style={styles.brandText}>UNITED CARE</Text>
              </View>
            </View>

            <View style={styles.welcomeWrap}>
              <Text style={styles.title}>Welcome Back!</Text>
              <Text style={styles.subtitle}>
                Sign in to rejoin your community space.
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
                  <ActivityIndicator color={COLORS.white} />
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
    backgroundColor: "#062C3D",
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

  heroArea: {
    marginBottom: SPACING.lg,
    alignItems: "center",
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },

  logo: {
    width: 92,
    height: 92,
    marginRight: 12,
  },

  brandTextWrap: {
    justifyContent: "center",
  },

  brandText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 26,
    letterSpacing: 0.6,
  },

  welcomeWrap: {
    width: "100%",
    backgroundColor: "#0C6A80",
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    ...SHADOW.card,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.white,
    textAlign: "center",
  },

  subtitle: {
    marginTop: SPACING.xs,
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
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
    color: "#0C6A80",
    fontWeight: "700",
    fontSize: 12,
  },

  helperText: {
    color: COLORS.gray,
    fontSize: 11,
    marginBottom: 8,
    lineHeight: 16,
  },

  helperTextOk: {
    color: COLORS.success,
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
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxChecked: {
    backgroundColor: "#0C6A80",
    borderColor: "#0C6A80",
  },

  checkboxInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.white,
  },

  rememberText: {
    color: COLORS.dark,
    fontSize: 12,
  },

  linkInline: {
    color: "#0C6A80",
    fontWeight: "600",
    fontSize: 12,
  },

  button: {
    backgroundColor: "#0C6A80",
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
    color: "#0C6A80",
    fontWeight: "600",
    fontSize: 13,
  },
});

// import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
// import { getErrorMessage } from "@/services/api";
// import { loginUser } from "@/services/auth";
// import { saveSessionUser } from "@/services/session";
// import { router } from "expo-router";
// import { useState } from "react";
// import {
//   ActivityIndicator,
//   KeyboardAvoidingView,
//   Platform,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from "react-native";

// type FieldErrors = {
//   phone?: string;
//   password?: string;
//   general?: string;
// };

// function normalizePhone(input: string) {
//   return String(input || "").replace(/\s+/g, "").trim();
// }

// function mapMessageToField(msg: string): FieldErrors {
//   const lower = String(msg || "").toLowerCase();

//   if (lower.includes("phone")) return { phone: msg };
//   if (lower.includes("password")) return { password: msg };
//   if (lower.includes("locked")) return { general: msg };
//   if (lower.includes("blocked")) return { general: msg };
//   if (lower.includes("disabled")) return { general: msg };
//   if (lower.includes("invalid")) return { general: msg };

//   return { general: msg };
// }

// function parseBackendError(e: any): FieldErrors {
//   const pretty = getErrorMessage(e);
//   const data = e?.response?.data;

//   if (typeof data?.detail === "string") {
//     return mapMessageToField(data.detail);
//   }

//   if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
//     return mapMessageToField(data.non_field_errors[0]);
//   }

//   const errors: FieldErrors = {};

//   if (Array.isArray(data?.phone) && data.phone.length) {
//     errors.phone = String(data.phone[0]);
//   }

//   if (Array.isArray(data?.password) && data.password.length) {
//     errors.password = String(data.password[0]);
//   }

//   if (Object.keys(errors).length) return errors;

//   return { general: pretty || "Login failed. Please try again." };
// }

// function pickUserFromLoginResponse(data: any) {
//   const src = data?.user ?? data ?? {};

//   return {
//     id: src?.id,
//     username: src?.username,
//     phone: src?.phone,
//     email: src?.email ?? null,
//     id_number: src?.id_number ?? null,

//     role: src?.role,
//     status: src?.status,

//     is_active: typeof src?.is_active === "boolean" ? src.is_active : undefined,
//     is_phone_verified:
//       typeof src?.is_phone_verified === "boolean"
//         ? src.is_phone_verified
//         : undefined,
//     is_admin:
//       typeof src?.is_admin === "boolean"
//         ? src.is_admin
//         : !!(src?.role === "admin"),

//     kyc_status: src?.kyc_status,
//     is_kyc_approved:
//       typeof src?.is_kyc_approved === "boolean"
//         ? src.is_kyc_approved
//         : undefined,

//     has_limited_access:
//       typeof src?.has_limited_access === "boolean"
//         ? src.has_limited_access
//         : undefined,

//     has_full_access:
//       typeof src?.has_full_access === "boolean"
//         ? src.has_full_access
//         : undefined,

//     requires_phone_verification:
//       typeof src?.requires_phone_verification === "boolean"
//         ? src.requires_phone_verification
//         : undefined,
//   };
// }

// export default function LoginScreen() {
//   const [phone, setPhone] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [errors, setErrors] = useState<FieldErrors>({});

//   const validate = (): boolean => {
//     const next: FieldErrors = {};
//     const p = normalizePhone(phone);

//     if (!p) {
//       next.phone = "Phone number is required.";
//     } else if (!/^(07|01)\d{8}$/.test(p)) {
//       next.phone = "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.";
//     }

//     if (!password) {
//       next.password = "Password is required.";
//     }

//     setErrors(next);
//     return Object.keys(next).length === 0;
//   };

//   const handleLogin = async () => {
//     setErrors({});
//     if (!validate()) return;

//     try {
//       setLoading(true);

//       const cleanPhone = normalizePhone(phone);
//       const data = await loginUser({ phone: cleanPhone, password });
//       const account = pickUserFromLoginResponse(data);

//       if (account?.status === "blocked") {
//         setErrors({
//           general: "Your account has been blocked. Contact support.",
//         });
//         return;
//       }

//       if (account?.is_active === false) {
//         setErrors({
//           general: "Your account is disabled. Contact support.",
//         });
//         return;
//       }

//       if (account?.is_phone_verified === false) {
//         setErrors({
//           general: "Please verify your phone before logging in.",
//         });
//         return;
//       }

//       await saveSessionUser(account);

//       setTimeout(() => {
//         router.replace("/(tabs)/dashboard");
//       }, 100);
//     } catch (e: any) {
//       const parsed = parseBackendError(e);
//       setErrors(parsed);

//       console.log("LOGIN ERROR:", {
//         message: getErrorMessage(e),
//         status: e?.response?.status,
//         data: e?.response?.data,
//         baseURL: e?.config?.baseURL,
//         url: e?.config?.url,
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <KeyboardAvoidingView
//       style={styles.screen}
//       behavior={Platform.OS === "ios" ? "padding" : undefined}
//     >
//       <View style={styles.container}>
//         <Text style={styles.title}>Login</Text>
//         <Text style={styles.subtitle}>Welcome back</Text>

//         {errors.general ? (
//           <Text style={styles.generalError}>{errors.general}</Text>
//         ) : null}

//         <TextInput
//           style={[styles.input, errors.phone ? styles.inputError : null]}
//           placeholder="Phone (07XXXXXXXX)"
//           placeholderTextColor={COLORS.gray}
//           value={phone}
//           onChangeText={(t) => {
//             setPhone(t);
//             setErrors((prev) => ({
//               ...prev,
//               phone: undefined,
//               general: undefined,
//             }));
//           }}
//           keyboardType="phone-pad"
//           autoCapitalize="none"
//           autoCorrect={false}
//           editable={!loading}
//         />
//         {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}

//         <TextInput
//           style={[styles.input, errors.password ? styles.inputError : null]}
//           placeholder="Password"
//           placeholderTextColor={COLORS.gray}
//           value={password}
//           onChangeText={(t) => {
//             setPassword(t);
//             setErrors((prev) => ({
//               ...prev,
//               password: undefined,
//               general: undefined,
//             }));
//           }}
//           secureTextEntry
//           autoCapitalize="none"
//           autoCorrect={false}
//           editable={!loading}
//         />
//         {errors.password ? (
//           <Text style={styles.fieldError}>{errors.password}</Text>
//         ) : null}

//         <TouchableOpacity
//           style={[styles.button, loading ? styles.buttonDisabled : null]}
//           onPress={handleLogin}
//           disabled={loading}
//           activeOpacity={0.9}
//         >
//           {loading ? (
//             <View style={styles.loadingRow}>
//               <ActivityIndicator color={COLORS.white} />
//               <Text style={styles.buttonText}>Logging in...</Text>
//             </View>
//           ) : (
//             <Text style={styles.buttonText}>Login</Text>
//           )}
//         </TouchableOpacity>

//         <TouchableOpacity
//           onPress={() => router.push("/(auth)/forgot-password")}
//           disabled={loading}
//         >
//           <Text style={styles.link}>Forgot password?</Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           onPress={() => router.push("/(auth)/register")}
//           disabled={loading}
//         >
//           <Text style={styles.link}>Create account</Text>
//         </TouchableOpacity>
//       </View>
//     </KeyboardAvoidingView>
//   );
// }

// const styles = StyleSheet.create({
//   screen: {
//     flex: 1,
//     backgroundColor: COLORS.white,
//   },
//   container: {
//     flex: 1,
//     padding: SPACING.md,
//     justifyContent: "center",
//     backgroundColor: COLORS.white,
//   },
//   title: {
//     fontSize: FONT.title,
//     fontWeight: "800",
//     color: COLORS.primary,
//   },
//   subtitle: {
//     marginTop: SPACING.xs,
//     marginBottom: SPACING.lg,
//     color: COLORS.gray,
//     fontSize: FONT.subtitle,
//   },
//   generalError: {
//     backgroundColor: "#ffecec",
//     borderColor: "#ffb3b3",
//     borderWidth: 1,
//     padding: SPACING.sm,
//     borderRadius: RADIUS.md,
//     marginBottom: SPACING.sm,
//     color: "#990000",
//     fontWeight: "700",
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: COLORS.lightGray,
//     padding: SPACING.md,
//     borderRadius: RADIUS.md,
//     marginBottom: 6,
//     color: COLORS.dark,
//   },
//   inputError: {
//     borderColor: COLORS.danger,
//   },
//   fieldError: {
//     color: COLORS.danger,
//     marginBottom: SPACING.sm,
//     fontWeight: "600",
//   },
//   button: {
//     backgroundColor: COLORS.primary,
//     padding: SPACING.md,
//     borderRadius: RADIUS.md,
//     alignItems: "center",
//     marginTop: SPACING.sm,
//   },
//   buttonDisabled: {
//     opacity: 0.7,
//   },
//   loadingRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//   },
//   buttonText: {
//     color: COLORS.white,
//     fontWeight: "700",
//     fontSize: FONT.body,
//   },
//   link: {
//     marginTop: SPACING.md,
//     textAlign: "center",
//     color: COLORS.primary,
//     fontWeight: "600",
//   },
// });