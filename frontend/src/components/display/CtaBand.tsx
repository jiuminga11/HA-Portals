import { Link } from "react-router-dom";
import type { CtaBandContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  content: CtaBandContent;
}

/** §6 cta_band — band-variant content: centered description + button row.
 *  The band surface/title come from SectionRenderer's band treatment. */
export default function CtaBand({ content }: Props) {
  const { localized, t } = useLocale();
  const description = localized(content.description_zh, content.description_en);
  const buttons = content.buttons ?? [];

  if (!description && buttons.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: "var(--ink-4)" }}>
        <p>{t.section.noContent}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      {description && (
        <p
          className="max-w-2xl mx-auto text-lg"
          style={{ color: "var(--ink-2)", lineHeight: 1.7 }}
        >
          {description}
        </p>
      )}

      {buttons.length > 0 && (
        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3 mt-8">
          {buttons.map((btn, idx) => {
            const label = localized(btn.label_zh, btn.label_en);
            const isInternal = btn.url.startsWith("/") && !btn.url.startsWith("//");
            const isPrimary = idx === 0;
            const className = isPrimary
              ? "inline-flex items-center rounded-md text-lg font-semibold transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5"
              : "inline-flex items-center rounded-md text-lg font-medium transition-all duration-200 motion-reduce:transition-none hover-bg px-3 py-2";
            const style = isPrimary
              ? {
                  background: "linear-gradient(135deg, var(--color-primary), var(--color-gradient))",
                  color: "var(--color-bg)",
                  padding: "14px 28px",
                  boxShadow: "0 8px 28px rgba(var(--color-primary-rgb), 0.28)",
                }
              : { color: "var(--accent)" };
            const inner = isPrimary ? (
              label
            ) : (
              <>
                {label}
                <span aria-hidden="true" className="ml-1.5">→</span>
              </>
            );
            return isInternal ? (
              <Link key={idx} to={btn.url} className={className} style={style}>
                {inner}
              </Link>
            ) : (
              <a key={idx} href={btn.url} target="_blank" rel="noopener noreferrer" className={className} style={style}>
                {inner}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
