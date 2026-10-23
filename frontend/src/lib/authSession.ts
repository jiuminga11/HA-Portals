import { basePath } from "./basePath";

export type AuthRecoveryStatus = "active" | "expired" | "restored";
let status: AuthRecoveryStatus = "active";
const listeners = new Set<() => void>();

/** Client-side expiry check only; API remains responsible for signature verification. */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(part => !part || !/^[\w-]+$/.test(part))) return false;
    const header: unknown = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof header !== "object" || header === null || !("alg" in header) || typeof header.alg !== "string" || !header.alg || header.alg.toLowerCase() === "none") return false;
    const payload: unknown = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload !== "object" || payload === null || !("exp" in payload)) return false;
    return typeof payload.exp === "number" && Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function publish(next: AuthRecoveryStatus) {
  if (status === next) return;
  status = next;
  listeners.forEach(listener => listener());
}

export function expireAuthSession(failedToken: string | null) {
  // A late response from an old request must never invalidate a newer login.
  if (localStorage.getItem("token") !== failedToken) return;
  if (failedToken !== null) localStorage.removeItem("token");
  publish("expired");
}

export function setAuthToken(token: string) {
  if (!isTokenValid(token)) throw new Error("Invalid authentication token");
  localStorage.setItem("token", token);
  publish(status === "expired" ? "restored" : "active");
}

export function getAuthRecoveryStatus(): AuthRecoveryStatus { return status; }

export function subscribeAuthRecovery(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", event => {
    if (event.storageArea !== localStorage || (event.key !== "token" && event.key !== null)) return;
    // Read current storage rather than trusting an event queued before another login.
    if (isTokenValid(localStorage.getItem("token"))) {
      publish(status === "expired" ? "restored" : "active");
    } else {
      publish("expired");
    }
  });
}

/** Return a Router-relative admin destination, never an external URL or login loop. */
export function safeReturnTo(value: string | null): string {
  const unsafe = (text: string) => [...text].some(character => character === "\\" || character.charCodeAt(0) <= 32);
  if (!value || !value.startsWith("/") || value.startsWith("//") || unsafe(value)) return "/admin";
  try {
    const decoded = decodeURIComponent(value);
    if (unsafe(decoded) || decoded.startsWith("//")) return "/admin";
    const url = new URL(value, "https://local.invalid");
    let pathname = url.pathname;
    if (basePath && pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length);
    const decodedPath = decodeURIComponent(pathname);
    if (!/^\/admin(?:\/|$)/.test(decodedPath) || /^\/admin\/login(?:\/|$)/.test(decodedPath)) return "/admin";
    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return "/admin";
  }
}
