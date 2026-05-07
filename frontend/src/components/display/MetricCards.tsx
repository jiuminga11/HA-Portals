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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="relative rounded-2xl px-6 py-7 text-left transition-all duration-300 motion-reduce:transition-none group"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
          }}
        >
          {/* Top gradient line — expands on hover */}
          <div
            className="absolute top-0 left-6 right-6 h-px transition-all duration-300 motion-reduce:transition-none group-hover:left-0 group-hover:right-0"
            aria-hidden="true"
            style={{
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
            }}
          />

          {/* Label — small, uppercase, tracked */}
          <div
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            {localized(card.label_zh, card.label_en)}
          </div>

          {/* Big value — mono + tabular */}
          <div
            className="font-mono font-semibold tracking-tight tabular-nums leading-none mb-4 text-5xl sm:text-6xl"
            style={{ color: 'var(--color-primary)' }}
          >
            {card.value}
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
        </div>
      ))}
    </div>
  );
}
