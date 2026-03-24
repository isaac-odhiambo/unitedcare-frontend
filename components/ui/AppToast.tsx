// components/ui/AppToast.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";

import { COLORS, RADIUS, SHADOW, SPACING, TYPE } from "@/constants/theme";

export type AppToastType =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "ACTION"
  | string;

export type AppToastProps = {
  visible: boolean;
  title: string;
  message?: string;
  type?: AppToastType;
  duration?: number;
  onHide?: () => void;
  onPress?: () => void;
  actionLabel?: string;
  position?: "top" | "bottom";
  style?: ViewStyle;
};

type ToastTheme = {
  accent: string;
  soft: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function normalizeType(type?: AppToastType): "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "ACTION" {
  const value = String(type || "INFO").toUpperCase();

  if (value === "SUCCESS") return "SUCCESS";
  if (value === "WARNING") return "WARNING";
  if (value === "ERROR") return "ERROR";
  if (value === "ACTION") return "ACTION";
  return "INFO";
}

function getToastTheme(type?: AppToastType): ToastTheme {
  const normalized = normalizeType(type);

  switch (normalized) {
    case "SUCCESS":
      return {
        accent: COLORS.secondary,
        soft: COLORS.secondarySoft ?? "rgba(22, 163, 74, 0.10)",
        icon: "checkmark-circle",
      };

    case "WARNING":
      return {
        accent: COLORS.warning,
        soft: COLORS.warningSoft ?? "rgba(245, 158, 11, 0.12)",
        icon: "warning",
      };

    case "ERROR":
      return {
        accent: COLORS.error ?? "#DC2626",
        soft: COLORS.errorSoft ?? "rgba(220, 38, 38, 0.10)",
        icon: "close-circle",
      };

    case "ACTION":
      return {
        accent: COLORS.info ?? "#2563EB",
        soft: COLORS.infoSoft ?? "rgba(37, 99, 235, 0.10)",
        icon: "flash",
      };

    case "INFO":
    default:
      return {
        accent: COLORS.primary,
        soft: COLORS.primarySoft ?? "rgba(14, 94, 111, 0.10)",
        icon: "information-circle",
      };
  }
}

export default function AppToast({
  visible,
  title,
  message,
  type = "INFO",
  duration = 3200,
  onHide,
  onPress,
  actionLabel,
  position = "top",
  style,
}: AppToastProps) {
  const translateY = useRef(
    new Animated.Value(position === "top" ? -24 : 24)
  ).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = useMemo(() => getToastTheme(type), [type]);

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 5,
      }),
    ]).start();
  };

  const animateOut = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: position === "top" ? -18 : 18,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        callback?.();
      }
    });
  };

  useEffect(() => {
    clearHideTimer();

    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(position === "top" ? -24 : 24);
      return;
    }

    animateIn();

    if (duration > 0) {
      hideTimer.current = setTimeout(() => {
        animateOut(onHide);
      }, duration);
    }

    return () => {
      clearHideTimer();
    };
  }, [visible, duration, onHide, opacity, position, translateY]);

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.portal,
        position === "top" ? styles.topPortal : styles.bottomPortal,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          style={[
            styles.toast,
            {
              borderLeftColor: theme.accent,
            },
            style,
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.soft }]}>
            <Ionicons name={theme.icon} size={22} color={theme.accent} />
          </View>

          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>

            {!!message ? (
              <Text style={styles.message} numberOfLines={3}>
                {message}
              </Text>
            ) : null}

            {!!actionLabel ? (
              <Text style={[styles.actionLabel, { color: theme.accent }]}>
                {actionLabel}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              clearHideTimer();
              animateOut(onHide);
            }}
            hitSlop={10}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color={COLORS.textMuted} />
          </Pressable>
        </Pressable>
      ) : (
        <View
          style={[
            styles.toast,
            {
              borderLeftColor: theme.accent,
            },
            style,
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.soft }]}>
            <Ionicons name={theme.icon} size={22} color={theme.accent} />
          </View>

          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>

            {!!message ? (
              <Text style={styles.message} numberOfLines={3}>
                {message}
              </Text>
            ) : null}

            {!!actionLabel ? (
              <Text style={[styles.actionLabel, { color: theme.accent }]}>
                {actionLabel}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              clearHideTimer();
              animateOut(onHide);
            }}
            hitSlop={10}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color={COLORS.textMuted} />
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  portal: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: SPACING.md,
  },

  topPortal: {
    top: SPACING.lg,
  },

  bottomPortal: {
    bottom: SPACING.lg,
  },

  toast: {
    minHeight: 72,
    borderRadius: RADIUS.xl,
    borderLeftWidth: 5,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    ...SHADOW.soft,
  },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },

  content: {
    flex: 1,
    paddingRight: SPACING.sm,
  },

  title: {
    ...(TYPE.bodyStrong || {}),
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: COLORS.text,
  },

  message: {
    ...(TYPE.subtext || {}),
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
  },

  actionLabel: {
    ...(TYPE.caption || {}),
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },

  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
});