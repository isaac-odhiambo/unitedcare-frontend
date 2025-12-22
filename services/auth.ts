import { API } from "./api";

export const loginUser = async (username: string, password: string) => {
  const response = await API.post("/auth/login/", {
    username,
    password,
  });
  return response.data;
};

export const registerUser = async (
  username: string,
  email: string,
  phone: string,
  password: string
) => {
  const response = await API.post("/auth/register/", {
    username,
    email,
    phone,
    password,
  });
  return response.data;
};
