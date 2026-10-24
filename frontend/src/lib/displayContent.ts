/** Conservative script detection: Latin-only text keeps the surrounding language.
 * Script is not proof of a translation; the original-content notice is separate. */
export function contentLang(text: string): string | undefined {
  if (/[\u3040-\u30ff]/u.test(text)) return "ja";
  if (/[\uac00-\ud7af]/u.test(text)) return "ko";
  if (/[\u3400-\u9fff]/u.test(text)) return "zh";
  return undefined;
}

/** Presentation only: keep stored HTML untouched, remove only a matching leading
 * heading, and keep the page h1 unique. Never remove an unmatched content heading. */
export function prepareRichText(body: string, titles: string[], locale: "zh" | "en"): string {
  const doc = new DOMParser().parseFromString(sanitizeRichText(body), "text/html");
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  const first = doc.body.firstElementChild;
  // Only discard a plain, unadorned heading. Attributes or nested markup may
  // carry anchors, links, images or other meaningful content that must survive.
  if (first && /^H[1-6]$/.test(first.tagName) && first.attributes.length === 0
    && first.childElementCount === 0
    && titles.some((title) => title && normalize(title) === normalize(first.textContent || ""))) first.remove();
  doc.body.querySelectorAll("h1").forEach((heading) => {
    const replacement = doc.createElement("h2");
    for (const attribute of heading.attributes) replacement.setAttribute(attribute.name, attribute.value);
    replacement.innerHTML = heading.innerHTML;
    heading.replaceWith(replacement);
  });
  doc.body.querySelectorAll("p, li, h2, h3, h4, th, td, figcaption").forEach((element) => {
    if (!element.hasAttribute("lang")) {
      const lang = contentLang(element.textContent || "");
      if (lang) element.setAttribute("lang", lang);
    }
  });
  doc.body.querySelectorAll("[href]").forEach((element) => {
    element.setAttribute("href", resolveContentLink(element.getAttribute("href") || "", locale));
  });
  for (const attribute of ["src", "poster"]) {
    doc.body.querySelectorAll(`[${attribute}]`).forEach((element) => {
      element.setAttribute(attribute, resolveMediaUrl(element.getAttribute(attribute) || ""));
    });
  }
  return sanitizeRichText(doc.body.innerHTML);
}
import { resolveMediaUrl, stripBasePath } from "./basePath";
import { resolveContentLink } from "./localePath";
import { sanitizeRichText } from "./security";

/** Files and non-public routes must remain native links, not SPA page routes. */
export function isDisplayPageLink(url: string): boolean {
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  const pathname = stripBasePath(url).split(/[?#]/, 1)[0];
  return !/^\/(?:uploads?|api|assets|admin)(?:\/|$)/.test(pathname) && !/\.[^/]+$/.test(pathname);
}
