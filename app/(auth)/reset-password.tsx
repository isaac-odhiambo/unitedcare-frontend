import { getErrorMessage } from "@/services/api";
import { resetPassword } from "@/services/auth";
import { saveSessionUser } from "@/services/session";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function normalizeEmail(input: string) {
  return String(input || "").trim().toLowerCase();
}

function normalizeCode(input: string) {
  return (input || "").replace(/\D/g, "").slice(0, 6);
}

function pickUserFromResetResponse(data: any) {
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
  };
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();

  const email = useMemo(
    () => normalizeEmail(String(params.email || "")),
    [params.email]
  );

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    const cleanCode = normalizeCode(code);
    const cleanPassword = newPassword.trim();

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

    try {
      setLoading(true);

      const res = await resetPassword({
        email,
        code: cleanCode,
        new_password: cleanPassword,
      });

      const user = pickUserFromResetResponse(res);
      await saveSessionUser(user);

      Alert.alert(
        "Success",
        res?.detail || "Password reset successful. You are now logged in."
      );

      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      const data = e?.response?.data;

      const msg =
        data?.detail ||
        data?.non_field_errors?.[0] ||
        data?.code?.[0] ||
        data?.new_password?.[0] ||
        getErrorMessage(e) ||
        "Password reset failed.";

      Alert.alert("Error", String(msg));
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
        <Text style={styles.title}>Reset Password</Text>

        <Text style={styles.emailText}>Email: {email}</Text>

        <TextInput
          placeholder="Reset Code"
          value={code}
          onChangeText={(text) => setCode(normalizeCode(text))}
          keyboardType="number-pad"
          maxLength={6}
          editable={!loading}
          style={styles.input}
        />

        <TextInput
          placeholder="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          style={styles.input}
        />

        <TouchableOpacity
          onPress={handleReset}
          disabled={loading}
          style={[styles.button, loading && styles.buttonDisabled]}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}>Resetting...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Reset Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace("/(auth)/login")}
          disabled={loading}
        >
          <Text style={styles.link}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    gap: 12,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
  },
  emailText: {
    opacity: 0.7,
    marginBottom: 4,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    borderRadius: 10,
    color: "#111",
  },
  button: {
    backgroundColor: "black",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
  },
  link: {
    marginTop: 6,
    textAlign: "center",
    color: "#111",
    fontWeight: "600",
  },
});

// import { getErrorMessage } from "@/services/api";
// import { resetPassword } from "@/services/auth";
// import { saveSessionUser } from "@/services/session";
// import { router, useLocalSearchParams } from "expo-router";
// import { useMemo, useState } from "react";
// import {
//   ActivityIndicator,
//   Alert,
//   KeyboardAvoidingView,
//   Platform,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from "react-native";

// function normalizePhone(input: string) {
//   return (input || "").replace(/\s+/g, "").trim();
// }

// function normalizeOtp(input: string) {
//   return (input || "").replace(/\D/g, "").slice(0, 6);
// }

// function pickUserFromResetResponse(data: any) {
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
//   };
// }

// export default function ResetPasswordScreen() {
//   const params = useLocalSearchParams();

//   const phone = useMemo(
//     () => normalizePhone(String(params.phone || "")),
//     [params.phone]
//   );

//   const [otp, setOtp] = useState("");
//   const [newPassword, setNewPassword] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleReset = async () => {
//     const cleanOtp = normalizeOtp(otp);
//     const cleanPassword = newPassword.trim();

//     if (!phone) {
//       Alert.alert("Missing phone", "Phone number is required.");
//       return;
//     }

//     if (!/^(07|01)\d{8}$/.test(phone)) {
//       Alert.alert(
//         "Invalid phone",
//         "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX."
//       );
//       return;
//     }

//     if (!cleanOtp) {
//       Alert.alert("Missing OTP", "Enter the OTP sent to your phone.");
//       return;
//     }

//     if (!/^\d{6}$/.test(cleanOtp)) {
//       Alert.alert("Invalid OTP", "OTP must be exactly 6 digits.");
//       return;
//     }

//     if (!cleanPassword) {
//       Alert.alert("Missing password", "Enter a new password.");
//       return;
//     }

//     if (cleanPassword.length < 6) {
//       Alert.alert(
//         "Weak password",
//         "Password must be at least 6 characters."
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const res = await resetPassword({
//         phone,
//         otp: cleanOtp,
//         new_password: cleanPassword,
//       });

//       const user = pickUserFromResetResponse(res);
//       await saveSessionUser(user);

//       Alert.alert(
//         "Success",
//         res?.detail || "Password reset successful. You are now logged in."
//       );

//       router.replace("/(tabs)/dashboard");
//     } catch (e: any) {
//       const data = e?.response?.data;
//       const msg =
//         data?.detail ||
//         data?.non_field_errors?.[0] ||
//         data?.otp?.[0] ||
//         data?.new_password?.[0] ||
//         getErrorMessage(e) ||
//         "Password reset failed.";

//       Alert.alert("Error", String(msg));
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
//         <Text style={styles.title}>Reset Password</Text>

//         <Text style={styles.phoneText}>Phone: {phone}</Text>

//         <TextInput
//           placeholder="OTP"
//           value={otp}
//           onChangeText={(text) => setOtp(normalizeOtp(text))}
//           keyboardType="number-pad"
//           maxLength={6}
//           editable={!loading}
//           style={styles.input}
//         />

//         <TextInput
//           placeholder="New Password"
//           value={newPassword}
//           onChangeText={setNewPassword}
//           secureTextEntry
//           autoCapitalize="none"
//           autoCorrect={false}
//           editable={!loading}
//           style={styles.input}
//         />

//         <TouchableOpacity
//           onPress={handleReset}
//           disabled={loading}
//           style={[styles.button, loading && styles.buttonDisabled]}
//         >
//           {loading ? (
//             <View style={styles.loadingRow}>
//               <ActivityIndicator color="#fff" />
//               <Text style={styles.buttonText}>Resetting...</Text>
//             </View>
//           ) : (
//             <Text style={styles.buttonText}>Reset Password</Text>
//           )}
//         </TouchableOpacity>

//         <TouchableOpacity
//           onPress={() => router.replace("/(auth)/login")}
//           disabled={loading}
//         >
//           <Text style={styles.link}>Back to Login</Text>
//         </TouchableOpacity>
//       </View>
//     </KeyboardAvoidingView>
//   );
// }

// const styles = StyleSheet.create({
//   screen: {
//     flex: 1,
//     backgroundColor: "#fff",
//   },
//   container: {
//     flex: 1,
//     justifyContent: "center",
//     padding: 20,
//     gap: 12,
//     backgroundColor: "#fff",
//   },
//   title: {
//     fontSize: 22,
//     fontWeight: "700",
//     color: "#111",
//   },
//   phoneText: {
//     opacity: 0.7,
//     marginBottom: 4,
//     color: "#333",
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: "#ddd",
//     padding: 12,
//     borderRadius: 10,
//     color: "#111",
//   },
//   button: {
//     backgroundColor: "black",
//     padding: 14,
//     borderRadius: 10,
//     alignItems: "center",
//   },
//   buttonDisabled: {
//     opacity: 0.6,
//   },
//   loadingRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//   },
//   buttonText: {
//     color: "white",
//     fontWeight: "700",
//   },
//   link: {
//     marginTop: 6,
//     textAlign: "center",
//     color: "#111",
//     fontWeight: "600",
//   },
// });