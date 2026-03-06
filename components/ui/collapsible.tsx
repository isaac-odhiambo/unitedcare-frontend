import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS, FONT, SPACING } from "@/constants/theme";

type Props = PropsWithChildren<{
  title: string;
}>;

export default function Collapsible({ children, title }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.heading}
        activeOpacity={0.8}
        onPress={() => setIsOpen((prev) => !prev)}
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.textMuted}
          style={{
            transform: [{ rotate: isOpen ? "90deg" : "0deg" }],
          }}
        />

        <Text style={styles.title}>{title}</Text>
      </TouchableOpacity>

      {isOpen && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },

  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: SPACING.sm,
  },

  title: {
    fontSize: 14,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
  },

  content: {
    marginTop: SPACING.sm,
    marginLeft: 26,
  },
});