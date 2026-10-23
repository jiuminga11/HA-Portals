import axios from "axios";
import { basePath } from "../lib/basePath";
import { expireAuthSession } from "../lib/authSession";

const client = axios.create({
  baseURL: `${basePath}/api`,
  timeout: 30000,
});

// 请求拦截：自动附加 Token
client.interceptors.request.use((config) => {
  const token = config.url === "/auth/login" ? null : localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Preserve mounted editors on expiry; never automatically replay a write.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401 && err.config?.url !== "/auth/login") {
      const authorization = err.config?.headers?.Authorization;
      const failedToken = typeof authorization === "string" && authorization.startsWith("Bearer ")
        ? authorization.slice(7) : null;
      if (failedToken || window.location.pathname.startsWith(`${basePath}/admin`)) expireAuthSession(failedToken);
    }
    return Promise.reject(err);
  }
);

export default client;
