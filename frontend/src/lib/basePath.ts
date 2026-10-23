/**
 * Single source of truth for the app's base path.
 *
 * Dev:  BASE_URL = "/"  → basePath = ""
 * Prod: BASE_URL = "/ha/" → basePath = "/ha"
 *
 * Usage:
 *   `${basePath}/api/...`   → API requests
 *   `${basePath}/uploads/...` → media URLs from DB
 */
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function stripBasePath(path: string): string {
  if (!basePath) return path;
  if (path === basePath) return "/";
  return path.startsWith(`${basePath}/`) ? path.slice(basePath.length) : path;
}

/**
 * Prefix root-relative media paths (/uploads/...) with basePath.
 * Absolute URLs (https://...) and empty strings pass through unchanged.
 */
export function resolveMediaUrl(url: string): string {
  if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) return url;
  if (url.startsWith("/") && basePath) return `${basePath}${stripBasePath(url)}`;
  return url;
}
