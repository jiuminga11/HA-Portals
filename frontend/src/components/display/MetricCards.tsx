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
    <div
      className="flex flex-col sm:flex-row sm:flex-wrap"
      style={{
        borderTop: "1px solid var(--hairline)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      {cards.map((card, idx) => {
        const detail = localized(card.detail_zh, card.detail_en);
        const label = localized(card.label_zh, card.label_en);
        const line = [label, detail].filter(Boolean).join(" \u00b7 ");
        return (
          <div
            key={idx}
            className="flex-1 min-w-0 text-left sm:text-center"
            style={{ paddingTop: "40px", paddingBottom: "40px", paddingLeft: "8px", paddingRight: "8px" }}
          >
            <div
              className="font-mono tabular-nums"
              style={{ color: "var(--ink)", fontSize: "40px", fontWeight: 700, lineHeight: 1.1 }}
            >
              {card.value}
            </div>
            <div
              className="mt-2 truncate"
              style={{ color: "var(--ink-4)", fontSize: "13px" }}
            >
              {line}
            </div>
          </div>
        );
      })}
    </div>
  );
}
