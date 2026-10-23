import client from "./client";
import type { LoginResponse } from "../types";

export async function login(username: string, password: string, signal?: AbortSignal): Promise<LoginResponse> {
  const res = await client.post<LoginResponse>("/auth/login", { username, password }, { signal, timeout: 10000 });
  return res.data;
}
