import createDOMPurify from "dompurify";
import { safeContentUrl } from "./safeUrl";
import { resolveMediaUrl } from "./basePath";
export { safeContentUrl } from "./safeUrl";

const purifier = createDOMPurify(window);
const tags = "p div span h1 h2 h3 h4 h5 h6 strong b em i u s strike br hr ul ol li blockquote pre code table thead tbody tfoot tr th td caption a img sub sup".split(" ");
const styles = new Set(["color", "background-color", "text-align", "font-weight", "font-style", "text-decoration", "font-size", "font-family", "white-space", "vertical-align"]);
const classes = /^(?:ql-(?:align-(?:center|right|justify)|indent-[1-8]|direction-rtl|size-(?:small|large|huge)|font-(?:serif|monospace)|syntax|code-block(?:-container)?|ui))$/;

if (purifier.isSupported) {
  purifier.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style") {
      const parsed = document.createElement("span").style;
      parsed.cssText = data.attrValue;
      const safe = document.createElement("span").style;
      for (const name of Array.from(parsed)) {
        if (styles.has(name)) safe.setProperty(name, parsed.getPropertyValue(name));
      }
      data.attrValue = safe.cssText;
    }
    if (data.attrName === "class") data.attrValue = data.attrValue.split(/\s+/).filter(c => classes.test(c)).join(" ");
    if (data.attrName === "href" || data.attrName === "src") {
    data.attrValue = safeContentUrl(data.attrValue, data.attrName === "src");
    if (!data.attrValue) data.keepAttr = false;
    else if (data.attrName === "src") data.attrValue = resolveMediaUrl(data.attrValue);
    }
    if (data.attrName === "data-list" && !["ordered", "bullet", "checked", "unchecked"].includes(data.attrValue)) data.keepAttr = false;
  });
  purifier.addHook("afterSanitizeAttributes", node => {
    if (node instanceof HTMLAnchorElement) node.setAttribute("rel", "noopener noreferrer");
  });
}

/** Display/editor boundary only; never writes sanitized legacy HTML to the API. */
export function sanitizeRichText(html: string): string {
  if (!purifier.isSupported) {
    // Never hand unfiltered markup to innerHTML on unsupported DOM engines.
    return html.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  return purifier.sanitize(html, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: ["id", "name", "title", "lang", "dir", "class", "style", "href", "target", "rel", "src", "alt", "width", "height", "colspan", "rowspan", "scope", "start", "value", "data-list"],
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    NAMESPACE: "http://www.w3.org/1999/xhtml",
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "svg", "math", "template"],
  });
}
