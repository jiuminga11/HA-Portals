import type { TimelineContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  content: TimelineContent;
}

/** Map category names to accent colors */
function categoryColor(category: string): string {
  const map: Record<string, string> = {
    education: '#2563EB',
    career: '#0891B2',
    work: '#0891B2',
    research: '#7C3AED',
    award: '#D97706',
    publication: '#059669',
    community: '#10B981',
    milestone: '#F59E0B',
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
    <div className="relative">
      {/* Center vertical line — visible on md+ */}
      <div
        className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--color-primary), var(--color-gradient), transparent)' }}
      />

      {/* Mobile left line */}
      <div
        className="md:hidden absolute left-4 top-0 bottom-0 w-px"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--color-primary), var(--color-gradient), transparent)' }}
      />

      <div className="flex flex-col gap-12">
        {items.map((item, idx) => {
          const isLeft = idx % 2 === 0;
          const dateEnd = item.date_end || t.section.present;
          const color = categoryColor(item.category);

          return (
            <div key={idx} className="relative">
              {/* Dot on center line — desktop */}
              <div
                className="hidden md:block absolute left-1/2 top-6 w-3.5 h-3.5 rounded-full -translate-x-1/2 z-10"
                style={{
                  background: color,
                  boxShadow: `0 0 0 3px var(--bg-base), 0 0 12px ${color}40`,
                }}
              />

              {/* Dot on left line — mobile */}
              <div
                className="md:hidden absolute left-4 top-6 w-3 h-3 rounded-full -translate-x-1/2 z-10"
                style={{
                  background: color,
                  boxShadow: `0 0 0 3px var(--bg-base), 0 0 8px ${color}40`,
                }}
              />

              {/* Desktop: alternating layout */}
              <div className="hidden md:grid md:grid-cols-2 md:gap-8">
                {/* Left side content or spacer */}
                {isLeft ? (
                  <div className="text-right pr-8">
                    <TimelineCard
                      dateRange={`${item.date_start} — ${dateEnd}`}
                      title={localized(item.title_zh, item.title_en)}
                      subtitle={localized(item.subtitle_zh, item.subtitle_en)}
                      description={localized(item.description_zh, item.description_en)}
                      category={item.category}
                      color={color}
                      align="right"
                    />
                  </div>
                ) : (
                  <div />
                )}

                {/* Right side content or spacer */}
                {!isLeft ? (
                  <div className="pl-8">
                    <TimelineCard
                      dateRange={`${item.date_start} — ${dateEnd}`}
                      title={localized(item.title_zh, item.title_en)}
                      subtitle={localized(item.subtitle_zh, item.subtitle_en)}
                      description={localized(item.description_zh, item.description_en)}
                      category={item.category}
                      color={color}
                      align="left"
                    />
                  </div>
                ) : (
                  <div />
                )}
              </div>

              {/* Mobile: all left-aligned */}
              <div className="md:hidden pl-10">
                <TimelineCard
                  dateRange={`${item.date_start} — ${dateEnd}`}
                  title={localized(item.title_zh, item.title_en)}
                  subtitle={localized(item.subtitle_zh, item.subtitle_en)}
                  description={localized(item.description_zh, item.description_en)}
                  category={item.category}
                  color={color}
                  align="left"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TimelineCardProps {
  dateRange: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  color: string;
  align: 'left' | 'right';
}

function TimelineCard({ dateRange, title, subtitle, description, category, color, align }: TimelineCardProps) {
  return (
    <div
      className={`rounded-xl px-6 py-5 transition-all duration-300 ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--card-shadow)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = 'var(--border-glow)';
        el.style.boxShadow = '0 4px 20px var(--glow-primary), 0 8px 30px rgba(0,0,0,0.08)';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = 'var(--card-border)';
        el.style.boxShadow = 'var(--card-shadow)';
        el.style.transform = '';
      }}
    >
      {/* Date badge */}
      <span
        className="inline-block text-xs font-medium px-3 py-1 rounded-full mb-3"
        style={{
          background: `${color}15`,
          color: color,
          border: `1px solid ${color}30`,
        }}
      >
        {dateRange}
      </span>

      {/* Title */}
      <h3
        className="text-lg font-bold mb-1"
        style={{ color: 'var(--text-base)' }}
      >
        {title}
      </h3>

      {/* Subtitle */}
      {subtitle && (
        <p
          className="text-sm font-medium mb-2"
          style={{ color: 'var(--text-muted)' }}
        >
          {subtitle}
        </p>
      )}

      {/* Description */}
      {description && (
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {description}
        </p>
      )}

      {/* Category badge */}
      <span
        className={`inline-block text-xs px-2.5 py-0.5 rounded-full mt-3 font-medium ${align === 'right' ? 'ml-auto' : ''}`}
        style={{
          background: `${color}12`,
          color: color,
        }}
      >
        {category}
      </span>
    </div>
  );
}
