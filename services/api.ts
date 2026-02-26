import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL = "http://127.0.0.1:8000/api"; 
// Example: http://192.168.1.5:8000/api

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function saveTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync("access", access);
  await SecureStore.setItemAsync("refresh", refresh);
}