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
      <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
        <p>{t.section.noData}</p>
      </div>
    );
  }

  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
    >
      {cards.map((card, idx) => {
        const detail = localized(card.detail_zh, card.detail_en);
        const label = localized(card.label_zh, card.label_en);
        return (
          <div
            key={idx}
            className="glass-card rounded-2xl p-6 lg:p-8 text-left"
          >
            {label && (
              <div
                className="text-lg font-medium mb-2"
                style={{ color: "var(--ink-3)" }}
              >
                {label}
              </div>
            )}
            <div
              className="font-mono tabular-nums text-gradient"
              style={{
                fontSize: "56px",
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              {card.value}
            </div>
            {detail && (
              <div
                className="mt-3 text-lg"
                style={{ color: "var(--ink-4)", lineHeight: 1.6 }}
              >
                {detail}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
