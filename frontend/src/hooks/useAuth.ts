import { useState, useCallback } from "react";
import { login as loginApi } from "../api/auth";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!token;

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await loginApi(username, password);
      localStorage.setItem("token", res.access_token);
      setToken(res.access_token);
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "登录失败";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
  }, []);

  return { isAuthenticated, login, logout, loading, error };
}
