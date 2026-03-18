import { COLORS, RADIUS, SPACING, TYPE } from "@/constants/theme";
import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

type Props = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;

  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
} & Pick<
  TextInputProps,
  | "placeholder"
  | "keyboardType"
  | "secureTextEntry"
  | "multiline"
  | "numberOfLines"
  | "autoCapitalize"
  | "editable"
  | "autoCorrect"
  | "autoComplete"
  | "textContentType"
  | "returnKeyType"
  | "maxLength"
  | "onBlur"
  | "onFocus"
  | "placeholderTextColor"
>;

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  error,
  multiline = false,
  numberOfLines = 1,
  autoCapitalize = "none",
  editable = true,
  autoCorrect = false,
  autoComplete,
  textContentType,
  returnKeyType,
  maxLength,
  onBlur,
  onFocus,
  placeholderTextColor,
  style,
  containerStyle,
}: Props) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor || COLORS.placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        autoCapitalize={autoCapitalize}
        editable={editable}
        autoCorrect={autoCorrect}
        autoComplete={autoComplete}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        maxLength={maxLength}
        onBlur={onBlur}
        onFocus={onFocus}
        style={[
          styles.input,
          multiline && styles.multilineInput,
          !editable && styles.inputDisabled,
          !!error && styles.inputError,
          style,
        ]}
      />

      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },

  label: {
    ...TYPE.label,
    marginBottom: 8,
    color: COLORS.text,
  },

  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...TYPE.body,
  },

  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  inputDisabled: {
    backgroundColor: COLORS.gray50,
    color: COLORS.textMuted,
  },

  inputError: {
    borderColor: COLORS.danger,
  },

  errorText: {
    marginTop: 6,
    ...TYPE.caption,
    color: COLORS.danger,
  },
});