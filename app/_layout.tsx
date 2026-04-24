// app/_layout.tsx

import { NotificationProvider } from "@/context/NotificationContext";
import { setUnauthorizedHandler } from "@/services/api";
import {
  clearSavedLoginPersistence,
  clearSessionUser,
  getAuthToken,
  getKeepSignedIn,
  getSessionUser,
} from "@/services/session";
import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const UI = {
  page: "#062C49",
};

export default function RootLayout() {
  const segments = useSegments();
  const [bootstrapped, setBootstrapped] = useState(false);
  const didRouteRef = useRef(false);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await clearSessionUser();
      await clearSavedLoginPersistence();
      router.replace("/(auth)/login" as any);
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      try {
        const [sessionUser, keepSignedIn, token] = await Promise.all([
          getSessionUser(),
          getKeepSignedIn(),
          getAuthToken(),
        ]);

        if (!mounted) return;

        const inAuthGroup = segments[0] === "(auth)";
        const hasSession = !!sessionUser;
        const hasPersistentLogin = keepSignedIn && !!token;

        if (!didRouteRef.current) {
          if ((hasSession || hasPersistentLogin) && inAuthGroup) {
            didRouteRef.current = true;
            router.replace("/(tabs)/dashboard" as any);
          } else if (!hasSession && !hasPersistentLogin && !inAuthGroup) {
            didRouteRef.current = true;
            router.replace("/(auth)/login" as any);
          }
        }
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) {
          setBootstrapped(true);
        }
      }
    };

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, [segments]);

  if (!bootstrapped) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: UI.page }} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NotificationProvider>
        <StatusBar style="light" />

        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: {
              backgroundColor: UI.page,
            },
          }}
        >
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
              animation: "fade",
            }}
          />

          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="modal"
            options={{
              presentation: "transparentModal",
              headerShown: false,
            }}
          />
        </Stack>
      </NotificationProvider>
    </SafeAreaProvider>
  );
}

// // app/_layout.tsx

// import { NotificationProvider } from "@/context/NotificationContext";
// import { setUnauthorizedHandler } from "@/services/api";
// import { router, Stack } from "expo-router";
// import { StatusBar } from "expo-status-bar";
// import { useEffect } from "react";
// import { SafeAreaProvider } from "react-native-safe-area-context";

// const UI = {
//   page: "#062C49", // your main app background
// };

// export default function RootLayout() {
//   useEffect(() => {
//     setUnauthorizedHandler(() => {
//       router.replace("/(auth)/login" as any);
//     });
//   }, []);

//   return (
//     <SafeAreaProvider>
//       <NotificationProvider>

//         {/* Match your app dark theme */}
//         <StatusBar style="light" />

//         <Stack
//           screenOptions={{
//             headerShown: false, // 🔥 FORCE NO HEADER ANYWHERE
//             animation: "fade",
//             contentStyle: {
//               backgroundColor: UI.page, // 🔥 match dashboard theme
//             },
//           }}
//         >
//           {/* AUTH FLOW */}
//           <Stack.Screen
//             name="(auth)"
//             options={{
//               headerShown: false,
//               animation: "fade",
//             }}
//           />

//           {/* MAIN APP */}
//           <Stack.Screen
//             name="(tabs)"
//             options={{
//               headerShown: false,
//             }}
//           />

//           {/* MODALS */}
//           <Stack.Screen
//             name="modal"
//             options={{
//               presentation: "transparentModal",
//               headerShown: false,
//             }}
//           />
//         </Stack>
//       </NotificationProvider>
//     </SafeAreaProvider>
//   );
// }