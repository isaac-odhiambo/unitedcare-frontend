import { COLORS } from "@/constants/theme";
import React from "react";
import {
    RefreshControl,
    ScrollView,
    ScrollViewProps,
    StyleSheet,
    ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AppScrollScreenProps = {
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle | ViewStyle[];
  edges?: ("top" | "right" | "bottom" | "left")[];
  refreshing?: boolean;
  onRefresh?: () => void;
} & Omit<ScrollViewProps, "contentContainerStyle" | "refreshControl">;

export default function AppScrollScreen({
  children,
  contentContainerStyle,
  edges = ["top"],
  refreshing = false,
  onRefresh,
  ...scrollProps
}: AppScrollScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary, COLORS.secondary]}
            />
          ) : undefined
        }
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});