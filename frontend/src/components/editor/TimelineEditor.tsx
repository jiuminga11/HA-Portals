import type { TimelineContent, TimelineItem } from "../../types";

interface Props {
  content: TimelineContent;
  onChange: (content: TimelineContent) => void;
}

const CATEGORY_OPTIONS = [
  { value: "education", label: "教育" },
  { value: "career", label: "职业" },
  { value: "research", label: "研究" },
  { value: "community", label: "社区" },
  { value: "milestone", label: "里程碑" },
];

function emptyItem(): TimelineItem {
  return {
    date_start: "",
    date_end: undefined,
    title_zh: "",
    title_en: "",
    subtitle_zh: "",
    subtitle_en: "",
    description_zh: "",
    description_en: "",
    category: "milestone",
    icon: undefined,
  };
}

export default function TimelineEditor({ content, onChange }: Props) {
  const { items = [], layout = "vertical" } = content;

  const updateItems = (newItems: TimelineItem[]) => {
    onChange({ ...content, items: newItems });
  };

  const setLayout = (newLayout: "vertical" | "horizontal") => {
    onChange({ ...content, layout: newLayout });
  };

  const addItem = () => updateItems([...items, emptyItem()]);

  const updateItem = (idx: number, patch: Partial<TimelineItem>) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    updateItems(newItems);
  };

  const removeItem = (idx: number) => updateItems(items.filter((_, i) => i !== idx));

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newItems = [...items];
    const target = idx + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    updateItems(newItems);
  };

  return (
    <div className="space-y-4">
      {/* Layout selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600 font-medium">布局方向：</span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="timeline-layout"
            value="vertical"
            checked={layout === "vertical"}
            onChange={() => setLayout("vertical")}
            className="accent-[var(--color-primary)]"
          />
          <span className="text-sm text-slate-600">垂直</span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="timeline-layout"
            value="horizontal"
            checked={layout === "horizontal"}
            onChange={() => setLayout("horizontal")}
            className="accent-[var(--color-primary)]"
          />
          <span className="text-sm text-slate-600">水平</span>
        </label>
      </div>

      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        添加时间节点
      </button>

      {items.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6 bg-slate-50 rounded-lg border border-slate-200">
          暂无时间节点，点击上方按钮添加
        </p>
      )}

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                节点 {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600 ml-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {/* Date & Category row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">开始日期 *</label>
                  <input
                    type="text"
                    value={item.date_start}
                    onChange={(e) => updateItem(idx, { date_start: e.target.value })}
                    placeholder="2023 或 2023-09"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">结束日期</label>
                  <input
                    type="text"
                    value={item.date_end || ""}
                    onChange={(e) => updateItem(idx, { date_end: e.target.value || undefined })}
                    placeholder="留空表示至今"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">分类</label>
                  <select
                    value={item.category}
                    onChange={(e) => updateItem(idx, { category: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">标题（中文）*</label>
                  <input
                    type="text"
                    value={item.title_zh}
                    onChange={(e) => updateItem(idx, { title_zh: e.target.value })}
                    placeholder="如：河南医药大学"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">标题（英文）</label>
                  <input
                    type="text"
                    value={item.title_en}
                    onChange={(e) => updateItem(idx, { title_en: e.target.value })}
                    placeholder="e.g. Henan Medical University"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
              </div>

              {/* Subtitle */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">副标题（中文）</label>
                  <input
                    type="text"
                    value={item.subtitle_zh}
                    onChange={(e) => updateItem(idx, { subtitle_zh: e.target.value })}
                    placeholder="如：心理学 学术型硕士"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">副标题（英文）</label>
                  <input
                    type="text"
                    value={item.subtitle_en}
                    onChange={(e) => updateItem(idx, { subtitle_en: e.target.value })}
                    placeholder="e.g. M.S. Psychology"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">描述（中文）</label>
                  <textarea
                    value={item.description_zh}
                    onChange={(e) => updateItem(idx, { description_zh: e.target.value })}
                    placeholder="详细描述"
                    rows={2}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">描述（英文）</label>
                  <textarea
                    value={item.description_en}
                    onChange={(e) => updateItem(idx, { description_en: e.target.value })}
                    placeholder="Description in English"
                    rows={2}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary resize-none"
                  />
                </div>
              </div>

              {/* Icon */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">图标名称（可选）</label>
                <input
                  type="text"
                  value={item.icon || ""}
                  onChange={(e) => updateItem(idx, { icon: e.target.value || undefined })}
                  placeholder="Lucide 图标名，如：graduation-cap"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
