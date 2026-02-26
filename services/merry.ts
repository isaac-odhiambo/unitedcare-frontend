// services/merry.ts

import { BASE_URL, MERRY_ENDPOINTS } from "@/constants/api";
import axios from "axios";

export const createContribution = async (amount: number, token: string) => {
  return axios.post(
    `${BASE_URL}${MERRY_ENDPOINTS.contribute}`,
    { amount },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const getContributionHistory = async (token: string) => {
  return axios.get(`${BASE_URL}${MERRY_ENDPOINTS.history}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};