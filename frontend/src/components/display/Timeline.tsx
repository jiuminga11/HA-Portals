import { useId, useLayoutEffect, useRef, useState } from "react";
import type { TimelineContent, TimelineItem } from "../../types";
import { useLocale } from "../../hooks/useLocale";
import { contentLang } from "../../lib/displayContent";

interface Props {
  content: TimelineContent;
  /** On the home page we preview only the most recent items. */
  isHome?: boolean;
}

const HOME_LIMIT = 8;

function categoryColor(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("edu")) return "var(--cat-education)";
  if (c.includes("career") || c.includes("work")) return "var(--cat-career)";
  if (c.includes("research")) return "var(--cat-research)";
  if (c.includes("award") || c.includes("honor")) return "var(--cat-award)";
  if (c.includes("publication")) return "var(--cat-publication)";
  return "var(--cat-milestone)";
}

function TimelineRow({ item, isLast, transitionDelay }: { item: TimelineItem; isLast: boolean; transitionDelay: string }) {
  const { localized } = useLocale();
  const title = localized(item.title_zh, item.title_en);
  const subtitle = localized(item.subtitle_zh, item.subtitle_en);
  const description = localized(item.description_zh, item.description_en);
  const accent = categoryColor(item.category);

  return (
    <div className="reveal-x relative flex gap-4 sm:gap-6" style={{ transitionDelay }}>
      {/* Timeline axis */}
      <div className="flex flex-col items-center shrink-0" style={{ width: "28px" }}>
        <div
          className="rounded-full"
          style={{
            width: "14px",
            height: "14px",
            background: accent,
            boxShadow: `0 0 12px ${accent}`,
          }}
        />
        {!isLast && (
          <div
            className="flex-1 w-px mt-2"
            style={{ background: "linear-gradient(180deg, var(--hairline) 0%, transparent 100%)" }}
          />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 pb-8">
        <div className="timeline-item p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-5">
            <div
              className="font-mono tabular-nums shrink-0 text-lg"
              style={{ color: "var(--text-muted)", minWidth: "110px" }}
            >
              {item.date_start}
              {item.date_end && item.date_end !== item.date_start && (
                <span style={{ color: "var(--text-faint)" }}> — {item.date_end}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium" style={{ fontSize: "20px", color: "var(--ink)" }}>
                <span lang={contentLang(title)}>{title}</span>
                {subtitle && (
                  <span lang={contentLang(subtitle)} style={{ color: "var(--ink-3)", fontWeight: 400 }}>
                    {" \u00b7 "}
                    {subtitle}
                  </span>
                )}
              </div>
              {description && (
                <p lang={contentLang(description)} className="mt-2 text-lg" style={{ color: "var(--ink-4)", lineHeight: 1.7 }}>
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Timeline({ content, isHome = false }: Props) {
  const { t } = useLocale();
  const { items = [] } = content;
  const listRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  // §7.3 slide-in: one observer per Timeline (not per row), §7.1 contract.
  // Stagger comes from per-row inline transition-delay.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const showAll = () => {
      revealedRef.current = true;
      el.querySelectorAll(".reveal-x").forEach((row) => row.classList.add("visible"));
    };
    if (typeof IntersectionObserver === "undefined") {
      showAll();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          showAll();
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Rows mounted by expanding after the reveal must not stay transparent.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && revealedRef.current) {
      el.querySelectorAll(".reveal-x").forEach((row) => row.classList.add("visible"));
    }
  }, [expanded]);

  if (items.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--ink-4)' }}>
        <p>{t.section.noData}</p>
      </div>
    );
  }

  // DB stores items oldest-first. On home, preview the LAST N (most recent)
  // in chronological order. The toggle exists only when more entries exist,
  // and reveals them in place instead of promising content on another page.
  const collapsible = isHome && items.length > HOME_LIMIT;
  const visibleItems = collapsible && !expanded ? items.slice(-HOME_LIMIT) : items;

  return (
    <div className="w-full" ref={listRef} id={listId}>
      {visibleItems.map((item, idx) => (
        <TimelineRow
          key={items.length - visibleItems.length + idx}
          item={item}
          isLast={idx === visibleItems.length - 1}
          transitionDelay={`${Math.min(idx * 80, 400)}ms`}
        />
      ))}
      {collapsible && (
        <div className="pl-[36px] sm:pl-[42px]">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center text-lg font-medium transition-opacity duration-200 motion-reduce:transition-none hover:opacity-70"
            style={{ color: "var(--accent)" }}
          >
            {expanded
              ? t.section.showRecentTimeline
              : t.section.showAllTimeline.replace("{count}", String(items.length))}
          </button>
        </div>
      )}
    </div>
  );
}
