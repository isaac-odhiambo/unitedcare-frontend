// app/(auth)/login.tsx
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api"; // ✅ from api.ts we built
import { loginUser } from "@/services/auth"; // ✅ loginUser(payload: { phone, password })
import { saveSessionUser } from "@/services/session"; // ✅ ADD (new)
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
  if (lower.includes("otp")) return { general: msg }; // OTP messages are usually general here
  if (lower.includes("locked")) return { general: msg };
  if (lower.includes("blocked")) return { general: msg };
  if (lower.includes("activated")) return { general: msg };
  return { general: msg };
}

function parseBackendError(e: any): FieldErrors {
  const pretty = getErrorMessage(e);
  const data = e?.response?.data;

  // DRF: { detail: "..." }
  if (typeof data?.detail === "string") return mapMessageToField(data.detail);

  // DRF: { non_field_errors: ["..."] }  OR  serializer.ValidationError("...")
  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return mapMessageToField(data.non_field_errors[0]);
  }

  // DRF: field errors: { phone: ["..."], password: ["..."] }
  const errors: FieldErrors = {};
  if (Array.isArray(data?.phone) && data.phone.length) errors.phone = data.phone[0];
  if (Array.isArray(data?.password) && data.password.length) errors.password = data.password[0];

  if (Object.keys(errors).length) return errors;

  // Fallback (network/unknown)
  return { general: pretty || "Login failed. Please try again." };
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
    else if (!/^(07|01)\d{8}$/.test(p)) next.phone = "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.";

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

      // ✅ Backend expects: { phone, password }
      const data = await loginUser({ phone: p, password });

      // 🚫 Only block blocked users (pending users CAN login)
      if (data?.status === "blocked") {
        setErrors({ general: "Your account has been blocked. Contact support." });
        return;
      }

      // ✅ Save role/status/is_admin so Dashboard can render Admin vs Member (Option 2)
      await saveSessionUser({
        role: data?.role,
        status: data?.status,
        is_admin: !!(data?.is_admin || data?.role === "admin"),
      });

      // ✅ Everyone goes to the same dashboard route (Option 2 renders different UI)
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      const parsed = parseBackendError(e);
      setErrors(parsed);

      // ✅ Debug info
      console.log("LOGIN ERROR:", {
        message: getErrorMessage(e),
        status: e?.response?.status,
        data: e?.response?.data,
        baseURL: e?.config?.baseURL,
        url: e?.config?.url,
      });

      // ✅ Helpful UX: if user needs OTP verification
      const msg = (getErrorMessage(e) || "").toLowerCase();
      if (msg.includes("verify otp") || msg.includes("not activated") || msg.includes("otp")) {
        // router.push({ pathname: "/(auth)/verify-otp", params: { phone: normalizePhone(phone) } });
      }
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

// // app/(auth)/login.tsx
// import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
// import { getErrorMessage } from "@/services/api"; // ✅ from api.ts we built
// import { loginUser } from "@/services/auth"; // ✅ loginUser(payload: { phone, password })
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
//   return input.replace(/\s+/g, "").trim();
// }

// function mapMessageToField(msg: string): FieldErrors {
//   const lower = msg.toLowerCase();
//   if (lower.includes("phone")) return { phone: msg };
//   if (lower.includes("password")) return { password: msg };
//   if (lower.includes("otp")) return { general: msg }; // OTP messages are usually general here
//   if (lower.includes("locked")) return { general: msg };
//   if (lower.includes("blocked")) return { general: msg };
//   if (lower.includes("activated")) return { general: msg };
//   return { general: msg };
// }

// function parseBackendError(e: any): FieldErrors {
//   const pretty = getErrorMessage(e);
//   const data = e?.response?.data;

//   // DRF: { detail: "..." }
//   if (typeof data?.detail === "string") return mapMessageToField(data.detail);

//   // DRF: { non_field_errors: ["..."] }  OR  serializer.ValidationError("...")
//   if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
//     return mapMessageToField(data.non_field_errors[0]);
//   }

//   // DRF: field errors: { phone: ["..."], password: ["..."] }
//   const errors: FieldErrors = {};
//   if (Array.isArray(data?.phone) && data.phone.length) errors.phone = data.phone[0];
//   if (Array.isArray(data?.password) && data.password.length) errors.password = data.password[0];

//   if (Object.keys(errors).length) return errors;

//   // Fallback (network/unknown)
//   return { general: pretty || "Login failed. Please try again." };
// }

// export default function LoginScreen() {
//   const [phone, setPhone] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [errors, setErrors] = useState<FieldErrors>({});

//   const validate = (): boolean => {
//     const next: FieldErrors = {};
//     const p = normalizePhone(phone);

//     if (!p) next.phone = "Phone number is required.";
//     else if (!/^(07|01)\d{8}$/.test(p)) next.phone = "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.";

//     if (!password) next.password = "Password is required.";

//     setErrors(next);
//     return Object.keys(next).length === 0;
//   };

//   const handleLogin = async () => {
//     setErrors({});
//     if (!validate()) return;

//     try {
//       setLoading(true);

//       const p = normalizePhone(phone);

//       // ✅ Backend expects: { phone, password }
//       const data = await loginUser({ phone: p, password });

//       // ✅ Backend returns: access, refresh, role, status, is_admin
//       // If not approved, you may want to block dashboard:
//       // if (data?.status && data.status !== "approved") {
//       //   setErrors({ general: `Account status: ${data.status}. Contact admin.` });
//       //   return;
//       // }

//       if (data?.status === "blocked") {
//   setErrors({ general: "Your account has been blocked. Contact support." });
//   return;
// }

    

//       // ✅ Route based on admin
//       if (data?.is_admin || data?.role === "admin") {
//         router.replace("/(tabs)/dashboard");
//       } else {
//         router.replace("/(tabs)/dashboard");
//       }
//     } catch (e: any) {
//       const parsed = parseBackendError(e);
//       setErrors(parsed);

//       // ✅ Debug info
//       console.log("LOGIN ERROR:", {
//         message: getErrorMessage(e),
//         status: e?.response?.status,
//         data: e?.response?.data,
//         baseURL: e?.config?.baseURL,
//         url: e?.config?.url,
//       });

//       // ✅ Helpful UX: if user needs OTP verification
//       const msg = (getErrorMessage(e) || "").toLowerCase();
//       if (msg.includes("verify otp") || msg.includes("not activated") || msg.includes("otp")) {
//         // Let them jump straight to OTP screen with phone filled
//         // (Only do this if your verify-otp screen exists)
//         // Comment out if you don't want auto-navigation.
//         // router.push({ pathname: "/(auth)/verify-otp", params: { phone: normalizePhone(phone) } });
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <KeyboardAvoidingView
//       style={{ flex: 1, backgroundColor: COLORS.white }}
//       behavior={Platform.OS === "ios" ? "padding" : undefined}
//     >
//       <View style={styles.container}>
//         <Text style={styles.title}>Login</Text>
//         <Text style={styles.subtitle}>Welcome back</Text>

//         {errors.general ? <Text style={styles.generalError}>{errors.general}</Text> : null}

//         <TextInput
//           style={[styles.input, errors.phone && styles.inputError]}
//           placeholder="Phone (07XXXXXXXX)"
//           placeholderTextColor={COLORS.gray}
//           value={phone}
//           onChangeText={(t) => {
//             setPhone(t);
//             if (errors.phone) setErrors((p) => ({ ...p, phone: undefined }));
//             if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
//           }}
//           keyboardType="phone-pad"
//           autoCapitalize="none"
//           autoCorrect={false}
//           editable={!loading}
//         />
//         {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}

//         <TextInput
//           style={[styles.input, errors.password && styles.inputError]}
//           placeholder="Password"
//           placeholderTextColor={COLORS.gray}
//           value={password}
//           onChangeText={(t) => {
//             setPassword(t);
//             if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
//             if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
//           }}
//           secureTextEntry
//           autoCapitalize="none"
//           autoCorrect={false}
//           editable={!loading}
//         />
//         {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

//         <TouchableOpacity
//           style={[styles.button, loading && styles.buttonDisabled]}
//           onPress={handleLogin}
//           disabled={loading}
//           activeOpacity={0.9}
//         >
//           {loading ? (
//             <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
//               <ActivityIndicator color={COLORS.white} />
//               <Text style={styles.buttonText}>Logging in...</Text>
//             </View>
//           ) : (
//             <Text style={styles.buttonText}>Login</Text>
//           )}
//         </TouchableOpacity>

//         <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} disabled={loading}>
//           <Text style={styles.link}>Forgot password?</Text>
//         </TouchableOpacity>

//         <TouchableOpacity onPress={() => router.push("/(auth)/register")} disabled={loading}>
//           <Text style={styles.link}>Create account</Text>
//         </TouchableOpacity>

//         {/* Optional quick check for baseURL (helpful during dev) */}
//         {/* <Text style={{ marginTop: 10, color: COLORS.gray, textAlign: "center" }}>
//           API: {process.env.EXPO_PUBLIC_API_URL}
//         </Text> */}
//       </View>
//     </KeyboardAvoidingView>
//   );
// }

// const styles = StyleSheet.create({
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

// import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
// import { getErrorMessage } from "@/services/api";
// import { loginUser } from "@/services/auth";
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
//   return input.replace(/\s+/g, "").trim();
// }

// function mapMessageToField(msg: string): FieldErrors {
//   const lower = msg.toLowerCase();
//   if (lower.includes("phone")) return { phone: msg };
//   if (lower.includes("password")) return { password: msg };
//   return { general: msg };
// }

// function parseBackendError(e: any): FieldErrors {
//   // ✅ Handles: network errors, 401/400/500, DRF detail/non_field_errors/field errors
//   const pretty = getErrorMessage(e);

//   const data = e?.response?.data;

//   // DRF: { detail: "..." }
//   if (typeof data?.detail === "string") return mapMessageToField(data.detail);

//   // DRF: { non_field_errors: ["..."] }
//   if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
//     return { general: data.non_field_errors[0] };
//   }

//   // DRF field errors: { phone: ["..."], password: ["..."] }
//   const errors: FieldErrors = {};
//   if (Array.isArray(data?.phone) && data.phone.length) errors.phone = data.phone[0];
//   if (Array.isArray(data?.password) && data.password.length) errors.password = data.password[0];

//   if (Object.keys(errors).length) return errors;

//   // Network / unknown: show formatted message from api.ts
//   return { general: pretty || "Login failed. Please try again." };
// }

// export default function LoginScreen() {
//   const [phone, setPhone] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [errors, setErrors] = useState<FieldErrors>({});

//   const validate = (): boolean => {
//     const next: FieldErrors = {};
//     const p = normalizePhone(phone);

//     if (!p) next.phone = "Phone number is required.";
//     else if (!/^(07|01)\d{8}$/.test(p)) next.phone = "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.";

//     if (!password) next.password = "Password is required.";

//     setErrors(next);
//     return Object.keys(next).length === 0;
//   };

//   const handleLogin = async () => {
//     setErrors({});
//     if (!validate()) return;

//     try {
//       setLoading(true);

//       const p = normalizePhone(phone);
//       await loginUser({ phone: p, password });

//       router.replace("/(tabs)/dashboard");
//     } catch (e: any) {
//       // ✅ shows real error: network/baseURL/401/500/field errors
//       const parsed = parseBackendError(e);
//       setErrors(parsed);

//       // ✅ useful debug in console
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
//       style={{ flex: 1, backgroundColor: COLORS.white }}
//       behavior={Platform.OS === "ios" ? "padding" : undefined}
//     >
//       <View style={styles.container}>
//         <Text style={styles.title}>Login</Text>
//         <Text style={styles.subtitle}>Welcome back</Text>

//         {errors.general ? <Text style={styles.generalError}>{errors.general}</Text> : null}

//         <TextInput
//           style={[styles.input, errors.phone && styles.inputError]}
//           placeholder="Phone (07XXXXXXXX)"
//           placeholderTextColor={COLORS.gray}
//           value={phone}
//           onChangeText={(t) => {
//             setPhone(t);
//             if (errors.phone) setErrors((p) => ({ ...p, phone: undefined }));
//             if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
//           }}
//           keyboardType="phone-pad"
//           autoCapitalize="none"
//           autoCorrect={false}
//           editable={!loading}
//         />
//         {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}

//         <TextInput
//           style={[styles.input, errors.password && styles.inputError]}
//           placeholder="Password"
//           placeholderTextColor={COLORS.gray}
//           value={password}
//           onChangeText={(t) => {
//             setPassword(t);
//             if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
//             if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
//           }}
//           secureTextEntry
//           autoCapitalize="none"
//           autoCorrect={false}
//           editable={!loading}
//         />
//         {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

//         <TouchableOpacity
//           style={[styles.button, loading && styles.buttonDisabled]}
//           onPress={handleLogin}
//           disabled={loading}
//           activeOpacity={0.9}
//         >
//           {loading ? (
//             <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
//               <ActivityIndicator color={COLORS.white} />
//               <Text style={styles.buttonText}>Logging in...</Text>
//             </View>
//           ) : (
//             <Text style={styles.buttonText}>Login</Text>
//           )}
//         </TouchableOpacity>

//         <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} disabled={loading}>
//           <Text style={styles.link}>Forgot password?</Text>
//         </TouchableOpacity>

//         <TouchableOpacity onPress={() => router.push("/(auth)/register")} disabled={loading}>
//           <Text style={styles.link}>Create account</Text>
//         </TouchableOpacity>
//       </View>
//     </KeyboardAvoidingView>
//   );
// }

// const styles = StyleSheet.create({
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