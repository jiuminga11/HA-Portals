import type { ExternalLinksContent } from "../../types";

interface Props {
  content: ExternalLinksContent;
}

export default function ExternalLinks({ content }: Props) {
  const { items = [] } = content;

  if (items.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--ink-4)' }}>
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <p>暂无内容</p>
      </div>
    );
  }

  return (
    <div style={{ borderTop: "1px solid var(--hairline-2)" }}>
      {items.map((item, idx) => (
        <a
          key={idx}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
          style={{
            color: "var(--ink)",
            borderBottom: "1px solid var(--hairline-2)",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--ink)";
          }}
        >
          <div
            className="flex items-baseline justify-between gap-4"
            style={{ paddingTop: "18px", paddingBottom: "18px" }}
          >
            <div className="min-w-0">
              <div style={{ fontSize: "16px", fontWeight: 500, lineHeight: 1.5 }}>
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
              style={{ fontSize: "16px" }}
            >
              →
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
