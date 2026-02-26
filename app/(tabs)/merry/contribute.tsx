import ContributionForm from "@/components/merry/ContributionForm";
import { useMerry } from "@/hooks/useMerry";
import { Alert } from "react-native";

export default function ContributeScreen() {
  const token = "YOUR_JWT_TOKEN"; // Replace with auth context
  const { contribute } = useMerry(token);

  const handleContribution = async (amount: number) => {
    try {
      await contribute(amount);
      Alert.alert("Success", "Contribution created");
    } catch {
      Alert.alert("Error", "Something went wrong");
    }
  };

  return <ContributionForm onSubmit={handleContribution} />;
}