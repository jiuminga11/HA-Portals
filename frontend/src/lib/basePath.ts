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

/**
 * Prefix root-relative media paths (/uploads/...) with basePath.
 * Absolute URLs (https://...) and empty strings pass through unchanged.
 */
export function resolveMediaUrl(url: string): string {
  if (!url || url.startsWith("http") || url.startsWith("data:")) return url;
  if (url.startsWith("/") && basePath) return `${basePath}${url}`;
  return url;
}
