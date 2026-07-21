import type { ExternalLinksContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  content: ExternalLinksContent;
}

export default function ExternalLinks({ content }: Props) {
  const { t } = useLocale();
  const { items = [] } = content;

  if (items.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--ink-4)' }}>
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <p>{t.section.noContent}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item, idx) => (
        <a
          key={idx}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block glass-card rounded-xl px-5 py-4 transition-all duration-200"
          style={{ color: "var(--ink)", textDecoration: "none" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-glow)";
            e.currentTarget.style.boxShadow = "0 4px 20px var(--glow-primary), 0 8px 30px rgba(0,0,0,0.12)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "";
            e.currentTarget.style.boxShadow = "";
            e.currentTarget.style.transform = "";
          }}
        >
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium" style={{ fontSize: "16px", lineHeight: 1.5, color: "var(--ink)" }}>
                {item.title}
              </div>
              {(item.source || item.date) && (
                <div className="mt-1" style={{ color: "var(--ink-4)", fontSize: "13px" }}>
                  {[item.source, item.date].filter(Boolean).join("  \u00b7  ")}
                </div>
              )}
            </div>
            <span
              aria-hidden="true"
              className="shrink-0 transition-transform duration-200 motion-reduce:transition-none group-hover:translate-x-0.5"
              style={{ fontSize: "16px", color: "var(--accent)" }}
            >
              →
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
