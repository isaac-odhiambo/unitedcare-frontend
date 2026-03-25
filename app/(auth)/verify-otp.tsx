// // app/(auth)/verify-otp.tsx

// import { getErrorMessage } from "@/services/api";
// import { resendOtp, verifyOtp } from "@/services/auth";
// import { saveSessionUser } from "@/services/session";
// import { router, useLocalSearchParams } from "expo-router";
// import { useEffect, useMemo, useState } from "react";
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

// type FieldErrors = {
//   phone?: string;
//   otp?: string;
//   general?: string;
// };

// function normalizePhone(input: string) {
//   return (input || "").replace(/\s+/g, "").trim();
// }

// function parseBackendError(e: any): FieldErrors {
//   const pretty = getErrorMessage(e);
//   const data = e?.response?.data;

//   if (typeof data?.detail === "string") {
//     return { general: data.detail };
//   }

//   if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
//     return { general: String(data.non_field_errors[0]) };
//   }

//   const errors: FieldErrors = {};

//   if (Array.isArray(data?.phone) && data.phone.length) {
//     errors.phone = String(data.phone[0]);
//   } else if (typeof data?.phone === "string") {
//     errors.phone = data.phone;
//   }

//   if (Array.isArray(data?.otp) && data.otp.length) {
//     errors.otp = String(data.otp[0]);
//   } else if (typeof data?.otp === "string") {
//     errors.otp = data.otp;
//   }

//   if (Object.keys(errors).length > 0) return errors;

//   return { general: pretty || "Verification failed. Please try again." };
// }

// function pickUserFromVerifyResponse(data: any) {
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
//         : true,
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

// export default function VerifyOtpScreen() {
//   const params = useLocalSearchParams();

//   const phoneParam = useMemo(
//     () => normalizePhone(String(params?.phone || "")),
//     [params]
//   );

//   const [phone] = useState(phoneParam);
//   const [otp, setOtp] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [errors, setErrors] = useState<FieldErrors>({});
//   const [cooldown, setCooldown] = useState(0);

//   useEffect(() => {
//     if (cooldown <= 0) return;

//     const t = setInterval(() => {
//       setCooldown((c) => {
//         if (c <= 1) {
//           clearInterval(t);
//           return 0;
//         }
//         return c - 1;
//       });
//     }, 1000);

//     return () => clearInterval(t);
//   }, [cooldown]);

//   const validateVerify = (): boolean => {
//     const next: FieldErrors = {};

//     if (!phone) {
//       next.phone = "Phone is missing. Go back and register again.";
//     } else if (!/^(07|01)\d{8}$/.test(phone)) {
//       next.phone = "Phone must be 07XXXXXXXX or 01XXXXXXXX.";
//     }

//     if (!otp) {
//       next.otp = "OTP is required.";
//     } else if (!/^\d{6}$/.test(otp)) {
//       next.otp = "OTP must be exactly 6 digits.";
//     }

//     setErrors(next);
//     return Object.keys(next).length === 0;
//   };

//   const handleVerify = async () => {
//     setErrors({});

//     if (!validateVerify()) return;

//     try {
//       setLoading(true);

//       const res = await verifyOtp({
//         phone,
//         otp,
//       });

//       const user = pickUserFromVerifyResponse(res);
//       await saveSessionUser(user);

//       Alert.alert(
//         "Success",
//         res?.detail || "Account verified successfully.",
//         [
//           {
//             text: "Continue",
//             onPress: () => router.replace("/(auth)/login"),
//           },
//         ]
//       );
//     } catch (e: any) {
//       const parsed = parseBackendError(e);
//       setErrors(parsed);

//       console.log("VERIFY OTP ERROR:", {
//         status: e?.response?.status,
//         data: e?.response?.data,
//         sent: { phone, otp },
//         baseURL: e?.config?.baseURL,
//         url: e?.config?.url,
//         message: getErrorMessage(e),
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleResend = async () => {
//     const p = normalizePhone(phone);

//     if (!/^(07|01)\d{8}$/.test(p)) {
//       Alert.alert(
//         "Invalid phone",
//         "Phone must be 07XXXXXXXX or 01XXXXXXXX."
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const res = await resendOtp({ phone: p });

//       Alert.alert(
//         "OTP Sent",
//         res?.detail || "OTP resent. Please check your phone."
//       );

//       setCooldown(60);
//     } catch (e: any) {
//       console.log("RESEND OTP ERROR:", {
//         status: e?.response?.status,
//         data: e?.response?.data,
//         sent: { phone: p },
//         baseURL: e?.config?.baseURL,
//         url: e?.config?.url,
//         message: getErrorMessage(e),
//       });

//       Alert.alert("Resend Failed", getErrorMessage(e));
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <KeyboardAvoidingView
//       style={{ flex: 1, backgroundColor: "#fff" }}
//       behavior={Platform.OS === "ios" ? "padding" : undefined}
//     >
//       <View style={styles.container}>
//         <Text style={styles.title}>Verify OTP</Text>

//         <Text style={styles.subtitle}>
//           Enter the 6-digit code sent to{" "}
//           <Text style={{ fontWeight: "800" }}>
//             {phone || "your phone"}
//           </Text>
//         </Text>

//         {errors.general && (
//           <Text style={styles.generalError}>{errors.general}</Text>
//         )}

//         {errors.phone && (
//           <Text style={styles.fieldError}>{errors.phone}</Text>
//         )}

//         <TextInput
//           placeholder="Enter 6-digit OTP"
//           value={otp}
//           onChangeText={(t) => {
//             const cleaned = t.replace(/\D/g, "").slice(0, 6);
//             setOtp(cleaned);

//             if (errors.otp || errors.general) {
//               setErrors((prev) => ({
//                 ...prev,
//                 otp: undefined,
//                 general: undefined,
//               }));
//             }
//           }}
//           keyboardType="number-pad"
//           maxLength={6}
//           editable={!loading}
//           style={[styles.input, errors.otp && styles.inputError]}
//         />

//         {errors.otp && (
//           <Text style={styles.fieldError}>{errors.otp}</Text>
//         )}

//         <TouchableOpacity
//           onPress={handleVerify}
//           disabled={loading}
//           style={[styles.button, loading && styles.buttonDisabled]}
//         >
//           {loading ? (
//             <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
//               <ActivityIndicator color="#fff" />
//               <Text style={styles.buttonText}>Verifying...</Text>
//             </View>
//           ) : (
//             <Text style={styles.buttonText}>Verify</Text>
//           )}
//         </TouchableOpacity>

//         <TouchableOpacity
//           onPress={handleResend}
//           disabled={loading || cooldown > 0}
//           style={{ marginTop: 16 }}
//         >
//           <Text
//             style={[
//               styles.link,
//               (loading || cooldown > 0) && { opacity: 0.6 },
//             ]}
//           >
//             {cooldown > 0
//               ? `Resend OTP in ${cooldown}s`
//               : "Resend OTP"}
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           onPress={() => router.replace("/(auth)/register")}
//           disabled={loading}
//         >
//           <Text style={[styles.link, { marginTop: 10 }]}>
//             Back to Register
//           </Text>
//         </TouchableOpacity>
//       </View>
//     </KeyboardAvoidingView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: "center",
//     padding: 20,
//     backgroundColor: "#fff",
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: "800",
//     marginBottom: 8,
//     color: "#111",
//   },
//   subtitle: {
//     marginBottom: 16,
//     color: "#666",
//   },
//   generalError: {
//     backgroundColor: "#ffecec",
//     borderColor: "#ffb3b3",
//     borderWidth: 1,
//     padding: 10,
//     borderRadius: 10,
//     marginBottom: 10,
//     color: "#990000",
//     fontWeight: "700",
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: "#ddd",
//     padding: 12,
//     borderRadius: 10,
//     marginBottom: 6,
//     color: "#111",
//   },
//   inputError: {
//     borderColor: "#cc0000",
//   },
//   fieldError: {
//     color: "#cc0000",
//     marginBottom: 10,
//     fontWeight: "600",
//   },
//   button: {
//     backgroundColor: "#111",
//     padding: 14,
//     borderRadius: 10,
//     alignItems: "center",
//     marginTop: 8,
//   },
//   buttonDisabled: {
//     opacity: 0.7,
//   },
//   buttonText: {
//     color: "#fff",
//     fontWeight: "700",
//   },
//   link: {
//     textAlign: "center",
//     color: "#111",
//     fontWeight: "700",
//   },
// });