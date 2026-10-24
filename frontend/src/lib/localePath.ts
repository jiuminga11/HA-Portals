import type { Locale } from "../hooks/LocaleContext";
import { basePath, resolveMediaUrl, stripBasePath } from "./basePath";
import { safeContentUrl } from "./safeUrl";

const external = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/** Router paths have already had BrowserRouter's basename removed. */
export function getPathLocale(pathname: string): Locale {
  return /^\/en(?:\/|$)/.test(pathname) ? "en" : "zh";
}

/** For Link/to and navigate(): never includes the deployment basename. */
export function localePath(path: string, locale: Locale): string {
  if (external.test(path) || path.startsWith("#") || path.startsWith("?")) return path;
  const match = path.match(/^([^?#]*)(.*)$/);
  const pathname = match?.[1] || "/";
  const suffix = match?.[2] || "";
  const rooted = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const unprefixed = rooted.replace(/^\/en(?=\/|$)/, "") || "/";
  return `${locale === "en" ? `/en${unprefixed}` : unprefixed}${suffix}`;
}

/** For content <a href>: localize pages, not files; apply basename exactly once. */
export function resolveContentLink(url: string, locale: Locale): string {
  url = safeContentUrl(url) || "#";
  if (!url || external.test(url) || /^[#?]/.test(url)) return url;
  const path = stripBasePath(url.startsWith("/") ? url : `/${url}`);
  const pathname = path.split(/[?#]/, 1)[0];
  if (/^\/(?:uploads?|api|assets|admin)(?:\/|$)/.test(pathname) || /\.[^/]+$/.test(pathname)) {
    return resolveMediaUrl(path);
  }
  return `${basePath}${localePath(path, locale)}`;
}
