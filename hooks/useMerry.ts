// hooks/useMerry.ts

import { createContribution, getContributionHistory } from "@/services/merry";
import { useState } from "react";

export const useMerry = (token: string) => {
  const [loading, setLoading] = useState(false);

  const contribute = async (amount: number) => {
    try {
      setLoading(true);
      const res = await createContribution(amount, token);
      return res.data;
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await getContributionHistory(token);
      return res.data;
    } finally {
      setLoading(false);
    }
  };

  return { contribute, fetchHistory, loading };
};