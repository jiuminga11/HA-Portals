import type { MetricCardsContent, MetricCardItem } from "../../types";

interface Props {
  content: MetricCardsContent;
  onChange: (content: MetricCardsContent) => void;
}

function emptyCard(): MetricCardItem {
  return { label_zh: "", label_en: "", value: "", detail_zh: "", detail_en: "" };
}

const MAX_CARDS = 6;

export default function MetricCardsEditor({ content, onChange }: Props) {
  const { cards = [] } = content;

  const update = (newCards: MetricCardItem[]) => {
    onChange({ cards: newCards });
  };

  const addCard = () => {
    if (cards.length >= MAX_CARDS) return;
    update([...cards, emptyCard()]);
  };

  const updateCard = (idx: number, patch: Partial<MetricCardItem>) => {
    const newCards = [...cards];
    newCards[idx] = { ...newCards[idx], ...patch };
    update(newCards);
  };

  const removeCard = (idx: number) => update(cards.filter((_, i) => i !== idx));

  const moveCard = (idx: number, dir: -1 | 1) => {
    const newCards = [...cards];
    const target = idx + dir;
    if (target < 0 || target >= newCards.length) return;
    [newCards[idx], newCards[target]] = [newCards[target], newCards[idx]];
    update(newCards);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addCard}
          disabled={cards.length >= MAX_CARDS}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加卡片
        </button>
        <span className="text-xs text-slate-400">
          {cards.length} / {MAX_CARDS}
        </span>
      </div>

      {cards.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6 bg-slate-50 rounded-lg border border-slate-200">
          暂无指标卡片，点击上方按钮添加
        </p>
      )}

      <div className="space-y-3">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                卡片 {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveCard(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => moveCard(idx, 1)} disabled={idx === cards.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => removeCard(idx)} className="p-1 text-red-400 hover:text-red-600 ml-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">标签（中文）*</label>
                  <input
                    type="text"
                    value={card.label_zh}
                    onChange={(e) => updateCard(idx, { label_zh: e.target.value })}
                    placeholder="如：区分效度"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">标签（英文）</label>
                  <input
                    type="text"
                    value={card.label_en}
                    onChange={(e) => updateCard(idx, { label_en: e.target.value })}
                    placeholder="e.g. Discriminant Validity"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block">数值 *</label>
                <input
                  type="text"
                  value={card.value}
                  onChange={(e) => updateCard(idx, { value: e.target.value })}
                  placeholder="如：ρ=0.936、100%、δ=0.852"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">详情（中文）</label>
                  <input
                    type="text"
                    value={card.detail_zh}
                    onChange={(e) => updateCard(idx, { detail_zh: e.target.value })}
                    placeholder="补充说明"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">详情（英文）</label>
                  <input
                    type="text"
                    value={card.detail_en}
                    onChange={(e) => updateCard(idx, { detail_en: e.target.value })}
                    placeholder="Detail in English"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
