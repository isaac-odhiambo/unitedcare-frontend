import ContributionCard from "@/components/merry/ContributionCard";
import { useMerry } from "@/hooks/useMerry";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";

export default function HistoryScreen() {
  const token = "YOUR_JWT_TOKEN";
  const { fetchHistory } = useMerry(token);
  const [data, setData] = useState([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetchHistory();
      setData(res);
    };
    load();
  }, []);

  return (
    <View style={{ padding: 16 }}>
      <FlatList
        data={data}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={({ item }) => (
          <ContributionCard
            amount={item.amount}
            paid={item.paid}
            date={item.paid_at}
          />
        )}
      />
    </View>
  );
}