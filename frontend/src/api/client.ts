import axios from "axios";
import { basePath } from "../lib/basePath";

const client = axios.create({
  baseURL: `${basePath}/api`,
  timeout: 30000,
});

// 请求拦截：自动附加 Token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：401 重定向（排除登录页本身，避免死循环）
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const loginPath = `${basePath}/admin/login`;
      const isLoginPage = window.location.pathname === loginPath;
      if (isLoginPage) {
        // 登录页的 401 不重定向，让表单自己处理错误显示
        return Promise.reject(err);
      }
      const hasToken = !!localStorage.getItem("token");
      const isAdminRoute = window.location.pathname.startsWith(`${basePath}/admin`);
      if (hasToken || isAdminRoute) {
        localStorage.removeItem("token");
        window.location.href = loginPath;
      }
    }
    return Promise.reject(err);
  }
);

export default client;
