import { getErrorMessage } from "@/services/api";
import { forgotPassword } from "@/services/auth";
import { router } from "expo-router";
import { useState } from "react";
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      Alert.alert("Missing email", "Enter your email address.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      const res = await forgotPassword({ email: cleanEmail });

      Alert.alert(
        "Code Sent",
        res?.detail || "Password reset code sent to your email."
      );

      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: cleanEmail },
      });
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
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
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your email address to receive a password reset code
        </Text>

        <TextInput
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          style={styles.input}
        />

        <TouchableOpacity
          onPress={handleRequestCode}
          disabled={loading}
          style={[styles.button, loading && styles.buttonDisabled]}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}>Sending...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Send Reset Code</Text>
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
  subtitle: {
    color: "#666",
    marginBottom: 6,
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
// import { forgotPassword } from "@/services/auth";
// import { router } from "expo-router";
// import { useState } from "react";
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

// export default function ForgotPasswordScreen() {
//   const [phone, setPhone] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleRequestOtp = async () => {
//     const cleanPhone = normalizePhone(phone);

//     if (!cleanPhone) {
//       Alert.alert("Missing phone", "Enter your phone number.");
//       return;
//     }

//     if (!/^(07|01)\d{8}$/.test(cleanPhone)) {
//       Alert.alert(
//         "Invalid phone",
//         "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX."
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const res = await forgotPassword({ phone: cleanPhone });

//       Alert.alert(
//         "OTP Sent",
//         res?.detail || "Password reset OTP sent to your phone."
//       );

//       router.push({
//         pathname: "/(auth)/reset-password",
//         params: { phone: cleanPhone },
//       });
//     } catch (e: any) {
//       Alert.alert("Error", getErrorMessage(e));
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
//         <Text style={styles.title}>Forgot Password</Text>
//         <Text style={styles.subtitle}>
//           Enter your phone number to receive a reset OTP
//         </Text>

//         <TextInput
//           placeholder="Phone (07XXXXXXXX)"
//           value={phone}
//           onChangeText={setPhone}
//           keyboardType="phone-pad"
//           autoCapitalize="none"
//           autoCorrect={false}
//           editable={!loading}
//           style={styles.input}
//         />

//         <TouchableOpacity
//           onPress={handleRequestOtp}
//           disabled={loading}
//           style={[styles.button, loading && styles.buttonDisabled]}
//         >
//           {loading ? (
//             <View style={styles.loadingRow}>
//               <ActivityIndicator color="#fff" />
//               <Text style={styles.buttonText}>Sending...</Text>
//             </View>
//           ) : (
//             <Text style={styles.buttonText}>Send OTP</Text>
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
//   subtitle: {
//     color: "#666",
//     marginBottom: 6,
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