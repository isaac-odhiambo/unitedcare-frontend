import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  error,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  secureTextEntry?: boolean;
  error?: string;
}) {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        style={[styles.input, !!error && styles.inputError]}
      />

      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.dark,
    fontFamily: FONT.regular,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  errorText: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.danger,
  },
});