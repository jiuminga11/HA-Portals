/** Pure URL policy: safe to import from routing code in Node/SSR.
 * HTML sanitizer attributes are already parser-decoded. For legacy structured
 * strings, decode numeric references and protocol-relevant named references too.
 * This is not an HTML sanitizer or a general-purpose entity decoder.
 */
export function safeContentUrl(value: string, media = false): string {
  const named: Record<string, string> = {
    amp: "&", colon: ":", Tab: "\t", NewLine: "\n", sol: "/", bsol: "\\",
  };
  const decoded = value.replace(/&#(x[\da-f]+|\d+);?|&(amp|colon|Tab|NewLine|sol|bsol);/gi,
    (entity: string, numeric: string | undefined, name: string | undefined) => {
      if (numeric) {
        const code = numeric[0].toLowerCase() === "x" ? parseInt(numeric.slice(1), 16) : parseInt(numeric, 10);
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
          ? String.fromCodePoint(code) : "\ufffd";
      }
      return name ? named[name] ?? entity : entity;
    }).trim();
  if (Array.from(decoded).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === "\\")) return "";
  try {
    const parsed = new URL(decoded, "https://url-policy.invalid/");
    if (!(media ? ["http:", "https:"] : ["http:", "https:", "mailto:", "tel:"]).includes(parsed.protocol)) return "";
    return decoded;
  } catch { return ""; }
}
