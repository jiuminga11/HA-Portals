import { Link } from "react-router-dom";
import type { TimelineContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  content: TimelineContent;
  /** On the home page we preview only the most recent items. */
  isHome?: boolean;
}

const HOME_LIMIT = 8;

export default function Timeline({ content, isHome = false }: Props) {
  const { localized, t } = useLocale();
  const { items = [] } = content;

  if (items.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--ink-4)' }}>
        <p>{t.section.noData}</p>
      </div>
    );
  }

  // DB stores items oldest-first. On home, preview the LAST N (most recent)
  // while keeping chronological order for CV-style reading continuity.
  const truncated = isHome && items.length > HOME_LIMIT;
  const visibleItems = truncated ? items.slice(-HOME_LIMIT) : items;

  return (
    <div className="max-w-4xl mx-auto" style={{ borderTop: "1px solid var(--hairline-2)" }}>
      {visibleItems.map((item, idx) => {
        const title = localized(item.title_zh, item.title_en);
        const subtitle = localized(item.subtitle_zh, item.subtitle_en);
        return (
          <div
            key={idx}
            className="flex flex-col sm:flex-row sm:gap-6"
            style={{
              paddingTop: "18px",
              paddingBottom: "18px",
              borderBottom: "1px solid var(--hairline-2)",
            }}
          >
            <div
              className="font-mono tabular-nums shrink-0"
              style={{ color: "var(--ink-4)", fontSize: "14px", width: "90px" }}
            >
              {item.date_start}
            </div>
            <div
              className="mt-1 sm:mt-0"
              style={{ fontSize: "16px", fontWeight: 500, color: "var(--ink)" }}
            >
              {title}
              {subtitle && (
                <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>
                  {" \u00b7 "}
                  {subtitle}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {truncated && (
        <div style={{ paddingTop: "18px" }}>
          <Link
            to="/about"
            className="inline-flex items-center text-sm font-medium transition-opacity duration-200 motion-reduce:transition-none hover:opacity-70"
            style={{ color: "var(--accent)" }}
          >
            {t.section.viewFullTimeline}
            <span aria-hidden="true" className="ml-1.5">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
