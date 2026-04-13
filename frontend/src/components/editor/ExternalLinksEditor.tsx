import type { ExternalLinksContent, ExternalLinkItem } from "../../types";

interface Props {
  content: ExternalLinksContent;
  onChange: (content: ExternalLinksContent) => void;
}

function emptyItem(): ExternalLinkItem {
  return { title: "", url: "", date: "", source: "" };
}

export default function ExternalLinksEditor({ content, onChange }: Props) {
  const { items = [] } = content;

  const update = (newItems: ExternalLinkItem[]) => {
    onChange({ items: newItems });
  };

  const addItem = () => update([...items, emptyItem()]);

  const updateItem = (idx: number, patch: Partial<ExternalLinkItem>) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    update(newItems);
  };

  const removeItem = (idx: number) => update(items.filter((_, i) => i !== idx));

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newItems = [...items];
    const target = idx + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    update(newItems);
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        添加链接
      </button>

      {items.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6 bg-slate-50 rounded-lg border border-slate-200">
          暂无链接，点击上方按钮添加
        </p>
      )}

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                链接 {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="p-1 text-red-400 hover:text-red-600 ml-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">标题 *</label>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(idx, { title: e.target.value })}
                  placeholder="链接标题"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">URL *</label>
                <input
                  type="url"
                  value={item.url}
                  onChange={(e) => updateItem(idx, { url: e.target.value })}
                  placeholder="https://..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">来源</label>
                  <input
                    type="text"
                    value={item.source || ""}
                    onChange={(e) => updateItem(idx, { source: e.target.value })}
                    placeholder="如：CCTV"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">日期</label>
                  <input
                    type="date"
                    value={item.date || ""}
                    onChange={(e) => updateItem(idx, { date: e.target.value })}
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
