import type { MetricCardsContent } from "../../types";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  content: MetricCardsContent;
}

export default function MetricCards({ content }: Props) {
  const { localized, t } = useLocale();
  const { cards = [] } = content;

  if (cards.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <p>{t.section.noData}</p>
      </div>
    );
  }

  // Responsive grid: 1 col mobile, 2 col sm, up to 4 col lg
  const gridCols =
    cards.length <= 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cards.length === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid ${gridCols} gap-6`}>
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="relative rounded-xl px-6 py-8 text-center transition-all duration-300"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: 'var(--card-shadow)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = 'var(--border-glow)';
            el.style.boxShadow = '0 4px 20px var(--glow-primary), 0 8px 30px rgba(0,0,0,0.08)';
            el.style.transform = 'translateY(-3px)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = 'var(--card-border)';
            el.style.boxShadow = 'var(--card-shadow)';
            el.style.transform = '';
          }}
        >
          {/* Big value */}
          <div
            className="text-3xl sm:text-4xl font-bold font-display mb-3"
            style={{ color: 'var(--color-primary)' }}
          >
            {card.value}
          </div>

          {/* Label */}
          <div
            className="text-base font-semibold mb-2"
            style={{ color: 'var(--text-base)' }}
          >
            {localized(card.label_zh, card.label_en)}
          </div>

          {/* Detail */}
          {(card.detail_zh || card.detail_en) && (
            <div
              className="text-sm leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              {localized(card.detail_zh, card.detail_en)}
            </div>
          )}

          {/* Subtle top accent bar */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-b"
            style={{
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-gradient))',
            }}
          />
        </div>
      ))}
    </div>
  );
}
