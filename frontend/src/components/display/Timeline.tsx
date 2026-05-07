import type { TimelineContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  content: TimelineContent;
}

/** Map category names to themed CSS variables */
function categoryColor(category: string): string {
  const map: Record<string, string> = {
    education: 'var(--cat-education)',
    career: 'var(--cat-career)',
    work: 'var(--cat-career)',
    research: 'var(--cat-research)',
    award: 'var(--cat-award)',
    publication: 'var(--cat-publication)',
    community: 'var(--cat-publication)',
    milestone: 'var(--cat-milestone)',
  };
  return map[category.toLowerCase()] || 'var(--color-primary)';
}

export default function Timeline({ content }: Props) {
  const { localized, t } = useLocale();
  const { items = [] } = content;

  if (items.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <p>{t.section.noData}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="relative">
        {/* Vertical rail line — desktop only (sm:) */}
        <div
          className="absolute top-2 bottom-2 w-px hidden sm:block"
          aria-hidden="true"
          style={{
            left: 'calc(8.5rem + 0.5rem)',
            background:
              'linear-gradient(to bottom, transparent, var(--color-primary) 10%, var(--color-accent) 90%, transparent)',
          }}
        />

        <div className="space-y-10">
          {items.map((item, idx) => {
            const dateEnd = item.date_end || t.section.present;
            const color = categoryColor(item.category);

            return (
              <div
                key={idx}
                className="relative grid sm:grid-cols-[8.5rem_1fr] sm:gap-8 gap-3"
              >
                {/* Date column — desktop */}
                <div className="hidden sm:block font-mono text-sm tabular-nums pt-1 text-right pr-4 whitespace-nowrap overflow-hidden text-ellipsis">
                  <div style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    {item.date_start}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    — {dateEnd}
                  </div>
                </div>

                {/* Mobile date — top line */}
                <div className="sm:hidden font-mono text-xs tabular-nums" style={{ color: 'var(--color-primary)' }}>
                  {item.date_start} — {dateEnd}
                </div>

                {/* Dot on rail line — desktop */}
                <div
                  className="hidden sm:block absolute top-2 w-3 h-3 rounded-full -translate-x-1/2 z-10"
                  aria-hidden="true"
                  style={{
                    left: 'calc(8.5rem + 0.5rem)',
                    background: color,
                    boxShadow: `0 0 0 4px var(--bg-base)`,
                  }}
                />

                <TimelineCard
                  title={localized(item.title_zh, item.title_en)}
                  subtitle={localized(item.subtitle_zh, item.subtitle_en)}
                  description={localized(item.description_zh, item.description_en)}
                  category={item.category}
                  color={color}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TimelineCardProps {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  color: string;
}

function TimelineCard({ title, subtitle, description, category, color }: TimelineCardProps) {
  return (
    <div
      className="rounded-xl px-5 py-4 transition-all duration-300 motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:transform-none"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
      }}
    >
      <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-base)' }}>
        {title}
      </h3>
      {subtitle && (
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary, var(--text-muted))' }}>
          {subtitle}
        </p>
      )}
      {description && (
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
      <span
        className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
        style={{
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          color: color,
          border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        }}
      >
        {category}
      </span>
    </div>
  );
}
