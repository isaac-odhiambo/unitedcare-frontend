import { useState } from "react";
import { Alert, Button, StyleSheet, TextInput, View } from "react-native";

interface Props {
  onSubmit: (amount: number) => Promise<void>;
}

export default function ContributionForm({ onSubmit }: Props) {
  const [amount, setAmount] = useState("");

  const handleSubmit = async () => {
    if (!amount) return Alert.alert("Enter amount");

    await onSubmit(Number(amount));
    setAmount("");
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Enter contribution amount"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        style={styles.input}
      />
      <Button title="Contribute" onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
  },
});