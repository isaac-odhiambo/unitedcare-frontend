// context/NotificationContext.tsx
import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from "react";
import { StyleSheet, View } from "react-native";

import AppToast, { AppToastType } from "@/components/ui/AppToast";

type ShowToastInput = {
  title: string;
  message?: string;
  type?: AppToastType;
  duration?: number;
  actionLabel?: string;
  onPress?: () => void;
  onHide?: () => void;
  position?: "top" | "bottom";
};

type ToastState = {
  visible: boolean;
  title: string;
  message?: string;
  type: AppToastType;
  duration: number;
  actionLabel?: string;
  onPress?: () => void;
  onHide?: () => void;
  position: "top" | "bottom";
};

type NotificationContextValue = {
  showToast: (input: ShowToastInput) => void;
  hideToast: () => void;
  visible: boolean;
};

const DEFAULT_TOAST: ToastState = {
  visible: false,
  title: "",
  message: "",
  type: "INFO",
  duration: 3200,
  actionLabel: undefined,
  onPress: undefined,
  onHide: undefined,
  position: "top",
};

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

function normalizeType(type?: AppToastType): AppToastType {
  const value = String(type || "INFO").toUpperCase();

  if (value === "SUCCESS") return "SUCCESS";
  if (value === "WARNING") return "WARNING";
  if (value === "ERROR") return "ERROR";
  if (value === "ACTION") return "ACTION";
  return "INFO";
}

function getDefaultDuration(type?: AppToastType): number {
  const normalized = normalizeType(type);

  switch (normalized) {
    case "SUCCESS":
      return 3000;
    case "WARNING":
      return 4500;
    case "ERROR":
      return 5000;
    case "ACTION":
      return 0; // manual close by default for admin/custom/action alerts
    case "INFO":
    default:
      return 3200;
  }
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toast, setToast] = useState<ToastState>(DEFAULT_TOAST);
  const queueRef = useRef<ToastState[]>([]);

  const hideToast = useCallback(() => {
    setToast((prev) => {
      if (queueRef.current.length > 0) {
        const nextToast = queueRef.current.shift();
        if (nextToast) {
          return {
            ...nextToast,
            visible: true,
          };
        }
      }

      return {
        ...prev,
        visible: false,
        title: "",
        message: "",
        actionLabel: undefined,
        onPress: undefined,
        onHide: undefined,
      };
    });
  }, []);

  const showToast = useCallback((input: ShowToastInput) => {
    const nextToast: ToastState = {
      visible: true,
      title: input.title,
      message: input.message,
      type: normalizeType(input.type),
      duration:
        typeof input.duration === "number"
          ? input.duration
          : getDefaultDuration(input.type),
      actionLabel: input.actionLabel,
      onPress: input.onPress,
      onHide: input.onHide,
      position: input.position ?? "top",
    };

    setToast((current) => {
      if (current.visible) {
        queueRef.current.push(nextToast);
        return current;
      }

      return nextToast;
    });
  }, []);

  const handleToastHide = useCallback(() => {
    const currentOnHide = toast.onHide;
    hideToast();
    currentOnHide?.();
  }, [toast.onHide, hideToast]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      showToast,
      hideToast,
      visible: toast.visible,
    }),
    [showToast, hideToast, toast.visible]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}

      <View pointerEvents="box-none" style={styles.overlay}>
        <AppToast
          visible={toast.visible}
          title={toast.title}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          actionLabel={toast.actionLabel}
          onPress={toast.onPress}
          onHide={handleToastHide}
          position={toast.position}
        />
      </View>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }

  return context;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});