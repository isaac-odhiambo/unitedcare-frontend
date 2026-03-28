import { COLORS } from "@/constants/theme";
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AppScreenProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  edges?: ("top" | "right" | "bottom" | "left")[];
};

export default function AppScreen({
  children,
  style,
  edges = ["top"],
}: AppScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.content, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});